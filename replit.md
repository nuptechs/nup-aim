# NuP_AIM - Sistema de Análise de Impacto

## Overview

NuP_AIM is a comprehensive impact analysis management system designed for enterprise use. The application enables authenticated users to create, edit, manage, and export structured impact analysis documents. Key features include user authentication with email verification, role-based permissions, AI-powered document import, field extraction using OCR, and Word document export capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, bundled with Vite
- **Styling**: Tailwind CSS with custom design system variables
- **State Management**: React Context API for authentication and global state, local component hooks for UI state
- **UI Components**: Custom component library with Lucide React icons
- **Routing**: Single-page application with state-based navigation (no router library)

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript compiled with tsx/esbuild
- **API Design**: RESTful endpoints with JWT authentication
- **Middleware**: CORS protection, JSON body parsing, authentication middleware
- **Development**: Hot reload via Vite middleware integration

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `server/schema.ts` defines all tables in a dedicated `nup_aim` PostgreSQL schema
- **Connection**: Uses `postgres` package with connection URL from `DATABASE_URL` environment variable
- **Tables**: profiles, users, projects, analyses, processes, impacts, risks, mitigations, conclusions

### Authentication & Security
- **Method**: JWT-based authentication with bcrypt password hashing
- **Session**: 30-minute timeout with activity monitoring
- **Permissions**: Granular role-based access control tied to user profiles
- **Email Verification**: Token-based email verification system

### Auto-Save System
- **Session Persistence**: Analysis data is saved to sessionStorage immediately on any change
- **Database Auto-Save**: Data is automatically saved to the database as a draft after 3 seconds of inactivity (debounced)
- **Permission-Aware**: Auto-save respects role-based permissions (requires ANALYSIS CREATE or EDIT permission)
- **Recovery**: When returning to the app, any in-progress analysis is automatically restored from sessionStorage
- **Visual Indicator**: Shows "Salvando automaticamente..." when saving to database

### AI/ML Integrations
- **Document Analysis**: Google Gemini AI for generating analysis suggestions
- **OCR**: Google Cloud Vision API for field extraction from images
- **Field Extraction**: Regex-based fallback when AI services unavailable
- **Function Point Analysis**: Multi-agent pipeline for IFPUG CPM 4.3.1 compliant extraction (v3.2.0)
  - **Stage 1 (Scan Agent)**: Comprehensive document scan to identify functionality candidates
  - **Stage 2 (Expansion Agent)**: Review, separate combined entities, and expand candidates with few-shot examples
  - **Stage 3 (Classification Agent)**: Apply IFPUG type (ALI, AIE, EE, SE, CE) and complexity classification
  - **Stage 4 (Citation Validation)**: Verify quoted citations exist in source document using fuzzy matching
  - **Stage 5 (Discovery Agent)**: Second-pass to find implicit/hidden functionalities (CRUD derivations, integrations mentioned in passing)
  - **Features**: Dynamic context sizing, 3-state confidence indicators, hallucination detection via citation verification
- **WorkspaceCapture**: Multimodal input component accepting text, images, and documents for AI analysis
- **FPA Guidelines System**: Persistent domain knowledge rules that are automatically injected into AI prompts based on trigger phrases and business domains. Managed via admin UI at "Gerenciar Diretrizes de APF"

## External Dependencies

### Required Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (required)
- `JWT_SECRET` - Secret key for JWT signing (minimum 32 characters, required in production)
- `AI_INTEGRATIONS_GEMINI_API_KEY` - Google Gemini API key for AI features
- `AI_INTEGRATIONS_GEMINI_BASE_URL` - Gemini API base URL
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` - Google Cloud Vision credentials (JSON format)
- `SENDGRID_API_KEY` - SendGrid API key for email delivery
- `VERIFIED_SENDER_EMAIL` - Verified sender email for SendGrid

### Third-Party Services
- **PostgreSQL**: Primary database (provision via Replit Database or external provider)
- **SendGrid**: Email delivery for verification emails
- **Google Cloud Vision**: OCR and document text extraction
- **Google Gemini AI**: Intelligent analysis suggestions and document processing

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit` - Database ORM and migrations
- `express` - Web server framework
- `jsonwebtoken` / `bcryptjs` - Authentication
- `docx` - Word document generation
- `@google-cloud/vision` - OCR integration
- `@google/genai` - Gemini AI integration
- `@sendgrid/mail` - Email delivery