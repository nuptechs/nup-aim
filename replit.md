# NuP_AIM - Sistema de Análise de Impacto

## Overview

NuP_AIM (Núcleo de Projetos - Análise de Impacto de Mudanças) is a comprehensive web-based system designed for creating, managing, and exporting impact analysis documents for business projects. It enables authenticated users to document project changes, assess impacts across multiple dimensions (business, technical, operational, financial), identify risks, define mitigation strategies, and generate professional Word documents. The system integrates AI for field extraction from images, supports custom field management, features role-based access control, and includes email verification workflows. The primary goal is to streamline impact analysis, enhance project transparency, and provide robust documentation capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is a React 18 + TypeScript + Vite + Tailwind CSS Single Page Application (SPA) using a component-based architecture. State management is handled by React Context API for global state and `useState`/`useEffect` for local component state. It uses a state-driven navigation strategy without an explicit routing library, focusing on form-centric and modal-based interactions. Styling is utility-first with Tailwind CSS, supporting dark mode and custom theming via CSS variables.

### Backend Architecture

The backend employs a hybrid microservices + monolith approach. The primary backend is an Express.js server on port 5000, using Drizzle ORM for type-safe PostgreSQL queries and a RESTful API design. It includes JWT authentication and CORS middleware. Serverless Netlify Functions are used for email services (SendGrid) and OCR (Google Cloud Vision API) to offload intensive operations. A separate Custom Fields Microservice runs on port 3002 with SQLite, providing an independent, reusable custom field management system via an SDK. A composed development mode allows the Express API and Vite dev server to run seamlessly together.

### Authentication & Authorization

The system uses a hybrid authentication strategy, primarily with local JWT authentication (bcrypt for passwords, localStorage for tokens, 30-minute session timeout). Optionally, it integrates with NuPIdentity SDK for SSO via OIDC/OAuth2. Role-based access control with granular permissions (`{RESOURCE}_{ACTION}`) is implemented, with permissions stored as JSONB in PostgreSQL and validated on both frontend and backend. Security features include CAPTCHA, password confirmation, and CORS.

### Data Storage Solutions

A multi-tier storage architecture is used:
- **Primary Database**: PostgreSQL via Supabase, using a custom `nup_aim` schema, UUID primary keys, and Row-Level Security (RLS).
- **Fallback Storage**: Browser localStorage, used when Supabase is not configured or available, mirroring the PostgreSQL data structure.
- **Custom Fields Storage**: SQLite, managed independently by the Custom Fields Microservice.
- **File Storage**: Images are stored as Base64-encoded strings within the database; document exports are generated client-side.
- **Data Migration**: Drizzle Kit is used for PostgreSQL schema migrations.

### AI Integration

The system integrates AI for enhanced analysis and data extraction:
- **Google Gemini AI**: Used for generating intelligent suggestions for impact analysis, including impacts, risks, mitigation actions, and executive summaries.
- **Field Extraction System**: Offers two options:
    1. **Google Cloud Vision API (OCR)**: Serverless function for extracting text from document images.
    2. **Regex-based Extraction**: Local, regex-based pattern matching for common field types as a fallback.
- An AI Assistant component provides an interactive chat interface for suggestions.

### Premium UX Features

The application incorporates a custom design system with CSS variables for consistent theming (dark/light mode), smooth animations, and responsive design. It includes a comprehensive set of UI components, toast notifications, a dashboard for quick overviews, and an onboarding process for new users. Form UX utilities like auto-save, real-time validation, and keyboard shortcuts enhance usability.

### Document Export System

The system supports two document export approaches:

1. **Standard Export**: Uses the `docx` library for client-side generation of professional Microsoft Word documents. Exports dynamically include analysis data, formatted sections (cover page, scope, impacts, risks, mitigations, conclusions), embedded images, and function point analysis tables.

2. **Template-Based Export**: Uses `docx-templates` library for server-side document generation with customizable templates. Key features:
   - **Custom Templates**: Users can upload DOCX templates with `#$marker#$` placeholders
   - **Dynamic Field Discovery**: Automatic detection of all available database fields (profiles, users, projects, analyses, processes, impacts, risks, mitigations, conclusions, customFieldValues)
   - **Visual Field Mapper**: Premium UX component for mapping template markers to database fields with categorized selection and progress tracking
   - **Template Management**: Full CRUD operations (create, read, update, delete, duplicate) for templates
   - **Marker Parsing**: Automatic extraction and validation of placeholders from uploaded documents

### Document Templates Table

The `documentTemplates` table stores:
- Template metadata (name, description, original filename)
- Base64-encoded file content
- Parsed markers array with context and position
- Field mappings (marker → database field)
- Status flags (isActive, isDefault)
- Usage statistics

## External Dependencies

- **Supabase**: PostgreSQL database hosting, authentication, and Row Level Security.
- **SendGrid**: Transactional email delivery for verification.
- **Google Cloud Vision API**: OCR and document text extraction.
- **Google Gemini AI**: Generative AI for analysis suggestions.
- **Netlify**: Serverless function hosting for email and OCR.
- **Drizzle ORM**: Type-safe database queries for PostgreSQL.
- **Lucide React**: Icon library.
- **Tailwind CSS**: Utility-first CSS framework.
- **docx**: Library for standard Word document generation.
- **docx-templates**: Library for template-based Word document generation with placeholder replacement.
- **file-saver**: Client-side file downloads.
- **bcryptjs**: Password hashing.
- **jsonwebtoken**: JWT token generation/validation.
- **Vite**: Build tool and dev server.
- **TypeScript**: For type safety.
- **ESLint**: Code quality.