import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
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

// Extended Request interface for session support
interface AuthenticatedRequest extends Request {
  session: {
    userId?: string;
    user?: User;
    save: (callback?: (err?: any) => void) => void;
    destroy: (callback?: (err?: any) => void) => void;
  };
  file?: Express.Multer.File;
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

// File upload validation schema
const fileUploadSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID format"),
  docType: z.string().min(1, "Document type is required").max(100),
});

// Authentication middleware
const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.session.userId || !req.session.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'UNAUTHORIZED' 
    });
  }
  next();
};

// Admin role middleware
const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required',
      code: 'FORBIDDEN' 
    });
  }
  next();
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

// Configure enhanced multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file at a time
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    try {
      if (!validateFileType(file)) {
        return cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'));
      }
      cb(null, true);
    } catch (error) {
      cb(new Error('File validation failed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes (public)
  app.post('/api/auth/login', async (req: AuthenticatedRequest, res) => {
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
        return res.status(401).json({ 
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS' 
        });
      }
      
      // Store user in session
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

  app.post('/api/auth/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
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

  app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
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

  app.post('/api/customers', requireAuth, requireAdmin, async (req, res) => {
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

  app.put('/api/customers/:id', requireAuth, requireAdmin, async (req, res) => {
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

  app.delete('/api/customers/:id', requireAuth, requireAdmin, async (req, res) => {
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

  app.get('/api/documents/:id', requireAuth, async (req, res) => {
    try {
      validateParams(uuidParamSchema, req.params);
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ 
          error: 'Document not found',
          code: 'NOT_FOUND' 
        });
      }
      res.json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid document ID format', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
      return handleDatabaseError(error, res, 'fetch document');
    }
  });

  app.post('/api/documents/upload', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res) => {
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
      
      // Verify customer exists
      const customer = await storage.getCustomer(validatedData.customerId);
      if (!customer) {
        return res.status(404).json({ 
          error: 'Customer not found',
          code: 'NOT_FOUND' 
        });
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
        customerId: validatedData.customerId,
        filename: req.file.originalname,
        content,
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

  app.delete('/api/documents/:id', requireAuth, async (req, res) => {
    try {
      validateParams(uuidParamSchema, req.params);
      
      // Check if document exists first
      const existingDocument = await storage.getDocument(req.params.id);
      if (!existingDocument) {
        return res.status(404).json({ 
          error: 'Document not found',
          code: 'NOT_FOUND' 
        });
      }
      
      await storage.deleteDocument(req.params.id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid document ID format', 
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }
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

  app.post('/api/test-cases', requireAuth, async (req, res) => {
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

  app.put('/api/test-cases/:id', requireAuth, async (req, res) => {
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

  app.delete('/api/test-cases/:id', requireAuth, async (req, res) => {
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
    try {
      validateParams(uuidParamSchema, req.params);
      const job = await storage.getProcessingJob(req.params.id);
      if (!job) {
        return res.status(404).json({ 
          error: 'Processing job not found',
          code: 'NOT_FOUND' 
        });
      }
      res.json(job);
    } catch (error) {
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
  app.post('/api/documents/:id/generate-tests', requireAuth, async (req, res) => {
    try {
      validateParams(uuidParamSchema, req.params);
      const documentId = req.params.id;
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ 
          error: 'Document not found',
          code: 'NOT_FOUND' 
        });
      }

      // Create a processing job for test generation
      const job = await storage.createProcessingJob({
        documentId,
        status: 'pending',
        jobType: 'test_generation',
        progress: 0
      });

      // For now, create some sample test cases
      // In the next step, we'll integrate with OpenAI
      const sampleTestCases = [
        {
          documentId,
          content: `Verify compliance requirements from ${document.filename}`,
          category: 'Compliance Tests',
          source: 'generated' as const,
          confidenceScore: 0.85,
          contextUsed: `Content extracted from ${document.filename}`,
          executionStatus: 'ready' as const
        },
        {
          documentId,
          content: `Test functional requirements specified in ${document.filename}`,
          category: 'Functional Tests',
          source: 'generated' as const,
          confidenceScore: 0.92,
          contextUsed: `Business rules from ${document.filename}`,
          executionStatus: 'ready' as const
        }
      ];

      const createdTestCases = [];
      for (const testCaseData of sampleTestCases) {
        const testCase = await storage.createTestCase(testCaseData);
        createdTestCases.push(testCase);
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

  const httpServer = createServer(app);

  return httpServer;
}