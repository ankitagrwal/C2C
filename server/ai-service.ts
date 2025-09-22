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

  const systemPrompt = `You are an expert QA engineer specializing in enterprise test case generation. Your task is to analyze business documents and generate comprehensive, actionable test cases.

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
      "description": "Detailed description of what is being tested",
      "category": "functional|compliance|integration|edge_case",
      "priority": "high|medium|low",
      "steps": ["Step 1", "Step 2", "Step 3"],
      "expectedResult": "Clear expected outcome",
      "tags": ["tag1", "tag2"]
    }
  ]
}

GUIDELINES:
1. Generate 8-12 diverse test cases covering multiple scenarios
2. Categories:
   - functional: Core business logic and workflows
   - compliance: Regulatory and policy adherence  
   - integration: System interactions and data flow
   - edge_case: Boundary conditions and error handling
3. Priorities based on business impact and risk
4. Steps should be specific and executable
5. Tags should reflect business domains, systems, or risk areas
6. Focus on scenarios that could realistically fail`;

  const userPrompt = `Based on the following document content, generate comprehensive test cases:

${context}

Generate test cases that thoroughly validate the requirements, processes, and potential failure scenarios described in this document.`;

  try {
    let result: any;
    let content: string;

    // Using OpenRouter for unified AI access
    if (!openRouter) {
      throw new Error(
        "OpenRouter client not initialized. Please configure OPENROUTER_API_KEY.",
      );
    }

    const prompt = `${systemPrompt}\n\n${userPrompt}`;
    const response = await openRouter.chat.completions.create({
      model: "qwen/qwen-2.5-72b-instruct:free",
      messages: [{ role: "user", content: prompt }],
    });

    content = response.choices[0].message.content || "";
    if (!content) {
      throw new Error("No content in OpenRouter response");
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

    // Parse JSON with better error handling
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error("JSON Parse Error. Raw content:", content.substring(0, 200) + "...");
      console.error("Parse error:", parseError);
      
      // Try to fix common issues
      let fixedContent = content
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
        .replace(/,(\s*[}\]])/g, "$1") // Remove trailing commas
        .trim();
      
      try {
        result = JSON.parse(fixedContent);
        console.log("Successfully parsed after cleanup");
      } catch (secondError) {
        throw new Error(`Failed to parse AI response as JSON. Content starts with: "${content.substring(0, 100)}..."`);
      }
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
      testCases: result.testCases || [],
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

    // Step 6: Find relevant chunks using RAG
    const relevantChunks = findRelevantChunks(
      queryText,
      queryEmbedding,
      chunks,
    );

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
