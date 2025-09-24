// Using Gemini Flash as the AI agent
import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";
import { parse } from "node-html-parser";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Initialize Gemini client
const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// Strip markdown code fences from Gemini responses
function stripMarkdownCodeFences(content: string): string {
  // Remove ```json...``` or ```...``` wrappers that Gemini often adds
  let cleaned = content.trim();
  
  // Pattern 1: ```json\n{...}\n```
  if (cleaned.startsWith('```json\n') && cleaned.endsWith('\n```')) {
    cleaned = cleaned.slice(8, -4); // Remove ```json\n and \n```
  }
  // Pattern 2: ```\n{...}\n```
  else if (cleaned.startsWith('```\n') && cleaned.endsWith('\n```')) {
    cleaned = cleaned.slice(4, -4); // Remove ```\n and \n```
  }
  // Pattern 3: ```json{...}```
  else if (cleaned.startsWith('```json') && cleaned.endsWith('```')) {
    const jsonStart = cleaned.indexOf('{');
    if (jsonStart !== -1) {
      cleaned = cleaned.slice(jsonStart, -3); // Remove ```json prefix and ``` suffix
    }
  }
  // Pattern 4: ```{...}```
  else if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
    const jsonStart = cleaned.indexOf('{');
    if (jsonStart !== -1) {
      cleaned = cleaned.slice(jsonStart, -3); // Remove ``` prefix and ``` suffix
    }
  }
  
  return cleaned.trim();
}

// Smart JSON repair function to fix common syntax issues
function smartJsonRepair(jsonStr: string): string | null {
  try {
    // First, strip any markdown code fences that Gemini might add
    const strippedJson = stripMarkdownCodeFences(jsonStr);
    
    // Try parsing the cleaned JSON
    JSON.parse(strippedJson);
    return strippedJson; // Already valid after stripping
  } catch (error) {
    console.log("🔧 Attempting smart JSON repair...");
    console.log("🔧 Original error:", error);
    console.log("🔧 Content length:", jsonStr.length);
    
    // Start with stripped content for repair
    let repaired = stripMarkdownCodeFences(jsonStr);
    
    // Advanced repair: Fix missing commas more aggressively
    // Fix 1: Add missing commas between array elements
    repaired = repaired.replace(/}\s*\n\s*{/g, '},\n{');
    
    // Fix 2: Add missing commas between object properties
    repaired = repaired.replace(/"(\s*\n\s*)"([^"]+)":/g, '",\n"$2":');
    
    // Fix 3: Add missing commas in string arrays
    repaired = repaired.replace(/"(\s*\n\s*)"([^"]*)"(?!\s*:)/g, '",\n"$2"');
    
    // Fix 4: Add missing commas after array/object transitions  
    repaired = repaired.replace(/]\s*\n\s*{/g, '],\n{');
    repaired = repaired.replace(/}\s*\n\s*\[/g, '},\n[');
    
    // Fix 5: Handle specific missing comma patterns in arrays
    repaired = repaired.replace(/]\s*\n\s*"([^"]+)":/g, '],\n"$1":');
    repaired = repaired.replace(/"([^"]+)"\s*\n\s*]/g, '"$1"\n]');
    
    // Fix 6: Add missing commas between properties and arrays
    repaired = repaired.replace(/"([^"]*)"(\s*\n\s*)\[/g, '"$1",$2[');
    
    // Fix 7: Close unclosed arrays/objects at the end
    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/]/g) || []).length;
    
    // Add missing closing braces
    for (let i = 0; i < openBraces - closeBraces; i++) {
      repaired += '}';
    }
    
    // Add missing closing brackets  
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      repaired += ']';
    }
    
    // Fix 8: Clean up multiple commas and trailing commas
    repaired = repaired.replace(/,+/g, ',');
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix 9: Handle specific array element comma issues
    repaired = repaired.replace(/"\s*\n\s*"([^"]*)"(?=\s*[,\]])/g, '",\n"$1"');
    
    console.log("🔧 JSON repair completed, checking validity...");
    
    try {
      JSON.parse(repaired);
      console.log("✅ Smart JSON repair successful!");
      return repaired;
    } catch (repairError) {
      console.log("⚠️ Smart repair couldn't fix all issues");
      console.log("⚠️ Repair error:", repairError);
      console.log("⚠️ Repaired content sample:", repaired.substring(0, 300));
      return null; // Return null to trigger fallback agent
    }
  }
}

// Gemini API function for test case generation (NEW SDK format) with timeout protection
async function generateTestCasesWithGemini(systemPrompt: string, userPrompt: string) {
  if (!geminiClient) {
    throw new Error("Gemini client not initialized");
  }

  // 🔍 COMPREHENSIVE LOGGING FOR DEBUGGING
  console.log("=".repeat(80));
  console.log("🚀 GEMINI API CALL DEBUG START");
  console.log("=".repeat(80));
  console.log("📊 Environment Check:");
  console.log("- API Key present:", !!process.env.GEMINI_API_KEY);
  console.log("- API Key first 10 chars:", process.env.GEMINI_API_KEY?.substring(0, 10) + "...");
  console.log("- System prompt length:", systemPrompt.length, "chars");
  console.log("- User prompt length:", userPrompt.length, "chars");
  console.log("- Total content length:", (systemPrompt + "\n\n" + userPrompt).length, "chars");
  console.log("- Node.js version:", process.version);
  console.log("- Platform:", process.platform);

  // 🔍 NETWORK CONNECTIVITY TEST
  console.log("🌐 Testing network connectivity to Gemini API...");
  try {
    console.log("🌐 Testing basic HTTPS connectivity...");
    const testResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": process.env.GEMINI_API_KEY || ""
      }
    });
    console.log("✅ Network test response status:", testResponse.status);
    console.log("✅ Network test response headers:", Object.fromEntries(testResponse.headers.entries()));
  } catch (networkError) {
    console.log("❌ Network connectivity test failed:", networkError);
    console.log("❌ This suggests the Node.js environment cannot reach Gemini API");
  }

  try {
    console.log("🔄 Making API call to Gemini 2.0 Flash...");
    
    const startTime = Date.now();

    // Add timeout protection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log("⚠️ Gemini API call timeout after 90 seconds, aborting...");
      console.log("⚠️ This suggests a network connectivity issue within Node.js environment");
      controller.abort();
    }, 90000); // 90 seconds for Gemini

    console.log("📡 About to call geminiClient.getGenerativeModel() and model.generateContent()...");
    console.log("📡 Request config:", {
      model: "gemini-2.0-flash",
      contentLength: (systemPrompt + "\n\n" + userPrompt).length
    });

    // Use CORRECT Google GenAI SDK format 
    const model = geminiClient.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(systemPrompt + "\n\n" + userPrompt);

    clearTimeout(timeoutId);
    const endTime = Date.now();
    console.log("✅ Gemini API call completed successfully!");
    console.log(`⏱️ Response time: ${endTime - startTime}ms`);

    // Extract text from CORRECT SDK response
    const response = result.response;
    if (!response || !response.text()) {
      console.error("Invalid Gemini response structure:", JSON.stringify(response, null, 2));
      throw new Error("Invalid response structure from Gemini API");
    }

    const content = response.text().trim();
    
    // 📁 DUMP RAW GEMINI RESPONSE TO test_files FOR DEBUGGING
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `gemini-response-${timestamp}.json`;
      const filePath = path.join('test_files', fileName);
      
      const debugData = {
        timestamp: new Date().toISOString(),
        model: "gemini-2.0-flash",
        contentLength: content.length,
        rawResponse: content,
        fullGeminiResponse: {
          text: content,
          usageMetadata: result.response.usageMetadata || null,
          candidates: result.response.candidates || null
        }
      };
      
      fs.writeFileSync(filePath, JSON.stringify(debugData, null, 2));
      console.log(`📁 Raw Gemini response dumped to: ${filePath}`);
    } catch (dumpError) {
      console.log(`⚠️ Failed to dump response: ${dumpError}`);
    }
    
    if (!content || content.length < 50) {
      throw new Error(`Gemini response too short: ${content.length} characters`);
    }

    console.log(`Gemini returned ${content.length} characters of content`);
    
    return {
      content,
      model: "gemini-2.0-flash",
      usage: result.response.usageMetadata || { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    };

  } catch (error) {
    console.log("=".repeat(80));
    console.log("❌ GEMINI API CALL ERROR DEBUG");
    console.log("=".repeat(80));
    console.log("🔍 Error type:", error?.constructor?.name || 'Unknown');
    console.log("🔍 Error message:", error instanceof Error ? error.message : String(error));
    console.log("🔍 Full error object:", JSON.stringify(error, null, 2));
    
    if (error instanceof Error) {
      console.log("🔍 Error stack:", error.stack);
      
      // Check for specific network error patterns
      if (error.message.includes('fetch failed')) {
        console.log("🚨 NETWORK ISSUE DETECTED:");
        console.log("- This is a Node.js fetch network error");
        console.log("- Gemini API may be blocked by firewall/proxy");
        console.log("- Environment may not allow external HTTPS calls");
        console.log("- Consider checking network configuration");
      }
      
      if (error.message.includes('timeout')) {
        console.log("🚨 TIMEOUT ISSUE DETECTED:");
        console.log("- API call took longer than 90 seconds");
        console.log("- Network may be slow or unstable");
        console.log("- Consider using smaller content or different model");
      }
    }
    
    console.log("🔍 Network diagnostics:");
    console.log("- Process platform:", process.platform);
    console.log("- Node.js version:", process.version);
    console.log("- Environment:", process.env.NODE_ENV);
    console.log("=".repeat(80));
    
    throw new Error(`Gemini API error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// Types
export interface DocumentChunk {
  id: string;
  content: string;
  embedding: number[];
  documentId: string;
  chunkIndex: number;
}

export interface AIProviderConfig {
  provider: "gemini";
  model?: string; // Optional model specification
}

export interface TestCaseGenerationResult {
  testCases: Array<{
    title: string;
    description: string;
    category: string;
    priority: string;
    steps: string[];
    expectedResult: string;
    tags: string[];
  }>;
  metadata: any;
  contextUsed: string[];
  processingTime: number;
  aiProvider: string;
}

/**
 * Generate test cases using AI with RAG context
 */
export async function generateTestCases(
  documentTitle: string,
  documentType: string,
  relevantChunks: DocumentChunk[],
  requirements?: string,
  config: AIProviderConfig = { provider: "gemini" },
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
        "Navigate to [specific page/section]",
        "Enter [specific data] in [specific field]",
        "Click [specific button/action]",
        "Verify [specific condition/result]",
        "[Continue with detailed actions...]"
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

    console.log(`🚀 Starting AI test case generation with ${config.provider} as primary agent...`);

    // PRIMARY: Try Gemini Flash first
    if (config.provider === "gemini" && geminiClient) {
      console.log("🧠 Gemini Flash is my primary AI brain! Let me generate those test cases...");
      try {
        console.log("🌟 Gemini AI is processing your document...");
        const geminiResult = await generateTestCasesWithGemini(systemPrompt, userPrompt);
        
        content = geminiResult.content;
        console.log("✅ Gemini successfully generated test cases!");
        
        // Parse Gemini's JSON response
        try {
          result = JSON.parse(content);
          console.log("✅ Gemini JSON parsed successfully!");
        } catch (geminiParseError) {
          console.log("⚠️ Gemini JSON parse failed, trying repair...");
          const repairedContent = smartJsonRepair(content);
          if (repairedContent === null) {
            throw new Error("Gemini JSON could not be repaired");
          }
          result = JSON.parse(repairedContent);
          console.log("✅ Gemini JSON repaired and parsed successfully!");
        }
        
      } catch (geminiError) {
        console.error("❌ Gemini agent failed:", geminiError);
        throw new Error(`Failed to generate test cases: ${geminiError instanceof Error ? geminiError.message : "Unknown error"}`);
      }
    }

    // Validate and process results
    if (!result || !result.testCases || !Array.isArray(result.testCases)) {
      throw new Error("AI response missing testCases array");
    }

    const validatedTestCases = result.testCases.filter((testCase: any) => {
      return testCase.title && testCase.steps && Array.isArray(testCase.steps) && testCase.steps.length >= 5 && testCase.steps.length <= 10;
    });

    if (validatedTestCases.length === 0) {
      throw new Error("No valid test cases found in AI response");
    }

    const processingTime = Date.now() - startTime;

    // Extract metadata stub
    const metadata = {
      documentTitle,
      documentType,
      totalWords: context.length,
      chunksProcessed: relevantChunks.length
    };

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

// Document processing utilities
function chunkDocument(text: string): string[] {
  const maxChunkSize = 1000;
  const chunks: string[] = [];
  const paragraphs = text.split('\n\n');
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length <= maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = paragraph;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

async function generateEmbeddings(textChunks: string[]): Promise<number[][]> {
  // Mock embeddings for now
  return textChunks.map(() => Array(1536).fill(0).map(() => Math.random()));
}

async function extractTextFromFile(buffer: Buffer, filename: string): Promise<string> {
  const extension = filename.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'txt':
      return buffer.toString('utf8');
    case 'docx':
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}

async function extractDocumentMetadata(text: string, title: string, config: AIProviderConfig): Promise<any> {
  return {
    title,
    wordCount: text.split(/\s+/).length,
    extractedAt: new Date().toISOString(),
    aiProvider: config.provider
  };
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
  config: AIProviderConfig = { provider: "gemini" },
): Promise<{
  extractedText: string;
  chunks: DocumentChunk[];
  testCases: TestCaseGenerationResult;
}> {
  try {
    console.log(`Extracting text from ${filename}...`);
    const extractedText = await extractTextFromFile(buffer, filename);

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error("No text content could be extracted from the document");
    }

    console.log("Splitting document into chunks...");
    const textChunks = chunkDocument(extractedText);

    console.log(`Generating embeddings for ${textChunks.length} chunks...`);
    const embeddings = await generateEmbeddings(textChunks);

    const chunks: DocumentChunk[] = textChunks.map((content, index) => ({
      id: crypto.randomUUID(),
      content,
      embedding: embeddings[index],
      documentId,
      chunkIndex: index,
    }));

    const queryText = `Generate comprehensive test cases for this ${documentType} document covering functional requirements, compliance, integration scenarios, and edge cases.`;
    const queryEmbeddings = await generateEmbeddings([queryText]);

    const relevantChunks = chunks
      .map((chunk, index) => ({
        ...chunk,
        similarity: cosineSimilarity(queryEmbeddings[0], chunk.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, Math.min(5, chunks.length));

    console.log(`Using top ${relevantChunks.length} relevant chunks for test generation...`);
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
    console.error("Error processing document:", error);
    throw new Error(
      `Failed to process document: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}