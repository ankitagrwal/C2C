# Overview

Clause2Case is an enterprise AI-powered test case generation platform that transforms business documents into comprehensive test cases. The platform integrates with internal tools like Salesforce CRM, SAP Enterprise, and HR Portal to manage customers and their document processing workflows. Built as a modern web application with a React frontend and Express backend, it leverages AI capabilities through OpenAI's GPT-4 and embedding models, combined with RAG (Retrieval-Augmented Generation) for context-aware test case generation. The system processes various document formats (.pdf, .doc/.docx, .txt) and generates categorized test cases including functional tests, compliance tests, edge cases, and integration tests.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript in a Vite development environment
- **UI Library**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS with custom design tokens following enterprise design patterns
- **State Management**: TanStack Query (React Query) for server state management
- **Theme System**: Dark/light mode support with theme persistence
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Session-based authentication with role-based access control
- **File Processing**: Document upload and parsing system for multiple formats
- **Storage Interface**: Abstracted storage layer with in-memory implementation for development

## Database Design
- **Primary Database**: PostgreSQL (configured via Drizzle)
- **Vector Storage**: pgvector extension for embedding storage and similarity search
- **Schema**: Comprehensive tables for users, internal tools, customers, documents, test cases, and processing jobs
- **Key Relationships**: Customer-document associations, solution_id as unique identifier across tools

## AI Integration
- **RAG Implementation**: Document chunking and vector search for context-aware generation
- **OpenAI Integration**: GPT-4 for test case generation and text embeddings for document processing
- **Processing Pipeline**: Two-phase AI workflow (Analysis → Rule Validation → Generation)
- **Context Management**: RAG context tracking for transparency in test case generation

## Authentication & Security
- **Admin-only Access**: Role-based authentication system
- **Session Management**: Local storage with expiration handling
- **Mock Authentication**: Demo credentials for development (admin/password)

## Design System
- **Approach**: Enterprise-focused design system based on Carbon Design System patterns
- **Color Palette**: Dark mode primary with professional blue accents
- **Typography**: Inter for UI, JetBrains Mono for code elements
- **Components**: Comprehensive component library with consistent spacing and interaction patterns

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL with pgvector support for production
- **Connection**: Environment variable-based configuration through DATABASE_URL

## AI Services
- **OpenAI**: GPT-4 model for test case generation and text-embedding-ada-002 for document embeddings
- **Integration**: Direct API integration with pre-configured API keys

## Development Tools
- **Replit Integration**: Development environment with cartographer plugin for debugging
- **Build System**: Vite for frontend bundling, esbuild for backend compilation
- **Database Management**: Drizzle Kit for schema migrations and database operations

## UI Dependencies
- **Radix UI**: Comprehensive primitive component library for accessibility
- **Lucide React**: Icon library for consistent iconography
- **Date-fns**: Date manipulation and formatting utilities
- **Embla Carousel**: Carousel component for content display

## Internal Tool Integrations
- **PMAP**: Policy Management and Assessment Platform for compliance tracking
- **Navigator**: System Navigation and Integration Hub for unified access
- **FileCheck**: File validation and processing system
- **Mock Integration**: Development-friendly mock APIs for tool connections