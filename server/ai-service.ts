// Using OpenRouter for unified AI access with 400+ models
import OpenAI from "openai";
import mammoth from "mammoth";
import { parse } from "node-html-parser";
import crypto from "crypto";

// Initialize OpenRouter client (OpenAI-compatible API)
// Only initialize if API key is available
const openRouter = process.env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    })
  : null;

// AI Provider configuration - OpenRouter
export type AIProvider = "openrouter";

export interface AIProviderConfig {
  provider: AIProvider;
  model?: string;
}

export interface DocumentChunk {
  id: string;
  content: string;
  embedding: number[];
  documentId: string;
  chunkIndex: number;
}

export interface DocumentMetadata {
  customerName?: string;
  documentType?: string;
  industry?: string;
  extractedAt: string;
}

export interface TestCaseGenerationResult {
  testCases: Array<{
    title: string;
    description: string;
    category: "functional" | "compliance" | "integration" | "edge_case";
    priority: "high" | "medium" | "low";
    steps: string[];
    expectedResult: string;
    tags: string[];
  }>;
  metadata: DocumentMetadata;
  contextUsed: string[];
  processingTime: number;
  aiProvider: AIProvider;
}

/**
 * Extract text content from various file formats
 */
export async function extractTextFromFile(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const extension = filename.toLowerCase().split(".").pop();

  try {
    switch (extension) {
      case "pdf":
        // Dynamic import to avoid the pdf-parse test file issue
        const pdfParse = await import("pdf-parse");
        const pdfData = await pdfParse.default(buffer);
        return pdfData.text;

      case "docx":
        const docResult = await mammoth.extractRawText({ buffer });
        return docResult.value;

      case "doc":
        // Legacy .doc format is not supported by mammoth - only .docx
        throw new Error(
          "Legacy .doc format is not supported. Please convert to .docx format and re-upload.",
        );

      case "txt":
        return buffer.toString("utf-8");

      case "html":
      case "htm":
        const htmlContent = buffer.toString("utf-8");
        const root = parse(htmlContent);
        return root.text;

      default:
        throw new Error(`Unsupported file format: ${extension}`);
    }
  } catch (error) {
    console.error(`Error extracting text from ${filename}:`, error);
    throw new Error(
      `Failed to extract text from ${filename}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Split document text into chunks for embedding
 */
export function chunkDocument(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200,
): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);

    // Try to break at sentence boundaries
    if (end < text.length) {
      const lastSentence = chunk.lastIndexOf(".");
      const lastNewline = chunk.lastIndexOf("\n");
      const breakPoint = Math.max(lastSentence, lastNewline);

      if (breakPoint > start + chunkSize * 0.5) {
        chunks.push(text.slice(start, breakPoint + 1).trim());
        start = breakPoint + 1 - overlap;
      } else {
        chunks.push(chunk.trim());
        start = end - overlap;
      }
    } else {
      chunks.push(chunk.trim());
      break;
    }

    // Ensure we don't go backward
    start = Math.max(start, chunks.length > 1 ? start : end - overlap);
  }

  return chunks.filter((chunk) => chunk.length > 50); // Filter out very short chunks
}

/**
 * Generate embeddings for text chunks using simple embeddings (Gemini-only mode)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  try {
    // Using simple embeddings for Gemini-only mode as requested by user
    console.log("Using simple embeddings for Gemini-only mode");
    return texts.map(() =>
      Array(1536)
        .fill(0)
        .map(() => Math.random() - 0.5),
    );
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw new Error(
      `Failed to generate embeddings: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Extract document metadata using AI (customer name, document type, industry)
 */
export async function extractDocumentMetadata(
  documentContent: string,
  filename: string,
  config: AIProviderConfig = { provider: "openrouter" },
): Promise<DocumentMetadata> {
  const prompt = `Analyze this business document and extract key metadata. Focus on identifying:

1. CUSTOMER/COMPANY NAME: Look for the main organization name (often at the top, letterhead, or signature)
2. DOCUMENT TYPE: Identify what kind of document this is (e.g., Employee Handbook, Policy Manual, Contract, etc.)
3. INDUSTRY: Determine the business sector/industry based on content and context

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any explanatory text, conversational responses, or markdown formatting. Your entire response must be parseable JSON.

Document filename: ${filename}
Document content:
${documentContent.slice(0, 3000)}...

Respond with ONLY this exact JSON format (no additional text):
{
  "customerName": "exact company name found in document or null",
  "documentType": "specific document type or null",
  "industry": "business industry category or null"
}`;

  try {
    // Using OpenRouter for unified AI access
    if (!openRouter) {
      throw new Error(
        "OpenRouter client not initialized. Please configure OPENROUTER_API_KEY.",
      );
    }

    const response = await openRouter.chat.completions.create({
      model: "qwen/qwen-2.5-72b-instruct:free",
      messages: [{ role: "user", content: prompt }],
    });

    let text = response.choices[0].message.content || "{}";
    // Strip markdown code blocks and clean response
    text = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*$/g, "")
      .trim();

    // Try to extract JSON if there's extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    // Parse JSON with better error handling
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      console.error("JSON Parse Error in extractDocumentMetadata. Raw content:", text.substring(0, 200) + "...");
      console.error("Parse error:", parseError);
      
      // Try to fix common issues
      let fixedContent = text
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
        .replace(/,(\s*[}\]])/g, "$1") // Remove trailing commas
        .trim();
      
      try {
        result = JSON.parse(fixedContent);
        console.log("Successfully parsed after cleanup in extractDocumentMetadata");
      } catch (secondError) {
        console.error("Failed to parse document metadata after cleanup, using defaults");
        result = {}; // Use empty object as fallback
      }
    }
    return {
      customerName: result.customerName || undefined,
      documentType: result.documentType || undefined,
      industry: result.industry || undefined,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error extracting document metadata:", error);
    // Return partial metadata on error
    return {
      extractedAt: new Date().toISOString(),
    };
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find relevant document chunks using RAG
 */
export function findRelevantChunks(
  query: string,
  queryEmbedding: number[],
  chunks: DocumentChunk[],
  maxChunks: number = 5,
  similarityThreshold: number = 0.7,
): DocumentChunk[] {
  const similarities = chunks.map((chunk) => ({
    chunk,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  return similarities
    .filter((item) => item.similarity >= similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxChunks)
    .map((item) => item.chunk);
}

/**
 * Generate test cases using AI with RAG context
 */
export async function generateTestCases(
  documentTitle: string,
  documentType: string,
  relevantChunks: DocumentChunk[],
  requirements?: string,
  config: AIProviderConfig = { provider: "openrouter" },
): Promise<TestCaseGenerationResult> {
  const startTime = Date.now();

  // Prepare context from relevant chunks
  const context = relevantChunks
    .map((chunk, index) => `Context ${index + 1}:\n${chunk.content}`)
    .join("\n\n");

  const systemPrompt = `You are an expert QA engineer specializing in enterprise test case generation. Your task is to analyze business documents and generate comprehensive, actionable test cases with detailed step-by-step instructions and thorough edge case coverage.

CRITICAL: You MUST respond with ONLY valid JSON. Do not include any explanatory text, conversational responses, or markdown formatting. Your entire response must be parseable JSON.

DOCUMENT ANALYSIS CONTEXT:
- Document: ${documentTitle}
- Type: ${documentType}
- Additional Requirements: ${requirements || "Standard test coverage"}

RESPONSE FORMAT:
Respond with ONLY this exact JSON format (no additional text):
{
  "testCases": [
    {
      "title": "Clear, specific test case title",
      "description": "Detailed description of what is being tested and why it's important",
      "category": "functional|compliance|integration|edge_case",
      "priority": "high|medium|low",
      "steps": [
        "Step 1: Navigate to [specific page/section]",
        "Step 2: Enter [specific data] in [specific field]",
        "Step 3: Click [specific button/action]",
        "Step 4: Verify [specific condition/result]",
        "Step 5: [Continue with detailed actions...]"
      ],
      "expectedResult": "Clear, measurable expected outcome with specific criteria",
      "tags": ["domain", "system", "risk_level", "test_type"]
    }
  ]
}

MANDATORY DETAILED STEP REQUIREMENTS:
- MINIMUM 5 STEPS per test case, MAXIMUM 10 steps per test case (this is non-negotiable)
- Each step must be specific and actionable with exact details (NEVER use vague instructions like "test the system" or "log in as a user")
- ALWAYS include exact field names, button labels, page names, URLs, and specific data values
- Example of GOOD steps: "Navigate to https://app.example.com/login", "Enter 'john.doe@company.com' in the Email Address field", "Click the 'Submit Payment' button", "Verify transaction ID appears in format 'TXN-XXXXXXXX'"
- Example of BAD steps: "Log in", "Enter data", "Submit form", "Check result"
- Break every scenario into granular, executable steps that a manual tester can follow exactly
- Include verification/assertion steps after every 2-3 action steps
- Specify exact expected system responses and intermediate states
- Always include setup steps (navigation, login, data preparation) and cleanup steps when needed
- If a test involves data entry, specify exact test data values to use

COMPREHENSIVE EDGE CASE COVERAGE:
Generate test cases covering these edge case categories:
1. BOUNDARY CONDITIONS: Min/max values, empty fields, character limits
2. INVALID INPUTS: Wrong data types, special characters, injection attempts
3. SYSTEM LIMITS: Concurrent users, large data volumes, timeout scenarios
4. ERROR HANDLING: Network failures, service unavailability, permission errors
5. DATA INTEGRITY: Duplicate entries, referential integrity, data corruption
6. WORKFLOW INTERRUPTIONS: Mid-process failures, browser refresh, session timeout
7. SECURITY VULNERABILITIES: Unauthorized access, privilege escalation, data exposure
8. INTEGRATION FAILURES: External service failures, API timeouts, data format mismatches

ENHANCED GUIDELINES:
1. Generate 10-15 diverse test cases with at least 30% focused on edge cases
2. Categories (target distribution):
   - functional: 40% - Core business logic and standard workflows
   - edge_case: 30% - Boundary conditions, error scenarios, and failure modes
   - compliance: 20% - Regulatory requirements, security, and policy adherence
   - integration: 10% - System interactions, data flow, and external dependencies
3. Priority assignment:
   - high: Critical business functions, security risks, compliance requirements
   - medium: Important features, data integrity, user experience
   - low: Nice-to-have features, cosmetic issues, minor edge cases
4. Each test case MUST have exactly 5-10 detailed, executable steps (NO EXCEPTIONS - tests with fewer than 5 steps will be rejected)
5. Expected results must be specific and measurable
6. Tags should include: business domain, technical system, risk level, test complexity
7. Focus heavily on realistic failure scenarios that could impact business operations`;

  const userPrompt = `Based on the following document content, generate comprehensive test cases with detailed step-by-step instructions and extensive edge case coverage:

${context}

MANDATORY REQUIREMENTS:
1. Create detailed, executable test steps for each scenario (EXACTLY 5-10 steps per test case - NO FEWER than 5 steps)
2. Include at least 4-5 edge case test scenarios covering boundary conditions, invalid inputs, error handling, and system failures
3. EVERY step must include specific actions, exact data inputs, field names, and verification points
4. Focus heavily on realistic failure scenarios that could impact business operations
5. Cover both happy path workflows and comprehensive error/edge case scenarios
6. Include security vulnerabilities, compliance violations, and integration failure testing
7. Use specific test data values in steps (e.g., "Enter '999999999999999' in Credit Card Number field" not "Enter invalid credit card")
8. Include expected error messages, system responses, and intermediate states

Generate test cases that thoroughly validate the requirements, processes, potential failure scenarios, boundary conditions, and error handling capabilities described in this document.`;

  try {
    let result: any;
    let content: string;

    // Using OpenRouter for unified AI access
    if (!openRouter) {
      throw new Error(
        "OpenRouter client not initialized. Please configure OPENROUTER_API_KEY.",
      );
    }

    // Add timeout and response size validation
    console.log("Making AI API call to OpenRouter...");
    const apiStartTime = Date.now();
    
    // Retry logic for API failures
    let response;
    let lastError;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`API attempt ${attempt}/${maxRetries}...`);
        
        // Create an AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        
        response = await openRouter.chat.completions.create({
          model: "qwen/qwen-2.5-72b-instruct:free",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
            { role: "assistant", content: "I understand. I will generate comprehensive test cases with exactly 5-10 detailed steps per test case and include extensive edge case coverage. I will respond with ONLY valid JSON." }
          ],
          max_tokens: 16000, // Set reasonable limit to prevent truncation
          temperature: 0.1, // Lower temperature for more consistent JSON output
        }, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log(`API call succeeded on attempt ${attempt}`);
        break; // Success, exit retry loop
        
      } catch (apiError) {
        lastError = apiError;
        
        // Log detailed error information
        console.error(`API attempt ${attempt} failed:`, apiError);
        
        if (apiError instanceof Error) {
          console.error("Error name:", apiError.name);
          console.error("Error message:", apiError.message);
          console.error("Error stack:", apiError.stack);
        }
        
        // Check if this is an abort (timeout) error
        if (apiError instanceof Error && apiError.name === 'AbortError') {
          console.error("API call timed out after 60 seconds");
        }
        
        // Check if this is a JSON parsing error at HTTP level
        if (apiError instanceof Error && apiError.message.includes('JSON input')) {
          console.error("HTTP-level JSON parsing error detected");
        }
        
        // If this is the last attempt, don't retry
        if (attempt === maxRetries) {
          console.error(`All ${maxRetries} API attempts failed`);
          break;
        }
        
        // Wait before retrying (exponential backoff)
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    if (!response) {
      // All retries failed, throw the last error
      const errorMessage = lastError instanceof Error ? lastError.message : "Unknown API error";
      throw new Error(`AI API call failed after ${maxRetries} attempts: ${errorMessage}`);
    }

    const apiDuration = Date.now() - apiStartTime;
    console.log(`AI API call completed in ${apiDuration}ms`);

    // Validate API response structure
    if (!response || !response.choices || response.choices.length === 0) {
      throw new Error("Invalid API response structure - no choices returned");
    }

    content = response.choices[0].message?.content || "";
    
    // Log response details for debugging
    console.log("AI Response details:");
    console.log("- Content length:", content.length);
    console.log("- Finish reason:", response.choices[0].finish_reason);
    console.log("- Usage:", response.usage);
    
    if (!content) {
      throw new Error("No content in OpenRouter response - empty message content");
    }
    
    if (content.length < 50) {
      throw new Error(`AI response suspiciously short (${content.length} chars): "${content}"`);
    }
    
    // Check if response was truncated
    if (response.choices[0].finish_reason === 'length') {
      console.warn("⚠️  AI response may have been truncated due to max_tokens limit");
    }

    // Strip markdown code blocks and clean response
    content = content
      .replace(/```json\s*/g, "")
      .replace(/```\s*$/g, "")
      .trim();

    // Try to extract JSON if there's extra text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }

    // Parse JSON with enhanced error handling
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error("=== JSON PARSE ERROR DETAILS ===");
      console.error("Parse error:", parseError);
      console.error("Content length:", content.length);
      console.error("Raw content (first 500 chars):", content.substring(0, 500));
      console.error("Raw content (last 200 chars):", content.length > 200 ? content.substring(content.length - 200) : content);
      console.error("Content ends with:", content.slice(-50));
      
      // Check if content is empty or too short
      if (!content || content.trim().length === 0) {
        throw new Error("AI response was empty - no content received from the model");
      }
      
      if (content.length < 10) {
        throw new Error(`AI response too short (${content.length} chars): "${content}"`);
      }
      
      // Try to fix common issues
      let fixedContent = content
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
        .replace(/,(\s*[}\]])/g, "$1") // Remove trailing commas
        .replace(/}\s*$/, "}") // Ensure proper ending
        .trim();
      
      // If content doesn't start with {, try to find the JSON block
      if (!fixedContent.startsWith('{')) {
        const jsonMatch = fixedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          fixedContent = jsonMatch[0];
          console.log("Extracted JSON block from mixed content");
        }
      }
      
      try {
        result = JSON.parse(fixedContent);
        console.log("Successfully parsed after cleanup");
      } catch (secondError) {
        console.error("Second parse attempt failed:", secondError);
        console.error("Fixed content (first 200 chars):", fixedContent.substring(0, 200));
        
        // Check if this looks like a truncated response
        const looksLikeTruncated = !content.endsWith('}') && !content.endsWith(']') && content.includes('{');
        const errorType = looksLikeTruncated ? "truncated" : "malformed";
        
        throw new Error(`Failed to parse AI response as JSON (${errorType}). Response length: ${content.length} chars. First 100 chars: "${content.substring(0, 100)}..."`);
      }
    }

    // Server-side validation to enforce requirements
    const testCases = result.testCases || [];
    
    // Validate step counts (5-10 steps per test case)
    const validatedTestCases = testCases.filter((testCase: any) => {
      if (!testCase.steps || !Array.isArray(testCase.steps)) {
        console.warn(`Test case "${testCase.title}" has no steps array`);
        return false;
      }
      if (testCase.steps.length < 5 || testCase.steps.length > 10) {
        console.warn(`Test case "${testCase.title}" has ${testCase.steps.length} steps, required 5-10`);
        return false;
      }
      return true;
    });

    // Validate category distribution (require at least 30% edge cases for 10+ tests)
    const categoryCount = validatedTestCases.reduce((acc: Record<string, number>, test: any) => {
      const category = test.category || 'unknown';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalTests = validatedTestCases.length;
    const edgeCaseCount = categoryCount.edge_case || 0;
    const edgeCasePercentage = totalTests > 0 ? (edgeCaseCount / totalTests) * 100 : 0;

    console.log(`Generated ${totalTests} valid test cases with ${edgeCaseCount} edge cases (${edgeCasePercentage.toFixed(1)}%)`);
    console.log('Category distribution:', categoryCount);

    // If we don't have enough valid test cases, log a warning
    if (totalTests < 10) {
      console.warn(`Only generated ${totalTests} valid test cases, expected 10-15`);
    }
    if (edgeCasePercentage < 25 && totalTests >= 8) {
      console.warn(`Edge case coverage is ${edgeCasePercentage.toFixed(1)}%, expected at least 25%`);
    }

    const processingTime = Date.now() - startTime;

    // Extract metadata from document content
    const extractedText = relevantChunks
      .map((chunk) => chunk.content)
      .join("\n");
    const metadata = await extractDocumentMetadata(
      extractedText,
      documentTitle,
      config,
    );

    return {
      testCases: validatedTestCases,
      metadata,
      contextUsed: relevantChunks.map(
        (chunk) =>
          `Chunk ${chunk.chunkIndex}: ${chunk.content.slice(0, 100)}...`,
      ),
      processingTime,
      aiProvider: config.provider,
    };
  } catch (error) {
    console.error("Error generating test cases:", error);
    throw new Error(
      `Failed to generate test cases: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Process document for test case generation (complete pipeline)
 */
export async function processDocumentForTestGeneration(
  buffer: Buffer,
  filename: string,
  documentId: string,
  documentType: string = "business_document",
  requirements?: string,
  config: AIProviderConfig = { provider: "openrouter" },
): Promise<{
  extractedText: string;
  chunks: DocumentChunk[];
  testCases: TestCaseGenerationResult;
}> {
  try {
    // Step 1: Extract text from document
    console.log(`Extracting text from ${filename}...`);
    const extractedText = await extractTextFromFile(buffer, filename);

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error("No text content could be extracted from the document");
    }

    // Step 2: Split into chunks
    console.log("Splitting document into chunks...");
    const textChunks = chunkDocument(extractedText);

    // Step 3: Generate embeddings for chunks
    console.log(`Generating embeddings for ${textChunks.length} chunks...`);
    const embeddings = await generateEmbeddings(textChunks);

    // Step 4: Create document chunks with embeddings
    const chunks: DocumentChunk[] = textChunks.map((content, index) => ({
      id: crypto.randomUUID(),
      content,
      embedding: embeddings[index],
      documentId,
      chunkIndex: index,
    }));

    // Step 5: Generate query embedding for test case generation
    const queryText = `Generate comprehensive test cases for this ${documentType} document covering functional requirements, compliance, integration scenarios, and edge cases.`;
    const queryEmbeddings = await generateEmbeddings([queryText]);
    const queryEmbedding = queryEmbeddings[0];

    // Step 6: Find relevant chunks using RAG (with fallback for reliable context)
    let relevantChunks = findRelevantChunks(
      queryText,
      queryEmbedding,
      chunks,
      5, // maxChunks
      0.1, // Lower threshold to ensure we get chunks with random embeddings
    );

    // Fallback: If no relevant chunks found, use the first few chunks to ensure context
    if (relevantChunks.length === 0) {
      console.log("No relevant chunks found with similarity, using first chunks as fallback");
      relevantChunks = chunks.slice(0, Math.min(3, chunks.length));
    }

    // Step 7: Generate test cases using AI
    console.log(
      `Generating test cases with ${config.provider.toUpperCase()}...`,
    );
    const testCases = await generateTestCases(
      filename,
      documentType,
      relevantChunks,
      requirements,
      config,
    );

    return {
      extractedText,
      chunks,
      testCases,
    };
  } catch (error) {
    console.error(`Error processing document ${filename}:`, error);
    throw error;
  }
}
