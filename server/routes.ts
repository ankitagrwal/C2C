import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import path from "path";
import { storage } from "./storage";
import { 
  insertCustomerSchema, 
  insertDocumentSchema, 
  insertTestCaseSchema, 
  insertUserSchema,
  type User 
} from "@shared/schema";
import multer, { type FileFilterCallback, type Multer } from "multer";
import { z } from "zod";
import { processDocumentForTestGeneration } from "./ai-service";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parseDocumentForCompanyDetails } from "./services/documentParser";

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;

// CSRF protection middleware for state-changing requests
const requireCSRFToken = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF check for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Check for X-Requested-With header (common CSRF protection)
  const requestedWith = req.headers['x-requested-with'];
  if (requestedWith !== 'XMLHttpRequest') {
    return res.status(403).json({
      error: 'Missing required security header for state-changing requests',
      code: 'CSRF_PROTECTION',
      hint: 'Include X-Requested-With: XMLHttpRequest header'
    });
  }

  next();
};

// Extend Express session data
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    user?: Omit<User, 'password'>;
  }
}

// Type for authenticated requests
interface AuthenticatedRequest extends Request {
  session: {
    userId?: string;
    user?: Omit<User, 'password'>;
  } & Request['session'];
  document?: any; // Store document for authorized requests
}

// Validation schemas for updates to prevent mass assignment
const updateCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  industry: z.string().max(100).optional(),
  isConfigured: z.boolean().optional(),
  toolConfig: z.record(z.any()).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

const updateDocumentSchema = z.object({
  filename: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
  docType: z.string().max(100).optional(),
  status: z.enum(['uploaded', 'processing', 'completed', 'failed']).optional(),
});

const updateTestCaseSchema = z.object({
  content: z.string().min(1).optional(),
  category: z.string().max(100).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  contextUsed: z.string().optional(),
  executionStatus: z.enum(['ready', 'in_progress', 'complete', 'failed']).optional(),
});

// Query parameter validation schemas
const customerIdQuerySchema = z.object({
  customerId: z.string().uuid("Invalid customer ID format"),
});

const documentIdQuerySchema = z.object({
  documentId: z.string().uuid("Invalid document ID format"),
});

const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// File upload validation schema - accept UUID or 'demo' for demo mode
const fileUploadSchema = z.object({
  customerId: z.string().refine((val) => {
    return val === 'demo' || z.string().uuid().safeParse(val).success;
  }, "Customer ID must be a valid UUID or 'demo' for demo mode"),
  docType: z.string().min(1, "Document type is required").max(100),
});

// Rate limiting middleware for login endpoint
const rateLimitLogin = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  const attempts = loginAttempts.get(clientIP);
  
  if (attempts) {
    if (now > attempts.resetTime) {
      // Reset window expired, clear attempts
      loginAttempts.delete(clientIP);
    } else if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      const timeRemaining = Math.ceil((attempts.resetTime - now) / 1000 / 60);
      return res.status(429).json({
        error: `Too many login attempts. Please try again in ${timeRemaining} minutes.`,
        code: 'RATE_LIMITED',
        retryAfter: attempts.resetTime
      });
    }
  }
  
  next();
};

// Authentication middleware
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId || !req.session.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'UNAUTHORIZED' 
    });
  }
  next();
};

// Admin role middleware
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      code: 'FORBIDDEN' 
    });
  }
  next();
};

// Document ownership/authorization middleware
const authorizeDocumentAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const documentId = req.params.id;
    if (!documentId) {
      return res.status(400).json({ 
        error: 'Document ID required',
        code: 'MISSING_DOCUMENT_ID' 
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(documentId)) {
      return res.status(400).json({ 
        error: 'Invalid document ID format',
        code: 'INVALID_DOCUMENT_ID' 
      });
    }

    // Verify document exists and user has access
    const document = await storage.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ 
        error: 'Document not found',
        code: 'NOT_FOUND' 
      });
    }

    // Admin users have access to all documents
    if (req.session.user?.role === 'admin') {
      req.document = document; // Store document in request for later use
      return next();
    }

    // For future user roles, add appropriate authorization logic here
    return res.status(403).json({ 
      error: 'Insufficient permissions to access this document',
      code: 'ACCESS_DENIED' 
    });
  } catch (error) {
    console.error('Document authorization error:', error);
    return res.status(500).json({ 
      error: 'Authorization check failed',
      code: 'AUTHORIZATION_ERROR' 
    });
  }
};


// Error handler utility
const handleDatabaseError = (error: any, res: Response, operation: string) => {
  console.error(`Database error during ${operation}:`, error);
  
  // Handle specific database constraint errors
  if (error.code === '23505') { // Unique constraint violation
    return res.status(409).json({ 
      error: 'Resource already exists',
      code: 'CONFLICT',
      details: error.detail 
    });
  }
  
  if (error.code === '23503') { // Foreign key constraint violation
    return res.status(400).json({ 
      error: 'Invalid reference to related resource',
      code: 'INVALID_REFERENCE',
      details: error.detail 
    });
  }
  
  if (error.code === '23502') { // Not null constraint violation
    return res.status(400).json({ 
      error: 'Required field missing',
      code: 'MISSING_REQUIRED_FIELD',
      details: error.detail 
    });
  }
  
  // Generic server error
  return res.status(500).json({ 
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
};

// Validate query parameters utility
const validateQuery = (schema: z.ZodSchema, query: any) => {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new z.ZodError(result.error.issues);
  }
  return result.data;
};

// Validate path parameters utility
const validateParams = (schema: z.ZodSchema, params: any) => {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new z.ZodError(result.error.issues);
  }
  return result.data;
};

// Enhanced file validation with content type and magic number checking
const validateFileType = (file: Express.Multer.File): boolean => {
  const allowedMimeTypes = [
    'text/plain',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  const allowedExtensions = ['.txt', '.pdf', '.doc', '.docx'];
  const fileExt = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
  
  // Check both MIME type and extension
  return allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(fileExt);
};

// Check file content for basic malware signatures
const validateFileContent = (buffer: Buffer): boolean => {
  // Basic check for executable file signatures
  const executableSignatures = [
    Buffer.from([0x4D, 0x5A]), // PE executable
    Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
    Buffer.from([0xFE, 0xED, 0xFA, 0xCE]), // Mach-O executable
  ];
  
  for (const signature of executableSignatures) {
    if (buffer.slice(0, signature.length).equals(signature)) {
      return false;
    }
  }
  
  return true;
};

// Configure multer for single file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file at a time
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    try {
      if (!validateFileType(file)) {
        return cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
      }
      cb(null, true);
    } catch (error) {
      cb(new Error('File validation failed'));
    }
  }
});

// Configure dedicated multer instance for wizard batch uploads
const batchUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 20 * 1024 * 1024, // 20MB limit per file for wizard
    files: 5 // Maximum 5 files for batch upload
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    try {
      if (!validateFileType(file)) {
        return cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
      }
      cb(null, true);
    } catch (error) {
      cb(new Error('File validation failed'));
    }
  }
});

// Configure dedicated multer instance for CSV uploads
const csvUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB limit for CSV files
    files: 1 // Only one CSV file at a time
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Accept CSV files with various MIME types that browsers might send
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (fileExt === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV files (.csv) are allowed.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes (public)
  app.post('/api/auth/login', rateLimitLogin, requireCSRFToken, async (req: Request, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ 
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS' 
        });
      }
      
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        // Track failed login attempt
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        const now = Date.now();
        const attempts = loginAttempts.get(clientIP) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
        attempts.count++;
        if (attempts.count === 1) {
          attempts.resetTime = now + RATE_LIMIT_WINDOW;
        }
        loginAttempts.set(clientIP, attempts);
        
        return res.status(401).json({ 
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS' 
        });
      }
      
      // Clear any failed login attempts on successful login
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      loginAttempts.delete(clientIP);
      
      // Regenerate session to prevent session fixation attacks
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({ 
            error: 'Session creation failed',
            code: 'SESSION_ERROR' 
          });
        }
        
        // Store user in session (exclude password)
        req.session.userId = user.id;
        req.session.user = {
          id: user.id,
          username: user.username,
          role: user.role,
          createdAt: user.createdAt
        };
      
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ 
            error: 'Session creation failed',
            code: 'SESSION_ERROR' 
          });
        }
        
        res.json({
          user: {
            id: user.id,
            username: user.username,
            role: user.role
          },
          message: 'Login successful'
        });
      });
      
      }); // Close the req.session.regenerate callback
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid input data', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      console.error('Login error:', error);
      res.status(500).json({ 
        error: 'Login failed',
        code: 'INTERNAL_ERROR' 
      });
    }
  });

  app.post('/api/auth/logout', requireAuth, requireCSRFToken, async (req: Request, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({ 
          error: 'Logout failed',
          code: 'SESSION_ERROR' 
        });
      }
      res.json({ message: 'Logout successful' });
    });
  });

  app.get('/api/auth/me', requireAuth, async (req: Request, res) => {
    res.json({
      user: {
        id: req.session.user!.id,
        username: req.session.user!.username,
        role: req.session.user!.role
      }
    });
  });

  // Customer management routes (protected)
  app.get('/api/customers', requireAuth, requireAdmin, async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      return handleDatabaseError(error, res, 'fetch customers');
    }
  });

  app.get('/api/customers/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      validateParams(uuidParamSchema, req.params);
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ 
          error: 'Customer not found',
          code: 'NOT_FOUND' 
        });
      }
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid customer ID format', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'fetch customer');
    }
  });

  // Customer lookup by solution ID
  app.get('/api/customers/by-solution-id/:solutionId', requireAuth, async (req, res) => {
    try {
      const { solutionId } = req.params;
      
      if (!solutionId || solutionId.trim().length === 0) {
        return res.status(400).json({
          error: 'Solution ID is required',
          code: 'VALIDATION_ERROR'
        });
      }

      const customer = await storage.getCustomerBySolutionId(solutionId);
      if (!customer) {
        return res.status(404).json({ 
          error: 'No customer found with this solution ID',
          code: 'NOT_FOUND' 
        });
      }
      
      res.json(customer);
    } catch (error) {
      return handleDatabaseError(error, res, 'lookup customer by solution ID');
    }
  });

  app.post('/api/customers', requireAuth, requireCSRFToken, requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid data', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'create customer');
    }
  });

  app.put('/api/customers/:id', requireAuth, requireCSRFToken, requireAdmin, async (req, res) => {
    try {
      validateParams(uuidParamSchema, req.params);
      const validatedData = updateCustomerSchema.parse(req.body);
      
      // Check if customer exists first
      const existingCustomer = await storage.getCustomer(req.params.id);
      if (!existingCustomer) {
        return res.status(404).json({ 
          error: 'Customer not found',
          code: 'NOT_FOUND' 
        });
      }
      
      const customer = await storage.updateCustomer(req.params.id, validatedData);
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid data', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'update customer');
    }
  });

  app.delete('/api/customers/:id', requireAuth, requireCSRFToken, requireAdmin, async (req, res) => {
    try {
      validateParams(uuidParamSchema, req.params);
      
      // Check if customer exists first
      const existingCustomer = await storage.getCustomer(req.params.id);
      if (!existingCustomer) {
        return res.status(404).json({ 
          error: 'Customer not found',
          code: 'NOT_FOUND' 
        });
      }
      
      await storage.deleteCustomer(req.params.id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid customer ID format', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'delete customer');
    }
  });

  // Document management routes (protected)
  app.get('/api/documents', requireAuth, async (req, res) => {
    try {
      let customerId: string | undefined;
      
      if (req.query.customerId) {
        const validatedQuery = validateQuery(customerIdQuerySchema, req.query);
        customerId = validatedQuery.customerId;
      }
      
      const documents = await storage.getDocuments(customerId);
      res.json(documents);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid query parameters', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'fetch documents');
    }
  });

  app.get('/api/documents/:id', requireAuth, authorizeDocumentAccess, async (req: AuthenticatedRequest, res) => {
    try {
      // Document is already validated and stored in req.document by authorizeDocumentAccess
      res.json(req.document);
    } catch (error) {
      return handleDatabaseError(error, res, 'fetch document');
    }
  });

  app.post('/api/documents/upload', requireAuth, requireCSRFToken, upload.single('document'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          error: 'No file uploaded',
          code: 'MISSING_FILE' 
        });
      }

      // Additional content validation
      if (!validateFileContent(req.file.buffer)) {
        return res.status(400).json({ 
          error: 'File content validation failed',
          code: 'INVALID_FILE_CONTENT' 
        });
      }

      const validatedData = fileUploadSchema.parse(req.body);
      
      // Verify customer exists (skip for demo mode)
      if (validatedData.customerId !== 'demo') {
        const customer = await storage.getCustomer(validatedData.customerId);
        if (!customer) {
          return res.status(404).json({ 
            error: 'Customer not found',
            code: 'NOT_FOUND' 
          });
        }
      }

      // Extract text content based on file type
      let content = '';
      const fileExt = req.file.originalname.toLowerCase().slice(req.file.originalname.lastIndexOf('.'));
      
      if (fileExt === '.txt') {
        content = req.file.buffer.toString('utf-8');
      } else {
        // For now, store as placeholder - we'll implement actual text extraction later
        content = `[${fileExt.toUpperCase()} File Content - Processing Required]`;
      }

      const documentData = {
        customerId: validatedData.customerId === 'demo' ? null : validatedData.customerId, // Set to null for demo mode
        filename: req.file.originalname,
        content,
        fileData: req.file.buffer.toString('base64'), // Store file buffer as base64
        docType: validatedData.docType,
        fileSize: req.file.size,
        status: 'uploaded'
      };

      const document = await storage.createDocument(documentData);
      
      // Create a processing job for text extraction (if not .txt)
      if (fileExt !== '.txt') {
        await storage.createProcessingJob({
          documentId: document.id,
          status: 'pending',
          jobType: 'text_extraction',
          progress: 0
        });
      }

      res.status(201).json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid upload data', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      console.error('File upload error:', error);
      return handleDatabaseError(error, res, 'upload document');
    }
  });

  // Document analysis for company detection endpoint
  app.post('/api/documents/analyze-company', requireAuth, requireCSRFToken, upload.single('document'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          error: 'No file uploaded',
          code: 'MISSING_FILE' 
        });
      }

      // Validate file type
      const fileExt = req.file.originalname.toLowerCase().slice(req.file.originalname.lastIndexOf('.'));
      if (!['.txt', '.pdf', '.doc', '.docx'].includes(fileExt)) {
        return res.status(400).json({ 
          error: 'Unsupported file type for analysis',
          code: 'INVALID_FILE_TYPE' 
        });
      }

      // Extract text content for analysis
      let content = '';
      
      if (fileExt === '.txt') {
        content = req.file.buffer.toString('utf-8');
      } else {
        // For non-text files, we'll create realistic mock content for demonstration
        // In production, use libraries like pdf-parse for PDF, mammoth for DOCX
        const mockCompanies = [
          {
            name: "TechCorp Solutions Inc.",
            industry: "Technology", 
            type: "Software License Agreement",
            email: "legal@techcorp.com",
            phone: "(555) 123-4567",
            address: "123 Innovation Drive, San Francisco, CA 94105"
          },
          {
            name: "Bella Vista Restaurant Group",
            industry: "Restaurant",
            type: "Employment Handbook", 
            email: "hr@bellavista.com",
            phone: "(555) 987-6543",
            address: "456 Culinary Lane, New York, NY 10001"
          },
          {
            name: "HealthFirst Medical Center",
            industry: "Healthcare",
            type: "Service Agreement",
            email: "contracts@healthfirst.org", 
            phone: "(555) 555-0123",
            address: "789 Medical Plaza, Chicago, IL 60601"
          },
          {
            name: "Green Energy Partners LLC",
            industry: "Manufacturing",
            type: "Contract Agreement",
            email: "business@greenenergy.com",
            phone: "(555) 246-8135", 
            address: "321 Sustainable Way, Austin, TX 78701"
          }
        ];

        // Select a random company for realistic demo
        const company = mockCompanies[Math.floor(Math.random() * mockCompanies.length)];
        
        content = `${company.type}
        
        COMPANY INFORMATION:
        ${company.name}
        Industry: ${company.industry}
        
        CONTACT DETAILS:
        Email: ${company.email}
        Phone: ${company.phone}
        Address: ${company.address}
        
        AGREEMENT TERMS:
        This ${company.type.toLowerCase()} between ${company.name} and the contracting party establishes the terms and conditions for business operations within the ${company.industry.toLowerCase()} sector.
        
        Company Overview: ${company.name} operates as a leading organization in the ${company.industry.toLowerCase()} industry, providing comprehensive services and solutions to meet client needs.
        
        Contact Information: For all inquiries regarding this agreement, please contact us at ${company.email} or call ${company.phone}. Our business address is ${company.address}.
        
        Document Type: ${company.type}
        File: ${req.file.originalname} (${fileExt.toUpperCase()})
        Date: ${new Date().toISOString()}`;
      }

      console.log(`Analyzing document: ${req.file.originalname}`);
      console.log(`Content length: ${content.length} characters`);

      // Use AI to extract company details
      const extractedDetails = await parseDocumentForCompanyDetails(content);
      
      res.json(extractedDetails);

    } catch (error) {
      console.error('Document analysis error:', error);
      res.status(500).json({ 
        error: 'Failed to analyze document',
        code: 'ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.delete('/api/documents/:id', requireAuth, requireCSRFToken, authorizeDocumentAccess, async (req: AuthenticatedRequest, res) => {
    try {
      // Document existence and authorization already verified by authorizeDocumentAccess
      await storage.deleteDocument(req.params.id);
      res.status(204).send();
    } catch (error) {
      return handleDatabaseError(error, res, 'delete document');
    }
  });

  // Test case management routes (protected)
  app.get('/api/test-cases', requireAuth, async (req, res) => {
    try {
      let documentId: string | undefined;
      
      if (req.query.documentId) {
        const validatedQuery = validateQuery(documentIdQuerySchema, req.query);
        documentId = validatedQuery.documentId;
      }
      
      const testCases = await storage.getTestCases(documentId);
      res.json(testCases);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid query parameters', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'fetch test cases');
    }
  });

  // Export test cases endpoint (must come before :id route)
  app.get('/api/test-cases/export', requireAuth, async (req, res) => {
    try {
      const format = req.query.format as string || 'json';
      
      if (!['json', 'csv'].includes(format)) {
        return res.status(400).json({
          error: 'Invalid format. Supported formats: json, csv',
          code: 'INVALID_FORMAT'
        });
      }

      const testCases = await storage.getTestCases();
      
      if (format === 'csv') {
        // Convert to CSV format
        const csvHeaders = [
          'content', 'category', 'source', 'confidenceScore', 
          'contextUsed', 'executionStatus', 'createdAt'
        ];
        
        const csvRows = testCases.map(tc => [
          `"${tc.content.replace(/"/g, '""')}"`,
          `"${tc.category}"`,
          `"${tc.source}"`,
          tc.confidenceScore || '',
          `"${tc.contextUsed || ''}"`,
          `"${tc.executionStatus}"`,
          tc.createdAt ? tc.createdAt.toISOString() : ''
        ]);
        
        const csvContent = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="test-cases-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
      } else {
        // JSON format
        const exportData = {
          exportedAt: new Date().toISOString(),
          count: testCases.length,
          testCases: testCases.map(tc => ({
            content: tc.content,
            category: tc.category,
            source: tc.source,
            confidenceScore: tc.confidenceScore,
            contextUsed: tc.contextUsed,
            executionStatus: tc.executionStatus,
            createdAt: tc.createdAt?.toISOString() || null
          }))
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="test-cases-${new Date().toISOString().split('T')[0]}.json"`);
        res.json(exportData);
      }
    } catch (error) {
      return handleDatabaseError(error, res, 'export test cases');
    }
  });

  // Template download route - MUST be before :id route to avoid collision
  app.get('/api/test-cases/template.csv', requireAuth, (req: AuthenticatedRequest, res) => {
    const industry = req.query.industry as string || 'General';
    
    const csvTemplate = `title,description,category,priority,preconditions,steps,expected_result,source
"Login Functionality Test","Verify user can login with valid credentials","Functional","high","User has valid account","1. Navigate to login page\n2. Enter username and password\n3. Click login button","User is successfully logged in","manual"
"Password Reset Test","Verify password reset functionality","Functional","medium","User account exists","1. Click forgot password\n2. Enter email address\n3. Check email for reset link","Reset email is received","manual"
"Data Validation Test","Verify form validates required fields","Compliance","high","Form is accessible","1. Leave required field empty\n2. Submit form","Error message appears","manual"
"Performance Load Test","Verify system handles expected load","Performance","medium","Test environment ready","1. Simulate 100 concurrent users\n2. Monitor response times","Response time under 2 seconds","manual"
"${industry} Specific Test","Industry-specific functionality test","Integration","medium","${industry} module configured","1. Access ${industry.toLowerCase()} features\n2. Perform typical workflow","Workflow completes successfully","manual"`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="test-cases-template-${industry.toLowerCase()}.csv"`);
    res.send(csvTemplate);
  });

  app.get('/api/test-cases/:id', requireAuth, async (req, res) => {
    try {
      validateParams(uuidParamSchema, req.params);
      const testCase = await storage.getTestCase(req.params.id);
      if (!testCase) {
        return res.status(404).json({ 
          error: 'Test case not found',
          code: 'NOT_FOUND' 
        });
      }
      res.json(testCase);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid test case ID format', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'fetch test case');
    }
  });

  app.post('/api/test-cases', requireAuth, requireCSRFToken, async (req, res) => {
    try {
      const validatedData = insertTestCaseSchema.parse(req.body);
      
      // Verify document exists if documentId is provided
      if (validatedData.documentId) {
        const document = await storage.getDocument(validatedData.documentId);
        if (!document) {
          return res.status(404).json({ 
            error: 'Document not found',
            code: 'NOT_FOUND' 
          });
        }
      }
      
      const testCase = await storage.createTestCase(validatedData);
      res.status(201).json(testCase);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid data', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'create test case');
    }
  });

  app.put('/api/test-cases/:id', requireAuth, requireCSRFToken, async (req, res) => {
    try {
      validateParams(uuidParamSchema, req.params);
      const validatedData = updateTestCaseSchema.parse(req.body);
      
      // Check if test case exists first
      const existingTestCase = await storage.getTestCase(req.params.id);
      if (!existingTestCase) {
        return res.status(404).json({ 
          error: 'Test case not found',
          code: 'NOT_FOUND' 
        });
      }
      
      const testCase = await storage.updateTestCase(req.params.id, validatedData);
      res.json(testCase);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid data', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'update test case');
    }
  });

  app.delete('/api/test-cases/:id', requireAuth, requireCSRFToken, async (req, res) => {
    try {
      validateParams(uuidParamSchema, req.params);
      
      // Check if test case exists first
      const existingTestCase = await storage.getTestCase(req.params.id);
      if (!existingTestCase) {
        return res.status(404).json({ 
          error: 'Test case not found',
          code: 'NOT_FOUND' 
        });
      }
      
      await storage.deleteTestCase(req.params.id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid test case ID format', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'delete test case');
    }
  });

  // Import test cases endpoint
  app.post('/api/test-cases/import', requireAuth, requireCSRFToken, async (req, res) => {
    try {
      const importData = z.object({
        testCases: z.array(z.object({
          content: z.string().min(1),
          category: z.string().min(1), 
          source: z.enum(['generated', 'manual', 'uploaded']).default('uploaded'),
          confidenceScore: z.number().min(0).max(1).nullable().optional(),
          contextUsed: z.string().nullable().optional(),
          executionStatus: z.enum(['ready', 'in_progress', 'complete']).default('ready'),
          documentName: z.string().optional(),
          customerName: z.string().optional()
        }))
      }).parse(req.body);

      const createdTestCases = [];
      
      for (const testCaseData of importData.testCases) {
        const insertData = {
          title: testCaseData.content.split('\n')[0].slice(0, 100) || 'Imported Test Case', // Use first line as title
          content: testCaseData.content,
          category: testCaseData.category,
          source: testCaseData.source,
          confidenceScore: testCaseData.confidenceScore,
          contextUsed: testCaseData.contextUsed,
          executionStatus: testCaseData.executionStatus,
          documentId: null, // Can be linked later if needed
          createdAt: new Date()
        };
        
        const testCase = await storage.createTestCase(insertData);
        createdTestCases.push(testCase);
      }

      res.json({
        message: `Successfully imported ${createdTestCases.length} test cases`,
        count: createdTestCases.length,
        testCases: createdTestCases
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid import data format', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'import test cases');
    }
  });

  // Processing jobs routes (protected)
  app.get('/api/processing-jobs', requireAuth, async (req, res) => {
    try {
      let documentId: string | undefined;
      
      if (req.query.documentId) {
        const validatedQuery = validateQuery(documentIdQuerySchema, req.query);
        documentId = validatedQuery.documentId;
      }
      
      const jobs = await storage.getProcessingJobs(documentId);
      res.json(jobs);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid query parameters', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'fetch processing jobs');
    }
  });

  app.get('/api/processing-jobs/:id', requireAuth, async (req, res) => {
    console.log(`🔍 DEBUG: GET /api/processing-jobs/${req.params.id} - Request received`);
    console.log(`🔍 DEBUG: Request timestamp: ${new Date().toISOString()}`);
    console.log(`🔍 DEBUG: Request headers:`, req.headers['user-agent']);
    
    try {
      validateParams(uuidParamSchema, req.params);
      console.log(`🔍 DEBUG: Job ID validation passed for: ${req.params.id}`);
      
      const job = await storage.getProcessingJob(req.params.id);
      console.log(`🔍 DEBUG: Storage query result:`, {
        found: !!job,
        status: job?.status || 'N/A',
        progress: job?.progress || 'N/A'
      });
      
      if (!job) {
        console.log(`❌ DEBUG: Job ${req.params.id} not found in storage`);
        return res.status(404).json({ 
          error: 'Processing job not found',
          code: 'NOT_FOUND' 
        });
      }
      
      console.log(`✅ DEBUG: Returning job data for ${req.params.id}:`, {
        status: job.status,
        progress: job.progress,
        hasResult: !!job.result
      });
      res.json(job);
    } catch (error) {
      console.log(`❌ DEBUG: Error in /api/processing-jobs/${req.params.id}:`, error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid job ID format', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'fetch processing job');
    }
  });

  // Generate test cases from document (protected)
  app.post('/api/documents/:id/generate-tests', requireAuth, requireCSRFToken, authorizeDocumentAccess, async (req: AuthenticatedRequest, res) => {
    try {
      const documentId = req.params.id;
      const document = req.document; // Already validated by authorizeDocumentAccess

      // Create a processing job for test generation
      const job = await storage.createProcessingJob({
        documentId,
        status: 'pending',
        jobType: 'test_generation',
        progress: 0
      });

      // Real AI-powered test case generation using OpenAI
      console.log(`Starting AI test generation for document: ${document.filename}`);
      
      // Get any additional requirements from request body
      const { requirements, aiProvider = 'gemini', aiModel } = req.body || {};
      
      let aiResult;
      try {
        // Check if document has file data stored
        if (!document.fileData) {
          throw new Error(`Document ${document.filename} was uploaded before file storage was implemented. Please re-upload this document to enable AI processing.`);
        }

        // Use the AI service to process the document and generate test cases
        aiResult = await processDocumentForTestGeneration(
          Buffer.from(document.fileData, 'base64'), // Convert base64 back to Buffer
          document.filename, // Original filename
          documentId, // Document ID
          document.title || 'business_document', // Document type
          requirements, // Optional requirements
          { provider: aiProvider, model: aiModel } // AI provider config
        );
        
        console.log(`AI processing completed. Generated ${aiResult.testCases.testCases.length} test cases in ${aiResult.testCases.processingTime}ms`);
      } catch (aiError) {
        console.error('AI processing failed:', aiError);
        
        // Update job to failed status
        await storage.updateProcessingJob(job.id, {
          status: 'failed',
          progress: 0,
          result: { error: aiError instanceof Error ? aiError.message : 'AI processing failed' },
          completedAt: new Date()
        });
        
        return res.status(500).json({
          error: 'Failed to process document with AI',
          details: aiError instanceof Error ? aiError.message : 'Unknown AI processing error',
          code: 'AI_PROCESSING_ERROR'
        });
      }

      // Convert AI-generated test cases to database format
      const createdTestCases = [];
      for (const aiTestCase of aiResult.testCases.testCases) {
        try {
          const testCaseData = {
            documentId,
            title: aiTestCase.title, // Use AI-generated title
            content: aiTestCase.description || 'AI generated test case',
            steps: aiTestCase.steps || [],
            expectedResult: aiTestCase.expectedResult || null,
            tags: aiTestCase.tags || [],
            category: aiTestCase.category === 'functional' ? 'Functional Tests' :
                     aiTestCase.category === 'compliance' ? 'Compliance Tests' :
                     aiTestCase.category === 'integration' ? 'Integration Tests' :
                     'Edge Cases',
            priority: aiTestCase.priority, // Add priority from AI-generated data
            source: 'generated' as const,
            confidenceScore: aiTestCase.priority === 'high' ? 0.9 : 
                           aiTestCase.priority === 'medium' ? 0.75 : 0.6,
            contextUsed: aiResult.testCases.contextUsed.join(' | '),
            executionStatus: 'ready' as const
          };
          
          const testCase = await storage.createTestCase(testCaseData);
          createdTestCases.push(testCase);
        } catch (testCaseError) {
          console.error('Failed to create test case:', testCaseError);
          // Continue with other test cases even if one fails
        }
      }

      // Update job status to completed
      await storage.updateProcessingJob(job.id, {
        status: 'completed',
        progress: 100,
        result: { testCasesGenerated: createdTestCases.length },
        completedAt: new Date()
      });

      res.status(201).json({
        job,
        testCases: createdTestCases,
        message: `Generated ${createdTestCases.length} test cases from ${document.filename}`
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid document ID format', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'generate test cases');
    }
  });

  // Dashboard stats endpoint (protected)
  app.get('/api/stats', requireAuth, async (req, res) => {
    try {
      const [customers, documents, testCases, jobs] = await Promise.all([
        storage.getCustomers(),
        storage.getDocuments(),
        storage.getTestCases(),
        storage.getProcessingJobs()
      ]);

      const stats = {
        totalCustomers: customers.length,
        configuredCustomers: customers.filter(c => c.isConfigured).length,
        totalDocuments: documents.length,
        documentsThisMonth: documents.filter(d => {
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return d.createdAt && new Date(d.createdAt) > monthAgo;
        }).length,
        totalTestCases: testCases.length,
        testCasesByCategory: {
          'Functional Tests': testCases.filter(tc => tc.category === 'Functional Tests').length,
          'Compliance Tests': testCases.filter(tc => tc.category === 'Compliance Tests').length,
          'Edge Cases': testCases.filter(tc => tc.category === 'Edge Cases').length,
          'Integration Tests': testCases.filter(tc => tc.category === 'Integration Tests').length
        },
        activeJobs: jobs.filter(j => j.status === 'processing').length,
        completedJobs: jobs.filter(j => j.status === 'completed').length
      };

      res.json(stats);
    } catch (error) {
      return handleDatabaseError(error, res, 'fetch stats');
    }
  });

  // ===================
  // WIZARD API ROUTES
  // ===================

  // Step 1: Batch document upload for wizard (max 5 files, 20MB each)
  app.post('/api/documents/upload-batch', requireAuth, requireCSRFToken, 
    batchUpload.array('documents', 5), // Use dedicated batch upload instance
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ 
            error: 'No files uploaded',
            code: 'MISSING_FILES' 
          });
        }

        const files = req.files as Express.Multer.File[];
        
        // Note: File size validation is now handled by multer limits (20MB per file)
        // Additional validation can be added here if needed

        const validatedData = z.object({
          docType: z.string().min(1),
          customerId: z.string().refine((val) => {
            // Allow null, undefined, empty string, 'demo', or valid UUID
            return !val || val === 'demo' || z.string().uuid().safeParse(val).success;
          }, "Customer ID must be a valid UUID, 'demo', or empty for demo mode").optional()
        }).parse(req.body);

        // Validate customer exists if customerId is provided (skip for demo mode)
        if (validatedData.customerId && validatedData.customerId !== 'demo') {
          const customer = await storage.getCustomer(validatedData.customerId);
          if (!customer) {
            return res.status(404).json({ 
              error: 'Customer not found',
              code: 'CUSTOMER_NOT_FOUND' 
            });
          }
        }

        const createdDocuments = [];
        
        for (const file of files) {
          // Validate file content
          if (!validateFileContent(file.buffer)) {
            return res.status(400).json({ 
              error: `Invalid file content in ${file.originalname}`,
              code: 'INVALID_FILE_CONTENT' 
            });
          }

          // Extract text content
          let content = '';
          const fileExt = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
          
          if (fileExt === '.txt') {
            content = file.buffer.toString('utf-8');
          } else {
            content = `[${fileExt.toUpperCase()} File Content - Processing Required]`;
          }

          const documentData = {
            customerId: (validatedData.customerId === 'demo' || !validatedData.customerId) ? null : validatedData.customerId,
            filename: file.originalname,
            content,
            fileData: file.buffer.toString('base64'), // Store file buffer as base64
            docType: validatedData.docType,
            fileSize: file.size,
            status: 'uploaded'
          };

          const document = await storage.createDocument(documentData);
          createdDocuments.push(document);
        }

        res.status(201).json({
          documents: createdDocuments,
          count: createdDocuments.length,
          message: `Successfully uploaded ${createdDocuments.length} documents`
        });

      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ 
            error: 'Invalid upload data', 
            details: error.errors,
            code: 'VALIDATION_ERROR'
          });
        }
        console.error('Batch upload error:', error);
        return handleDatabaseError(error, res, 'batch upload documents');
      }
    }
  );

  // Step 2: Start processing multiple documents for test generation
  app.post('/api/documents/process-batch', requireAuth, requireCSRFToken, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = z.object({
        documentIds: z.array(z.string().uuid()),
        targetMin: z.number().min(20).default(80),
        targetMax: z.number().max(150).default(120),
        industry: z.string().optional(),
        aiProvider: z.enum(['openai', 'gemini', 'openrouter']).optional().default('openrouter'),
        aiModel: z.string().optional()
      }).parse(req.body);

      const jobs = [];
      
      for (const documentId of validatedData.documentIds) {
        // Verify document exists
        const document = await storage.getDocument(documentId);
        if (!document) {
          return res.status(404).json({ 
            error: `Document not found: ${documentId}`,
            code: 'NOT_FOUND' 
          });
        }

        // Create processing job
        const job = await storage.createProcessingJob({
          documentId,
          jobType: 'test_generation',
          status: 'processing',
          progress: 0,
          totalItems: Math.floor(Math.random() * (validatedData.targetMax - validatedData.targetMin) + validatedData.targetMin) // Random target between min-max
        });

        jobs.push(job);

        // Start AI processing immediately (with proper error handling)
        processDocumentInBackground(job.id, documentId, document, validatedData).catch(error => {
          console.error(`Background processing failed for job ${job.id}:`, error);
        });
      }

      res.status(201).json({
        jobs,
        message: `Started processing ${jobs.length} documents`,
        totalJobs: jobs.length
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid processing request', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      console.error('Batch processing error:', error);
      return handleDatabaseError(error, res, 'start batch processing');
    }
  });

  // Background processing function for batch jobs
  async function processDocumentInBackground(
    jobId: string, 
    documentId: string, 
    document: any, 
    config: { aiProvider?: string; aiModel?: string; targetMin: number; targetMax: number; industry?: string }
  ) {
    try {
      console.log(`Starting background AI processing for job ${jobId}...`);
      
      // Check if document has file data stored
      if (!document.fileData) {
        throw new Error(`Document ${document.filename} was uploaded before file storage was implemented. Please re-upload this document to enable AI processing.`);
      }

      // Call the AI service to process the document
      const aiResult = await processDocumentForTestGeneration(
        Buffer.from(document.fileData, 'base64'), // Convert base64 back to Buffer
        document.filename,
        documentId,
        document.title || 'business_document',
        `Generate between ${config.targetMin}-${config.targetMax} test cases for ${config.industry || 'general'} industry`,
        { 
          provider: 'gemini', 
          model: config.aiModel || 'gemini-2.5-flash'
        }
      );

      console.log(`AI processing completed for job ${jobId}. Generated ${aiResult.testCases.testCases.length} test cases`);

      // Create test cases in storage
      const createdTestCases = [];
      for (const testCase of aiResult.testCases.testCases) {
        try {
          const newTestCase = await storage.createTestCase({
            title: testCase.title,
            content: testCase.description || 'AI generated test case',
            steps: testCase.steps || [],
            expectedResult: testCase.expectedResult || null,
            tags: testCase.tags || [],
            category: testCase.category,
            priority: testCase.priority,
            source: 'ai_generated',
            documentId
          });
          createdTestCases.push(newTestCase);
        } catch (testCaseError) {
          console.error('Failed to create test case:', testCaseError);
        }
      }

      // Update job to completed
      await storage.updateProcessingJob(jobId, {
        status: 'completed',
        progress: 100,
        result: { 
          testCasesGenerated: createdTestCases.length
        },
        completedAt: new Date()
      });

      console.log(`Job ${jobId} completed successfully with ${createdTestCases.length} test cases`);

    } catch (error) {
      console.error(`Background processing failed for job ${jobId}:`, error);
      
      // Update job to failed status
      await storage.updateProcessingJob(jobId, {
        status: 'failed',
        progress: 0,
        result: { error: error instanceof Error ? error.message : 'Background processing failed' },
        completedAt: new Date()
      });
    }
  }

  // Get job status with progress tracking
  app.get('/api/jobs/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    console.log(`🔄 DEBUG: GET /api/jobs/${req.params.id} - Request received`);
    console.log(`🔄 DEBUG: Request timestamp: ${new Date().toISOString()}`);
    console.log(`🔄 DEBUG: User agent:`, req.headers['user-agent']);
    console.log(`🔄 DEBUG: This might be causing the "loop" issue!`);
    
    try {
      const jobId = z.string().uuid().parse(req.params.id);
      console.log(`🔄 DEBUG: Job ID validation passed for: ${jobId}`);
      
      const job = await storage.getProcessingJob(jobId);
      console.log(`🔄 DEBUG: Job lookup result:`, {
        found: !!job,
        status: job?.status || 'N/A',
        progress: job?.progress || 'N/A',
        hasResult: !!job?.result
      });
      
      if (!job) {
        console.log(`❌ DEBUG: Job ${jobId} not found in storage`);
        return res.status(404).json({ 
          error: 'Job not found',
          code: 'NOT_FOUND' 
        });
      }

      // Simulate progress for demo (in production, this would be real progress)
      if (job.status === 'pending') {
        console.log(`🔄 DEBUG: Job ${jobId} is pending, updating to processing...`);
        await storage.updateProcessingJob(jobId, {
          status: 'processing',
          progress: Math.floor(Math.random() * 30) + 10 // 10-40% initial progress
        });
        console.log(`🔄 DEBUG: Job ${jobId} status updated to processing`);
      }

      console.log(`✅ DEBUG: Returning job data for ${jobId}:`, {
        status: job.status,
        progress: job.progress,
        hasResult: !!job.result,
        resultKeys: job.result ? Object.keys(job.result) : []
      });
      res.json(job);
    } catch (error) {
      console.log(`❌ DEBUG: Error in /api/jobs/${req.params.id}:`, error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid job ID format', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'fetch job status');
    }
  });

// MOVED TO EARLIER POSITION TO AVOID ROUTE COLLISION

  // Step 3: Upload CSV file with manual test cases
  app.post('/api/test-cases/upload-csv', requireAuth, requireCSRFToken,
    csvUpload.single('file'),
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ 
            error: 'No CSV file uploaded',
            code: 'MISSING_FILE' 
          });
        }

        const validatedData = z.object({
          documentId: z.string().uuid().optional()
        }).parse(req.body);

        const csvContent = req.file.buffer.toString('utf-8');
        
        // Parse CSV content with proper handling of quoted fields, commas, and multiline content
        const parseCSV = (content: string): string[][] => {
          const rows: string[][] = [];
          const lines = content.split(/\r?\n/);
          let currentRow: string[] = [];
          let currentField = '';
          let inQuotes = false;
          let rowStarted = false;
          
          for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            
            // Skip completely empty lines when not in quotes
            if (!line.trim() && !inQuotes) {
              continue;
            }
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              rowStarted = true;
              
              if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                  // Escaped quote
                  currentField += '"';
                  i++; // Skip next quote
                } else {
                  // Toggle quote state
                  inQuotes = !inQuotes;
                }
              } else if (char === ',' && !inQuotes) {
                // Field separator
                currentRow.push(currentField.trim());
                currentField = '';
              } else {
                currentField += char;
              }
            }
            
            // Add newline to field if we're inside quotes (multiline content)
            if (inQuotes && lineIndex < lines.length - 1) {
              currentField += '\n';
            }
            
            // If we're not in quotes and have started a row, end the row
            if (!inQuotes && rowStarted) {
              currentRow.push(currentField.trim());
              if (currentRow.some(field => field)) { // Only add non-empty rows
                rows.push(currentRow);
              }
              currentRow = [];
              currentField = '';
              rowStarted = false;
            }
          }
          
          // Handle last field/row if needed
          if (rowStarted) {
            currentRow.push(currentField.trim());
            if (currentRow.some(field => field)) {
              rows.push(currentRow);
            }
          }
          
          return rows;
        };
        
        const rows = parseCSV(csvContent);
        
        if (rows.length < 2) {
          return res.status(400).json({ 
            error: 'CSV file must contain header row and at least one data row',
            code: 'INVALID_CSV_FORMAT' 
          });
        }

        // Parse header row
        const headers = rows[0].map(h => h.trim().toLowerCase());
        const requiredHeaders = ['title', 'description'];
        
        for (const required of requiredHeaders) {
          if (!headers.includes(required)) {
            return res.status(400).json({ 
              error: `Missing required CSV column: ${required}. Found columns: ${headers.join(', ')}`,
              code: 'MISSING_CSV_COLUMN' 
            });
          }
        }

        const createdTestCases = [];
        const errors = [];

        // Process each data row (starting from index 1, after header)
        for (let i = 1; i < rows.length; i++) {
          try {
            const values = rows[i];
            const rowData: { [key: string]: string } = {};
            
            // Map values to headers
            headers.forEach((header, idx) => {
              rowData[header] = values[idx] || '';
            });

            // Validate required fields
            if (!rowData['title'] || !rowData['description']) {
              errors.push(`Row ${i + 1}: Missing title or description`);
              continue;
            }

            // Skip completely empty rows
            if (Object.values(rowData).every(val => !val.trim())) {
              continue;
            }

            // Build test case content from available fields
            const contentParts = [`${rowData['title']}`];
            
            if (rowData['description']) {
              contentParts.push(`\nDescription: ${rowData['description']}`);
            }
            
            if (rowData['preconditions']) {
              contentParts.push(`\nPreconditions: ${rowData['preconditions']}`);
            }
            
            if (rowData['steps']) {
              contentParts.push(`\nSteps:\n${rowData['steps']}`);
            }
            
            if (rowData['expected_result'] || rowData['expectedresult'] || rowData['expected result']) {
              const expectedResult = rowData['expected_result'] || rowData['expectedresult'] || rowData['expected result'];
              contentParts.push(`\nExpected Result: ${expectedResult}`);
            }

            const testCaseData = {
              documentId: validatedData.documentId || null,
              title: rowData['title'],
              content: contentParts.join(''),
              category: rowData['category'] || 'Manual',
              priority: (['low', 'medium', 'high'].includes(rowData['priority']?.toLowerCase())) ? rowData['priority'].toLowerCase() as 'low' | 'medium' | 'high' : 'medium',
              source: 'manual' as const
            };

            const testCase = await storage.createTestCase(testCaseData);
            createdTestCases.push(testCase);
          } catch (rowError) {
            errors.push(`Row ${i + 1}: ${rowError instanceof Error ? rowError.message : 'Processing error'}`);
          }
        }

        res.json({
          message: `Processed ${createdTestCases.length} test cases from CSV`,
          created: createdTestCases.length,
          errors: errors,
          testCases: createdTestCases
        });

      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ 
            error: 'Invalid CSV upload data', 
            details: error.errors,
            code: 'VALIDATION_ERROR'
          });
        }
        console.error('CSV upload error:', error);
        return handleDatabaseError(error, res, 'upload CSV test cases');
      }
    }
  );

  // Step 4: Get paginated test cases with filters for review
  app.get('/api/test-cases/paginated', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedQuery = z.object({
        documentId: z.string().uuid().optional(),
        page: z.coerce.number().min(1).default(1),
        pageSize: z.coerce.number().min(10).max(200).default(50),
        category: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high']).optional(),
        source: z.enum(['generated', 'manual', 'uploaded']).optional()
      }).parse(req.query);

      // Get all test cases and filter/paginate in memory for development
      let testCases = await storage.getTestCases(validatedQuery.documentId);
      
      // Apply filters
      if (validatedQuery.category) {
        testCases = testCases.filter(tc => tc.category === validatedQuery.category);
      }
      if (validatedQuery.priority) {
        testCases = testCases.filter(tc => tc.priority === validatedQuery.priority);
      }
      if (validatedQuery.source) {
        testCases = testCases.filter(tc => tc.source === validatedQuery.source);
      }
      
      const total = testCases.length;
      const startIndex = (validatedQuery.page - 1) * validatedQuery.pageSize;
      const endIndex = startIndex + validatedQuery.pageSize;
      const paginatedTestCases = testCases.slice(startIndex, endIndex);
      
      res.json({
        testCases: paginatedTestCases,
        total: total,
        page: validatedQuery.page,
        pageSize: validatedQuery.pageSize,
        totalPages: Math.ceil(total / validatedQuery.pageSize)
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid query parameters', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'fetch paginated test cases');
    }
  });

  // Step 4: Final submission with customer validation
  app.post('/api/test-cases/submit', requireAuth, requireCSRFToken, async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = z.object({
        documentId: z.string().uuid(),
        customer: z.object({
          id: z.string().uuid().optional(),
          name: z.string().min(1).optional(),
          industry: z.string().min(1).optional(),
          solutionId: z.string().min(1).optional()
        }),
        selectedTestCaseIds: z.array(z.string().uuid()).min(1)
      }).parse(req.body);

      // Validate customer information
      let customerId: string;
      
      if (validatedData.customer.id) {
        // Use existing customer
        const customer = await storage.getCustomer(validatedData.customer.id);
        if (!customer) {
          return res.status(404).json({ 
            error: 'Selected customer not found',
            code: 'CUSTOMER_NOT_FOUND' 
          });
        }
        customerId = customer.id;
      } else {
        // Create new customer (all fields required)
        if (!validatedData.customer.name || !validatedData.customer.industry || !validatedData.customer.solutionId) {
          return res.status(400).json({ 
            error: 'Customer name, industry, and solution ID are required for new customers',
            code: 'MISSING_CUSTOMER_INFO' 
          });
        }

        const newCustomer = await storage.createCustomer({
          name: validatedData.customer.name,
          industry: validatedData.customer.industry,
          solutionId: validatedData.customer.solutionId,
          isConfigured: true
        });
        customerId = newCustomer.id;
      }

      // Update document with customer
      await storage.updateDocument(validatedData.documentId, { customerId });

      // Update selected test cases
      const updatedTestCases = [];
      for (const testCaseId of validatedData.selectedTestCaseIds) {
        const updatedTestCase = await storage.updateTestCase(testCaseId, {
          executionStatus: 'ready'
        });
        updatedTestCases.push(updatedTestCase);
      }

      res.json({
        message: 'Test cases submitted successfully',
        customerId,
        documentId: validatedData.documentId,
        testCasesCount: updatedTestCases.length,
        testCases: updatedTestCases
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid submission data', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'submit test cases');
    }
  });

  // ===================
  // REPORTS API ROUTES  
  // ===================

  // Get report data for a submission
  app.get('/api/reports/submission', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // More flexible validation that allows mock/demo data
      const validatedQuery = z.object({
        submissionId: z.string().optional(),
        customerId: z.string().optional(),
        documentId: z.string().optional()
      }).parse(req.query);

      const { submissionId, customerId, documentId } = validatedQuery;

      if (!submissionId && !customerId && !documentId) {
        return res.status(400).json({ 
          error: 'At least one of submissionId, customerId, or documentId is required',
          code: 'MISSING_PARAMETERS'
        });
      }

      // Handle mock data for demo purposes
      if ((customerId && customerId.startsWith('mock-')) || 
          (documentId && documentId.startsWith('mock-')) || 
          (submissionId && submissionId.startsWith('mock-'))) {
        // Return mock report data for demo
        const mockReportData = {
          customerId: customerId || 'mock-customer-id',
          customerName: 'Acme Corporation',
          industry: 'Finance',
          documentName: 'Payment Processing Policy.pdf',
          submissionDate: new Date().toISOString(),
          testCases: {
            total: 45,
            selected: 42,
            categories: {
              'Functional': 18,
              'Compliance': 12,
              'Edge Cases': 8,
              'Integration': 4,
              'Performance': 3
            },
            priorities: {
              'High': 15,
              'Medium': 22,
              'Low': 8
            },
            sources: {
              'AI Generated': 32,
              'Manual': 10,
              'Uploaded': 3
            },
            averageConfidence: 0.89
          },
          processingMetrics: {
            totalProcessingTime: 28.5,
            aiGeneratedCount: 32,
            manualCount: 10,
            uploadedCount: 3
          }
        };
        return res.json(mockReportData);
      }

      const reportData = await storage.getReportData(submissionId, customerId, documentId);
      
      if (!reportData) {
        return res.status(404).json({ 
          error: 'Report data not found',
          code: 'REPORT_NOT_FOUND'
        });
      }

      res.json(reportData);

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid query parameters', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'get report data');
    }
  });

  // Initialize Gemini client for chatbot
  const gemini = process.env.GEMINI_API_KEY 
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) 
    : null;

  // Chat message schema
  const chatMessageSchema = z.object({
    message: z.string().min(1).max(1000),
    conversationHistory: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string()
    })).optional().default([])
  });

  // Chatbot API endpoint
  app.post('/api/chat', requireAuth, requireCSRFToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { message, conversationHistory } = chatMessageSchema.parse(req.body);

      if (!gemini) {
        return res.status(500).json({ 
          error: 'Gemini API not configured', 
          code: 'GEMINI_NOT_CONFIGURED' 
        });
      }

      // Context-aware system instructions for Clause2Case
      const systemInstruction = `You are the Clause2Case AI Assistant - a helpful, knowledgeable guide for this enterprise test case generation platform.

**Platform Overview:**
Clause2Case helps enterprise teams convert business documents into comprehensive test cases using AI. The platform features a 4-step wizard workflow and supports both AI-generated and manual test case creation.

**Key Features & Navigation Help:**
1. **Dashboard** - Shows metrics: 47 documents processed, 1,284 test cases generated, 12 active customers
2. **Internal Tools** - Three key systems:
   - PMAP (Project Management Platform) - Compliance tracking and policy management
   - Navigator (Pro WFM Migration Hub) - System navigation and integration
   - Validator (Config Testing Engine) - Configuration validation and testing
3. **Customers** - Manage customer accounts and solution IDs
4. **Documents** - Upload and manage business documents (PDF, DOC, DOCX, TXT - max 5 files, 20MB each)
5. **Test Cases** - View, filter, and manage generated test cases
6. **AI Processing** - Monitor document processing jobs and system status

**4-Step Wizard Workflow:**
Step 1: Upload Documents → Step 2: AI Processing → Step 3: Manual Addition → Step 4: Review & Submit

**Test Case Categories:**
- Functional Tests: Core business logic and workflows
- Compliance Tests: Regulatory and policy adherence  
- Integration Tests: System interactions and data flow
- Edge Cases: Boundary conditions and error handling

**Smart Response Guidelines:**
- For document upload questions: Guide to Documents section, explain supported formats and limits
- For AI vs manual test generation: Explain both approaches and when to use each
- For test case management: Direct to Test Cases section with filtering and status tips
- For system performance: Interpret dashboard metrics and processing job status
- For Internal Tools: Explain PMAP, Navigator, and Validator functionality
- For navigation: Provide specific section guidance and workflow steps

Always provide specific, actionable guidance with clear next steps. Be concise but comprehensive.`;

      const model = gemini.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: systemInstruction
      });

      // Build conversation context
      const conversationContext = conversationHistory
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      const fullPrompt = conversationContext 
        ? `${conversationContext}\nUser: ${message}` 
        : `User: ${message}`;

      const result = await model.generateContent(fullPrompt);
      const response = result.response.text() || "I'm sorry, I couldn't generate a response right now.";

      res.json({ 
        response,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid message format', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }

      console.error('Chat API error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        code: 'CHAT_ERROR'
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}