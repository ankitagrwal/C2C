import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface ExtractedCompanyDetails {
  companyName: string | null;
  industry: string | null;
  contractType: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  confidence: 'high' | 'medium' | 'low';
  extractedText: string;
}

export async function parseDocumentForCompanyDetails(documentContent: string): Promise<ExtractedCompanyDetails> {
  try {
    console.log('Starting document parsing for company details...');
    
    // Truncate content if too long (OpenAI has token limits)
    const maxLength = 15000; // Approximately 3-4k tokens
    const truncatedContent = documentContent.length > maxLength 
      ? documentContent.substring(0, maxLength) + '...[truncated]'
      : documentContent;

    const systemPrompt = `You are an expert document analyzer that extracts company information from business documents.

Your task is to analyze the provided document and extract the following information:
1. Company Name - The main company or organization mentioned
2. Industry - The business sector/industry (e.g., Technology, Healthcare, Finance, Manufacturing)
3. Contract Type - Type of document/agreement (e.g., Software License, Service Agreement, Employment Contract, Policy Document)
4. Contact Email - Primary business email address
5. Contact Phone - Primary business phone number  
6. Address - Business address

IMPORTANT RULES:
- Only extract information that is clearly stated in the document
- If information is unclear or not present, return null for that field
- Be conservative - prefer null over guessing
- For industry, use broad categories (Technology, Healthcare, Finance, Manufacturing, Legal, Consulting, Education, etc.)
- For contract type, identify the document purpose (License Agreement, Service Contract, Employment Agreement, etc.)

Respond ONLY with a valid JSON object in this exact format:
{
  "companyName": "string or null",
  "industry": "string or null", 
  "contractType": "string or null",
  "contactEmail": "string or null",
  "contactPhone": "string or null",
  "address": "string or null",
  "confidence": "high|medium|low"
}`;

    const userPrompt = `Please analyze this document and extract company information:

${truncatedContent}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      max_tokens: 500
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }


    // Parse the JSON response
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI JSON response:', parseError);
      // Try to extract JSON from response if it's wrapped in other text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate and construct the result
    const result: ExtractedCompanyDetails = {
      companyName: parsed.companyName || null,
      industry: parsed.industry || null,
      contractType: parsed.contractType || null,
      contactEmail: parsed.contactEmail || null,
      contactPhone: parsed.contactPhone || null,
      address: parsed.address || null,
      confidence: parsed.confidence || 'low',
      extractedText: truncatedContent
    };

    console.log('Extracted company details:', {
      companyName: result.companyName,
      industry: result.industry,
      contractType: result.contractType,
      confidence: result.confidence
    });

    return result;

  } catch (error) {
    console.error('Error parsing document for company details:', error);
    
    // Return empty result on error
    return {
      companyName: null,
      industry: null,
      contractType: null,
      contactEmail: null,
      contactPhone: null,
      address: null,
      confidence: 'low',
      extractedText: documentContent.substring(0, 1000) + '...'
    };
  }
}

// Helper function to determine if extracted details are sufficient for auto-creation
export function hasMinimalCompanyInfo(details: ExtractedCompanyDetails): boolean {
  return !!(details.companyName && (details.industry || details.contractType));
}

// Helper function to generate a suggested customer name
export function generateCustomerName(details: ExtractedCompanyDetails): string {
  if (details.companyName) {
    return details.companyName;
  }
  
  if (details.industry && details.contractType) {
    return `${details.industry} - ${details.contractType}`;
  }
  
  return 'Unknown Company';
}