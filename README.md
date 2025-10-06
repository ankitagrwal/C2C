# Clause2Case - AI-Powered Test Case Generation Platform

Enterprise-grade business document processing application that automatically generates comprehensive test cases from uploaded documents using advanced AI technology.

## 🎯 Overview

Clause2Case transforms business requirement documents into actionable, comprehensive test cases through AI-powered analysis. The platform is designed for enterprise QA teams to accelerate test case creation, improve coverage, and maintain quality standards across complex business workflows.

**Key Capabilities:**
- **AI Test Case Generation**: Automatically generates 15 diverse test cases per document covering functional, compliance, edge case, and integration scenarios
- **Multi-Format Support**: Processes PDF, DOC/DOCX, and TXT documents
- **Manual Test Case Management**: CSV upload and manual entry for existing test cases
- **Professional Reporting**: Generate and download comprehensive PDF test case reports
- **Enterprise Integration Ready**: Built for integration with Salesforce CRM, SAP Enterprise, and HR Portal systems

---

## 🧠 AI Architecture & Test Case Generation

### AI Technology Stack

**Primary AI Engine:**
- **Google Gemini 2.5 Flash** - Production AI model for all test case generation
- Comprehensive error handling and retry logic
- Real-time monitoring and logging
- Optimized for reliability and speed

**RAG (Retrieval-Augmented Generation) Pipeline:**
1. **Document Processing** - Extracts text from uploaded documents
2. **Intelligent Chunking** - Breaks documents into contextual segments
3. **Vector Embeddings** - Converts chunks to semantic vectors using OpenAI embeddings
4. **Context Retrieval** - Finds relevant document sections via similarity search
5. **AI Generation** - Gemini analyzes context and generates structured test cases

**Vector Database:**
- PostgreSQL with pgvector extension for embedding storage and similarity search
- Efficient nearest-neighbor search for context retrieval


### Test Case Generation Process

**Phase 1: Document Analysis**
- Extracts business rules, workflows, and requirements
- Identifies edge cases, compliance requirements, and integration points
- Analyzes potential failure scenarios and boundary conditions

**Phase 2: Rule Validation**
- Validates extracted rules against document context
- Ensures completeness and accuracy
- Cross-references business logic

**Phase 3: Test Case Generation**
- Generates exactly 15 comprehensive test cases per document
- **Category Distribution:**
  - Functional Tests: ~6 cases (40%) - Core business logic validation
  - Edge Case Tests: ~5 cases (30%) - Boundary conditions and error scenarios
  - Compliance Tests: ~3 cases (20%) - Regulatory and security requirements
  - Integration Tests: ~1 case (10%) - System interaction validation
- **Priority Assignment**: High/Medium/Low based on business criticality
- **Severity Assignment**: High/Medium/Low based on operational impact
- **Persona Assignment**: Hourly Employee, HR Admin, Salaried Employee, System Admin, etc.
- **Detailed Steps**: Each test case includes 5-10 specific, executable steps

**Output Format:**
```json
{
  "title": "Descriptive test case name",
  "category": "functional|edge_case|compliance|integration",
  "priority": "high|medium|low",
  "severity": "High|Medium|Low",
  "persona": "HR Admin|System Admin|etc",
  "description": "Clear test objective",
  "steps": "Step 1: Action\nStep 2: Verification\n...",
  "expectedResults": "Specific, measurable outcomes",
  "tags": ["domain", "system", "risk-level"]
}
```

---

## 🛠 Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Components**: 
  - Radix UI primitives for accessibility
  - shadcn/ui design system for enterprise-grade components
- **Styling**: Tailwind CSS with custom enterprise design tokens
- **State Management**: TanStack Query (React Query v5) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation
- **Theme**: Dark/light mode with system preference detection

### Backend
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API**: RESTful endpoints with JSON responses
- **File Processing**: 
  - Multer for file uploads
  - pdf-parse for PDF extraction
  - mammoth for DOC/DOCX processing
- **Session Management**: Express-session with PostgreSQL store
- **Authentication**: Role-based access control (RBAC)

### Database
- **Primary Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM for type-safe database operations
- **Vector Storage**: pgvector extension for embedding-based search
- **Migration Tool**: Drizzle Kit for schema management
- **Connection Pooling**: Built-in with Neon serverless

**Database Schema:**
- Users (authentication and roles)
- Internal Tools (Salesforce, SAP, HR Portal integrations)
- Customers (linked via solution_id)
- Documents (uploaded files with metadata)
- Test Cases (AI-generated and manual)
- Document Embeddings (RAG vector storage)
- Processing Jobs (async job tracking)

### AI Services
- **Google Gemini API**: Primary AI model for test case generation
- **OpenAI API**: Text embeddings (text-embedding-ada-002) for RAG
- **Integration**: Direct API integration with environment-based configuration

### Development Tools
- **Development Environment**: Replit with live preview
- **Package Manager**: npm
- **Code Quality**: TypeScript strict mode, ESLint
- **Build System**: 
  - Vite for frontend bundling
  - esbuild for backend compilation

---

## 📋 Demo Flow (7-8 Minutes)

### **Part 1: AI Test Case Generation (4-5 minutes)**

**Step 1: Document Upload (30 seconds)**
- Navigate to Documents module
- Click "Upload Document" 
- Select a business requirements document (PDF/DOC)
- Show file validation and upload confirmation

**Step 2: AI Processing (2-3 minutes)**
- Demonstrate real-time AI generation
- Explain RAG pipeline: "The system extracts text, creates semantic embeddings, and uses Google Gemini to analyze the document"
- Show processing indicators and status updates
- Result: 15 AI-generated test cases displayed

**Step 3: Review Test Cases (1 minute)**
- Navigate through the 4-step wizard to Step 4: Review & Submit
- Highlight key features:
  - Category distribution (Functional, Edge Case, Compliance, Integration)
  - Priority and Severity assignments
  - Persona assignments for different user roles
  - Detailed test steps (5-10 per case)
- Show inline editing capability (click Edit, modify title/category, Save)
- Demonstrate test steps viewer (eye icon opens dialog)

**Step 4: Manual Test Cases (30 seconds)**
- Show manual entry form
- Mention CSV upload capability
- Emphasize hybrid approach: "AI-generated plus manual for complete coverage"

**Step 5: Report Generation (1 minute)**
- Complete customer information form
- Generate PDF report
- Download and open the professional test case report
- Show formatted test cases with all details

### **Part 2: Other Demoable Modules (2-3 minutes)**

**Dashboard** (30 seconds)
- Overview of test case statistics
- Recent activity and processing status

**Internal Tools** (30 seconds)
- Show Salesforce CRM, SAP Enterprise, HR Portal integrations
- Explain customer solution_id tracking across systems

**Test Case Management** (1 minute)
- Filter and search test cases
- Export capabilities
- Bulk operations

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database with pgvector extension
- Google Gemini API key
- OpenAI API key (for embeddings)

### Environment Variables
```bash
DATABASE_URL=postgresql://...
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
NODE_ENV=development
```

### Installation & Running

The application will be available at `http://localhost:5000`

**Default Login:**
- Username: `admin`
- Password: `password`

---

## 🎨 Design System

**Color Palette:**
- Dark mode primary with professional blue accents
- Enterprise-focused Carbon Design System patterns

**Typography:**
- UI: Inter font family
- Code: JetBrains Mono

**Components:**
- Consistent spacing and interaction patterns
- Accessible Radix UI primitives
- Professional shadcn/ui component library

---

## 📊 System Performance

**Test Case Generation:**
- Average processing time: 15-30 seconds per document
- Generates 15 comprehensive test cases per document
- Supports documents up to 50 pages

**Scalability:**
- Serverless PostgreSQL with automatic scaling
- Optimized AI prompts for fast response times
- Efficient vector search with pgvector

---

## 🔐 Security Features

- Role-based authentication (Admin-only in demo)
- Session-based security with expiration
- Secure API key management via environment variables
- Input validation with Zod schemas
- SQL injection protection via Drizzle ORM

---

## 📝 Future Roadmap

- GitHub integration for version control
- Advanced analytics and test coverage metrics
- Multi-user collaboration features
- Integration with Validator platform for workforce management testing
- Automated test execution capabilities
- Custom AI model training for domain-specific improvements

---

## 👥 Target Users

- QA Managers and Test Leads
- Business Analysts
- Compliance Officers
- Enterprise IT Teams
- Software Development Teams

---

## 📞 Support

For questions or issues, contact the development team or refer to the internal documentation.

---

**Built with ❤️ using cutting-edge AI technology to transform business requirements into actionable test cases.**
