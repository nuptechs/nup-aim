# NuP_AIM - Sistema de Análise de Impacto

## Overview

NuP_AIM (Núcleo de Projetos - Análise de Impacto de Mudanças) is a comprehensive web-based system for creating, managing, and exporting impact analysis documents for business projects. The application enables authenticated users to document project changes, assess impacts across multiple dimensions (business, technical, operational, financial), identify risks, define mitigation strategies, and export professional Word documents. The system features AI-powered field extraction from images, custom fields management, role-based access control, and email verification workflows.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack**: React 18 + TypeScript + Vite + Tailwind CSS

**Design Pattern**: Single Page Application (SPA) with component-based architecture

- **State Management**: React Context API for global state (authentication, theme, toast notifications). Local state with useState and useEffect hooks for component-level state.
- **Routing Strategy**: No explicit routing library. Navigation is state-driven through conditional rendering and view switching within the main App component.
- **Component Structure**: Modular, reusable components organized by feature (forms, UI primitives, management panels). Heavy use of TypeScript interfaces for type safety.
- **Styling Approach**: Utility-first CSS with Tailwind CSS. Custom CSS variables for theming and design system consistency. Dark mode support through CSS variables and theme context.
- **Build Tool**: Vite for fast development and optimized production builds. Hot Module Replacement (HMR) for development experience.

**Key Architectural Decisions**:
- **Why Context API**: Chosen over Redux for simpler state management needs. Authentication and theme are global concerns but don't require complex middleware or time-travel debugging.
- **Why No Router**: Application is form-centric with modal-based navigation rather than page-based. This reduces bundle size and simplifies state persistence.
- **Why Tailwind**: Enables rapid UI development with consistent design tokens. Custom CSS variables layer provides theme flexibility without Tailwind config complexity.

### Backend Architecture

**Hybrid Microservices + Monolith Approach**

**Primary Backend**: Express.js server with Drizzle ORM
- **Port**: 5000 (development), configurable via PORT env var
- **Database ORM**: Drizzle ORM for type-safe PostgreSQL queries
- **API Design**: RESTful with `/api/*` prefix for clear separation from frontend routes
- **Middleware Stack**: CORS (configurable origins), JSON body parser (5MB limit), JWT authentication for protected routes
- **Development Mode**: Combined Vite dev server + Express API server on same port for seamless DX

**Serverless Functions** (Netlify Functions):
- **Email Service**: SendGrid integration via serverless function for email verification
- **OCR Service**: Google Cloud Vision API integration for document text extraction
- **Rationale**: Offload expensive I/O operations to serverless to keep main server responsive. Secrets management handled by Netlify environment variables.

**Custom Fields Microservice**:
- **Port**: 3002
- **Database**: SQLite (independent from main PostgreSQL)
- **Architecture**: Standalone service with framework-agnostic JavaScript SDK
- **SDK Design**: Single-file, zero-dependency SDK served at `/widgets/custom-fields-sdk.js`
- **Features**: Admin panel for field management, drag-and-drop reordering, 10+ field types
- **Integration**: React hooks wrapper for seamless integration with main app
- **Rationale**: Decoupled architecture allows custom fields service to be reused across multiple applications. SQLite eliminates database dependency conflicts.

**Development Server Strategy**:
- Uses composed development mode where Express API and Vite dev server run together
- Vite middleware mode allows API and frontend on same origin (eliminates CORS issues)
- `COMPOSED_DEV` environment variable signals composed mode

### Authentication & Authorization

**Hybrid Authentication Strategy**:

**Primary**: Supabase Authentication (production)
- Email/password authentication with JWT tokens
- Email verification workflow with expiring tokens
- Row Level Security (RLS) policies on PostgreSQL tables
- Session timeout: 30 minutes with activity monitoring
- Token stored in localStorage with last activity timestamp

**Fallback**: Local Storage Authentication (development)
- Enables development without Supabase connection
- Uses bcrypt for password hashing
- Hardcoded admin credentials for quick testing
- Automatically switches based on environment variable presence

**Permission System**:
- Role-based access control with granular permissions
- Two default profiles: Administrator (full access), Standard User (limited)
- Permissions structure: `{RESOURCE}_{ACTION}` (e.g., `ANALYSIS_CREATE`, `USERS_DELETE`)
- Permissions stored as JSONB array in PostgreSQL
- Frontend checks permissions before rendering UI elements or allowing actions
- Backend validates permissions on protected routes via JWT middleware

**Session Management**:
- Automatic logout after 30 minutes of inactivity
- Warning modal 5 minutes before expiration
- Activity events tracked: mousedown, mousemove, keypress, scroll, touchstart
- Session state validated on every protected API call

**Security Features**:
- CAPTCHA on login (canvas-based, regenerates on error)
- Password confirmation on user creation
- JWT secret must be 32+ characters in production
- CORS configured with explicit origin whitelist
- Rate limiting on authentication endpoints (implied by middleware structure)

### Data Storage Solutions

**Multi-Tier Storage Architecture**:

**Primary Database**: PostgreSQL via Supabase
- **Schema**: Custom `nup_aim` schema for namespace isolation
- **Tables**: profiles, users, projects, analyses, processes, impacts, risks, mitigations, conclusions
- **Key Design**: UUID primary keys with `gen_random_uuid()` for distributed-friendly IDs
- **Relationships**: Foreign keys with ON DELETE RESTRICT for data integrity
- **Timestamps**: All tables have created_at/updated_at with automatic now() defaults
- **RLS Policies**: Row-level security for multi-tenant data isolation

**Fallback Storage**: Browser localStorage
- Used when Supabase not configured or connection fails
- Stores same data structures as PostgreSQL (serialized as JSON)
- Keys: `nup_aim_users`, `nup_aim_profiles`, `nup_aim_projects`, `nup_aim_analyses`
- Session data: `nup_aim_session`, `nup_aim_last_activity`

**Custom Fields Storage**: SQLite (independent microservice)
- Tables: sections, custom_fields, field_values
- Enables field definitions to persist independently of main database
- Supports field reordering via position column

**File Storage Strategy**:
- **Images**: Base64-encoded inline in database (text fields)
- **Exports**: Client-side Word document generation (no server storage)
- **Rationale**: Eliminates need for object storage service. Suitable for low-volume use cases. Trade-off: larger database size for simpler architecture.

**Data Migration**: Drizzle Kit
- Migrations stored in `/migrations` directory
- Push-based deployment with `drizzle-kit push`
- Schema source of truth: `server/schema.ts`

### AI Integration

**Gemini AI Integration**:
- **Purpose**: Generate intelligent suggestions for impact analysis
- **API**: Google Generative AI SDK (`@google/genai`)
- **Endpoint**: Custom base URL via `AI_INTEGRATIONS_GEMINI_BASE_URL`
- **Features**:
  - Suggest impacts based on title, description, affected processes
  - Categorize impacts (business, technical, operational, financial)
  - Identify risks with probability and severity estimates
  - Recommend mitigation actions with priority levels
  - Generate executive summary and recommendations
- **Implementation**: Server-side function `generateAnalysisSuggestions` in `server/gemini.ts`
- **Error Handling**: Graceful degradation if API unavailable

**Field Extraction System**:

**Option 1**: Google Cloud Vision API (OCR-based)
- Extract text from document images via DOCUMENT_TEXT_DETECTION
- Serverless function at `/api/vision-ocr` (Netlify Function)
- Credentials via `GOOGLE_APPLICATION_CREDENTIALS_JSON` environment variable
- Fallback to local regex-based extraction if Vision API unavailable

**Option 2**: Regex-based Extraction (local, no API calls)
- Pattern matching for common field types (email, phone, date, CPF, CNPJ, etc.)
- Statistical analysis: field type distribution, complexity scoring
- Function point estimation based on detected field counts
- Implementation: `client/src/utils/regexFieldExtractor.ts`
- Used as fallback when Vision API not configured

**AI Assistant Component**:
- Chat interface for interactive analysis suggestions
- Context-aware based on current analysis data
- Supports message history and conversation flow
- Copy-to-clipboard functionality for suggestions
- Floating widget accessible from form view

### Premium UX Features

**Design System** (`client/src/styles/design-system.css`):
- CSS variables for consistent theming (colors, shadows, gradients)
- Smooth animations and micro-interactions
- Premium glow effects and glass morphism styles
- Responsive design tokens

**UI Components** (`client/src/components/ui/`):
- Button, Input, Card, Modal - Core primitives with variants
- Badge, Progress - Status indicators with animations
- Toast, LoadingSpinner - Feedback components
- ThemeToggle - Dark/light mode switcher
- FormProgressIndicator - Form completion tracking

**Theme System** (`client/src/contexts/ThemeContext.tsx`):
- Dark and light mode with system preference detection
- Smooth CSS transitions between themes
- Persisted preference in localStorage
- ThemeToggle component for manual switching

**Toast Notifications** (`client/src/contexts/ToastContext.tsx`):
- Multiple toast types: success, error, warning, info, ai
- Animated entry/exit transitions
- Auto-dismiss with configurable duration
- Action buttons support

**Dashboard** (`client/src/components/Dashboard.tsx`):
- Quick statistics overview (analyses, projects, users, impacts, risks)
- Quick actions for common tasks
- Recent analyses list
- Permission-aware rendering

**Onboarding** (`client/src/components/Onboarding.tsx`):
- Multi-step guided tour for new users
- Feature highlights with icons and descriptions
- Progress indicators
- Skip option for returning users
- Persisted completion state

**Form UX Utilities** (`client/src/hooks/useAutoSave.ts`):
- useAutoSave: Auto-save with debounce and status tracking
- useFormValidation: Real-time field validation
- useFormProgress: Form completion percentage
- useKeyboardShortcuts: Global keyboard shortcuts

### Document Export System

**Technology**: `docx` library for Microsoft Word generation

**Export Features**:
- Professional document formatting with headers, footers, tables
- Dynamic content sections based on analysis data
- Severity and status badges with colored backgrounds
- Embedded images (Base64-decoded from storage)
- Function point analysis tables with complexity calculations
- Client-side generation (no server processing required)

**Document Structure**:
1. Cover page with project metadata
2. Basic information (title, author, date, version)
3. Scope and affected processes
4. Categorized impacts (business, technical, operational, financial)
5. Risk assessment matrix
6. Mitigation action plan
7. Conclusions and recommendations
8. Custom fields (dynamically inserted by section)

### External Dependencies

**Core Infrastructure**:
- **Supabase**: PostgreSQL database + authentication service
  - Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - Features: Database hosting, Auth, Row Level Security, Real-time subscriptions (not currently used)
  - Free tier: Sufficient for development and small deployments

**Email Service**:
- **SendGrid**: Transactional email delivery
  - Environment: `SENDGRID_API_KEY`, `VERIFIED_SENDER_EMAIL`
  - Usage: Email verification, password reset (future feature)
  - Free tier: 100 emails/day
  - Integration: Netlify Function at `/netlify/functions/send-email`

**AI Services**:
- **Google Cloud Vision API**: OCR and document analysis
  - Environment: `GOOGLE_APPLICATION_CREDENTIALS_JSON`
  - Features: Text detection, document structure analysis
  - Pricing: Pay-per-use (first 1,000 requests/month free)
  
- **Google Gemini AI**: Generative AI for analysis suggestions
  - Environment: `AI_INTEGRATIONS_GEMINI_API_KEY`, `AI_INTEGRATIONS_GEMINI_BASE_URL`
  - Features: Text generation, contextual suggestions
  - Custom endpoint support for enterprise deployments

**Development Tools**:
- **Netlify**: Serverless function hosting + deployment
  - Functions: Email sending, OCR processing
  - Environment variables managed in Netlify dashboard
  
- **Drizzle ORM**: Type-safe database queries
  - Dialect: PostgreSQL
  - Migration strategy: Push-based (no version tracking)

**Frontend Libraries**:
- **Lucide React**: Icon library (tree-shakeable, modern)
- **Tailwind CSS**: Utility-first CSS framework
- **docx**: Word document generation
- **file-saver**: Client-side file downloads
- **bcryptjs**: Password hashing (fallback auth)
- **jsonwebtoken**: JWT token generation/validation

**Build & Development**:
- **Vite**: Build tool and dev server
- **TypeScript**: Type safety across codebase
- **ESLint**: Code quality and consistency
- **tsx**: TypeScript execution for server (development)
- **esbuild**: Server bundling (production)