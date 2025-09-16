import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import mammoth from 'mammoth';
import { parse } from 'node-html-parser';
import crypto from 'crypto';

// Initialize AI clients
// Only initialize OpenAI if API key is available
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Initialize Gemini client with proper SDK
// Only initialize if API key is available
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// AI Provider configuration
export type AIProvider = 'openai' | 'gemini';

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
    category: 'functional' | 'compliance' | 'integration' | 'edge_case';
    priority: 'high' | 'medium' | 'low';
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
export async function extractTextFromFile(buffer: Buffer, filename: string): Promise<string> {
  const extension = filename.toLowerCase().split('.').pop();
  
  try {
    switch (extension) {
      case 'pdf':
        // Dynamic import to avoid the pdf-parse test file issue
        const pdfParse = await import('pdf-parse');
        const pdfData = await pdfParse.default(buffer);
        return pdfData.text;
        
      case 'docx':
        const docResult = await mammoth.extractRawText({ buffer });
        return docResult.value;
        
      case 'doc':
        // Legacy .doc format is not supported by mammoth - only .docx
        throw new Error('Legacy .doc format is not supported. Please convert to .docx format and re-upload.');
        
      case 'txt':
        return buffer.toString('utf-8');
        
      case 'html':
      case 'htm':
        const htmlContent = buffer.toString('utf-8');
        const root = parse(htmlContent);
        return root.text;
        
      default:
        throw new Error(`Unsupported file format: ${extension}`);
    }
  } catch (error) {
    console.error(`Error extracting text from ${filename}:`, error);
    throw new Error(`Failed to extract text from ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Split document text into chunks for embedding
 */
export function chunkDocument(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
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
      const lastSentence = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
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
  
  return chunks.filter(chunk => chunk.length > 50); // Filter out very short chunks
}

/**
 * Generate embeddings for text chunks using OpenAI
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  try {
    if (!openai) {
      // For Gemini-only setup, return mock embeddings to skip RAG functionality
      console.log('OpenAI not configured, using simple embeddings for Gemini-only mode');
      return texts.map(() => Array(1536).fill(0).map(() => Math.random() - 0.5));
    }
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // More cost-effective than ada-002
      input: texts,
      encoding_format: 'float',
    });
    
    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract document metadata using AI (customer name, document type, industry)
 */
export async function extractDocumentMetadata(
  documentContent: string,
  filename: string,
  config: AIProviderConfig = { provider: 'gemini' }
): Promise<DocumentMetadata> {
  const prompt = `Analyze this business document and extract key metadata. Focus on identifying:

1. CUSTOMER/COMPANY NAME: Look for the main organization name (often at the top, letterhead, or signature)
2. DOCUMENT TYPE: Identify what kind of document this is (e.g., Employee Handbook, Policy Manual, Contract, etc.)
3. INDUSTRY: Determine the business sector/industry based on content and context

Document filename: ${filename}
Document content:
${documentContent.slice(0, 3000)}...

Respond in JSON format:
{
  "customerName": "exact company name found in document or null",
  "documentType": "specific document type or null",
  "industry": "business industry category or null"
}`;

  try {
    if (config.provider === 'gemini' && gemini) {
      const model = gemini.getGenerativeModel({ model: config.model || "gemini-2.0-flash" });
      const response = await model.generateContent([prompt]);
      
      const text = response.response.text();
      const result = JSON.parse(text || '{}');
      return {
        customerName: result.customerName || undefined,
        documentType: result.documentType || undefined,
        industry: result.industry || undefined,
        extractedAt: new Date().toISOString()
      };
    } else {
      if (!openai) {
        throw new Error('OpenAI client not initialized. Please configure OPENAI_API_KEY.');
      }
      const response = await openai.chat.completions.create({
        model: config.model || 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      
      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        customerName: result.customerName || undefined,
        documentType: result.documentType || undefined, 
        industry: result.industry || undefined,
        extractedAt: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error('Error extracting document metadata:', error);
    // Return partial metadata on error
    return {
      extractedAt: new Date().toISOString()
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
  similarityThreshold: number = 0.7
): DocumentChunk[] {
  const similarities = chunks.map(chunk => ({
    chunk,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
  }));
  
  return similarities
    .filter(item => item.similarity >= similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxChunks)
    .map(item => item.chunk);
}

/**
 * Generate test cases using AI with RAG context
 */
export async function generateTestCases(
  documentTitle: string,
  documentType: string,
  relevantChunks: DocumentChunk[],
  requirements?: string,
  config: AIProviderConfig = { provider: 'gemini' }
): Promise<TestCaseGenerationResult> {
  const startTime = Date.now();
  
  // Prepare context from relevant chunks
  const context = relevantChunks
    .map((chunk, index) => `Context ${index + 1}:\n${chunk.content}`)
    .join('\n\n');
  
  const systemPrompt = `You are an expert QA engineer specializing in enterprise test case generation. Your task is to analyze business documents and generate comprehensive, actionable test cases.

DOCUMENT ANALYSIS CONTEXT:
- Document: ${documentTitle}
- Type: ${documentType}
- Additional Requirements: ${requirements || 'Standard test coverage'}

RESPONSE FORMAT:
Generate test cases in this exact JSON format:
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

    if (config.provider === 'gemini' && gemini) {
      const model = gemini.getGenerativeModel({ model: config.model || "gemini-2.0-flash" });
      const prompt = `${systemPrompt}\n\n${userPrompt}`;
      const response = await model.generateContent([prompt]);

      content = response.response.text() || '';
      if (!content) {
        throw new Error('No content in Gemini response');
      }
      
      // Strip markdown code blocks from Gemini response
      content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    } else {
      if (!openai) {
        throw new Error('OpenAI client not initialized. Please configure OPENAI_API_KEY.');
      }
      const response = await openai.chat.completions.create({
        model: config.model || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      });

      content = response.choices[0]?.message?.content || '';
      if (!content) {
        throw new Error('No content in OpenAI response');
      }
    }

    result = JSON.parse(content);
    const processingTime = Date.now() - startTime;

    // Extract metadata from document content
    const extractedText = relevantChunks.map(chunk => chunk.content).join('\n');
    const metadata = await extractDocumentMetadata(extractedText, documentTitle, config);

    return {
      testCases: result.testCases || [],
      metadata,
      contextUsed: relevantChunks.map(chunk => `Chunk ${chunk.chunkIndex}: ${chunk.content.slice(0, 100)}...`),
      processingTime,
      aiProvider: config.provider
    };
  } catch (error) {
    console.error('Error generating test cases:', error);
    throw new Error(`Failed to generate test cases: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process document for test case generation (complete pipeline)
 */
export async function processDocumentForTestGeneration(
  buffer: Buffer,
  filename: string,
  documentId: string,
  documentType: string = 'business_document',
  requirements?: string,
  config: AIProviderConfig = { provider: 'gemini' }
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
      throw new Error('No text content could be extracted from the document');
    }

    // Step 2: Split into chunks
    console.log('Splitting document into chunks...');
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
      chunkIndex: index
    }));

    // Step 5: Generate query embedding for test case generation
    const queryText = `Generate comprehensive test cases for this ${documentType} document covering functional requirements, compliance, integration scenarios, and edge cases.`;
    const queryEmbeddings = await generateEmbeddings([queryText]);
    const queryEmbedding = queryEmbeddings[0];

    // Step 6: Find relevant chunks using RAG
    const relevantChunks = findRelevantChunks(queryText, queryEmbedding, chunks);
    
    // Step 7: Generate test cases using AI
    console.log(`Generating test cases with ${config.provider.toUpperCase()}...`);
    const testCases = await generateTestCases(filename, documentType, relevantChunks, requirements, config);

    return {
      extractedText,
      chunks,
      testCases
    };
  } catch (error) {
    console.error(`Error processing document ${filename}:`, error);
    throw error;
  }
}