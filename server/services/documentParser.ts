import OpenAI from 'openai';

// Initialize OpenAI client only if API key is available
let openai: OpenAI | null = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
} catch (error) {
  console.warn('OpenAI client initialization failed:', error);
}

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

// Fallback parsing logic when OpenAI is unavailable
function parseWithFallbackLogic(content: string): ExtractedCompanyDetails {
  console.log('Using fallback parsing logic for company extraction...');
  
  // Extract company name using simple regex patterns
  const companyPatterns = [
    /COMPANY INFORMATION:\s*([^\n\r]+)/i,
    /Company:\s*([^\n\r]+)/i,
    /Organization:\s*([^\n\r]+)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Inc|LLC|Corp|Ltd|Limited|Company|Corporation|Solutions|Group|Partners|Center|Medical|Restaurant|Energy))\.?)/g
  ];

  let companyName: string | null = null;
  for (const pattern of companyPatterns) {
    const match = content.match(pattern);
    if (match) {
      companyName = match[1] || match[0];
      companyName = companyName.trim().replace(/[.,;:]$/, '');
      break;
    }
  }

  // Extract industry information
  const industryPatterns = [
    /Industry:\s*([^\n\r]+)/i,
    /Sector:\s*([^\n\r]+)/i,
    /Business:\s*([^\n\r]+)/i
  ];

  let industry: string | null = null;
  for (const pattern of industryPatterns) {
    const match = content.match(pattern);
    if (match) {
      industry = match[1].trim().replace(/[.,;:]$/, '');
      break;
    }
  }

  // If no industry found, try to infer from company name or content
  if (!industry) {
    if (companyName) {
      if (/tech|software|digital|cyber|AI|data/i.test(companyName + ' ' + content)) {
        industry = 'Technology';
      } else if (/health|medical|hospital|care|clinic/i.test(companyName + ' ' + content)) {
        industry = 'Healthcare';
      } else if (/restaurant|food|dining|culinary/i.test(companyName + ' ' + content)) {
        industry = 'Restaurant';
      } else if (/energy|manufacturing|industrial|green/i.test(companyName + ' ' + content)) {
        industry = 'Manufacturing';
      } else if (/legal|law|attorney|counsel/i.test(companyName + ' ' + content)) {
        industry = 'Legal';
      } else if (/finance|bank|investment|financial/i.test(companyName + ' ' + content)) {
        industry = 'Finance';
      }
    }
  }

  // Extract contract type
  const contractPatterns = [
    /Document Type:\s*([^\n\r]+)/i,
    /(Software License Agreement|Service Agreement|Employment Handbook|Contract Agreement|License Agreement|Employment Contract|Service Contract)/i
  ];

  let contractType: string | null = null;
  for (const pattern of contractPatterns) {
    const match = content.match(pattern);
    if (match) {
      contractType = match[1].trim().replace(/[.,;:]$/, '');
      break;
    }
  }

  // Extract contact information
  const emailMatch = content.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const phoneMatch = content.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const addressMatch = content.match(/Address:\s*([^\n\r]+)/i);

  const contactEmail = emailMatch ? emailMatch[1] : null;
  const contactPhone = phoneMatch ? phoneMatch[0] : null;
  const address = addressMatch ? addressMatch[1].trim().replace(/[.,;:]$/, '') : null;

  // Determine confidence based on how much information we extracted
  let confidence: 'high' | 'medium' | 'low' = 'low';
  const infoCount = [companyName, industry, contractType, contactEmail, contactPhone, address].filter(Boolean).length;
  
  if (infoCount >= 4) {
    confidence = 'high';
  } else if (infoCount >= 2) {
    confidence = 'medium';
  }

  console.log('Fallback extraction results:', {
    companyName,
    industry,
    contractType,
    contactEmail,
    confidence
  });

  return {
    companyName,
    industry,
    contractType,
    contactEmail,
    contactPhone,
    address,
    confidence,
    extractedText: content
  };
}

export async function parseDocumentForCompanyDetails(documentContent: string): Promise<ExtractedCompanyDetails> {
  try {
    console.log('Starting document parsing for company details...');
    
    // Truncate content if too long (OpenAI has token limits)
    const maxLength = 15000; // Approximately 3-4k tokens
    const truncatedContent = documentContent.length > maxLength 
      ? documentContent.substring(0, maxLength) + '...[truncated]'
      : documentContent;

    // Check if OpenAI is available, if not use fallback parsing
    if (!openai) {
      console.log('OpenAI not available, using fallback parsing logic...');
      return parseWithFallbackLogic(truncatedContent);
    }

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
    console.error('Error parsing document with OpenAI:', error);
    console.log('Falling back to local parsing logic...');
    
    // Use fallback parsing when OpenAI fails
    try {
      const truncatedContent = documentContent.length > 15000 
        ? documentContent.substring(0, 15000) + '...[truncated]'
        : documentContent;
      return parseWithFallbackLogic(truncatedContent);
    } catch (fallbackError) {
      console.error('Fallback parsing also failed:', fallbackError);
      // Only return empty result if both OpenAI and fallback fail
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