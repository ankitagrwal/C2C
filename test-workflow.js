// Test script to verify document processing workflow fixes
import FormData from 'form-data';

async function testWorkflow() {
  const baseUrl = 'http://localhost:5000';
  let sessionCookie = '';

  try {
    console.log('🔐 Testing login...');
    // Step 1: Login to get session
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${await loginResponse.text()}`);
    }

    // Extract session cookie
    sessionCookie = loginResponse.headers.get('set-cookie');
    console.log('✅ Login successful');

    // Step 2: Test document analysis with fallback (mock file)
    console.log('\n📄 Testing document analysis with fallback parsing...');
    
    // Create a test file content
    const testFileContent = `Software License Agreement

COMPANY INFORMATION:
TechCorp Solutions Inc.
Industry: Technology

CONTACT DETAILS:
Email: legal@techcorp.com
Phone: (555) 123-4567
Address: 123 Innovation Drive, San Francisco, CA 94105

AGREEMENT TERMS:
This Software License Agreement between TechCorp Solutions Inc. and the contracting party...`;

    const formData = new FormData();
    formData.append('document', Buffer.from(testFileContent, 'utf8'), {
      filename: 'test-agreement.txt',
      contentType: 'text/plain'
    });

    const analyzeResponse = await fetch(`${baseUrl}/api/documents/analyze-company`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formData
    });

    if (analyzeResponse.ok) {
      const result = await analyzeResponse.json();
      console.log('✅ Document analysis successful');
      console.log('📊 Extracted details:', {
        companyName: result.companyName,
        industry: result.industry,
        contractType: result.contractType,
        confidence: result.confidence
      });
    } else {
      console.log('❌ Document analysis failed:', analyzeResponse.status, await analyzeResponse.text());
    }

    // Step 3: Test demo mode upload (customerId: 'demo')
    console.log('\n🎮 Testing demo mode upload...');
    
    const uploadFormData = new FormData();
    uploadFormData.append('document', Buffer.from(testFileContent, 'utf8'), {
      filename: 'demo-test.txt',
      contentType: 'text/plain'
    });
    uploadFormData.append('customerId', 'demo'); // This should now work!
    uploadFormData.append('docType', 'Test Agreement');

    const uploadResponse = await fetch(`${baseUrl}/api/documents/upload`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: uploadFormData
    });

    if (uploadResponse.ok) {
      const uploadResult = await uploadResponse.json();
      console.log('✅ Demo mode upload successful');
      console.log('📄 Document created:', uploadResult.id, uploadResult.filename);
    } else {
      console.log('❌ Demo mode upload failed:', uploadResponse.status, await uploadResponse.text());
    }

    console.log('\n🎯 Workflow test completed!');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testWorkflow();