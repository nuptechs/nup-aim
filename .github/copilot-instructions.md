# nup-aim — AI Agent Guidelines

## Overview

AI-powered impact analysis generator for software projects. Extracts features from documents (DOC, DOCX, PDF) using Google Vision + Gemini AI, then generates structured impact analyses with severity classification, risk assessment, and mitigation strategies.

## Tech Stack (Firmly Decided)

| Layer | Technology |
|-------|-----------|
| Backend | Express + TypeScript ESM |
| Frontend | React + Vite |
| Database | PostgreSQL + Drizzle ORM |
| AI / LLM | Anthropic Claude, Google Vision API, Gemini API |
| Document Parsing | mammoth.js (DOCX), Google Vision (OCR) |
| Deploy | Netlify (frontend), Node.js server |

## Project Structure

```
server/
  index.ts               ← Express entry point (Vite dev or static serving)
  schema.ts              ← Drizzle schema (nup_aim postgres schema)
  routes/                ← API routes
  services/              ← AI and document processing services
client/src/              ← React SPA
build-server.js          ← Custom esbuild server build
```

## Database Schema (nup_aim schema)

| Table | Purpose |
|-------|---------|
| `profiles` | Access profiles (RBAC) |
| `users` | User auth (email, password hash, verification) |
| `projects` | Projects with acronyms |
| `analyses` | Impact analyses (title, version, project_id) |
| `processes` | Affected functionality (status: new/altered/deleted) |
| `impacts` | Impact records (severity, probability, category: business/technical/operational/financial) |
| `risks` | Risk records with mitigation strategies |
| `mitigations` | Mitigation actions |

## Key API Routes

```
POST   /api/document-reader     # Extract text from uploaded documents
POST   /api/auth/login          # Authentication
POST   /api/auth/register       # User registration
GET    /api/projects             # List projects
POST   /api/analyses            # Create impact analysis
```

## AI Capabilities

- **Document reading**: Extract structured text from DOC/DOCX/PDF via Gemini
- **Vision API**: Google Cloud Vision for OCR and document image analysis
- **Impact classification**: LLM-driven severity and category assignment
- **Field extraction**: Structured extraction via Gemini API

## Build & Test

```bash
npm run dev              # Dev server (port 5000)
npm run build            # Vite frontend + esbuild server
npm start                # Production
npm run type-check       # TypeScript validation
```

## Key Environment Variables

```bash
ANTHROPIC_API_KEY        # Claude LLM
GOOGLE_VISION_API_KEY    # Google Vision OCR
GOOGLE_GEMINI_API_KEY    # Gemini field extraction
DATABASE_URL             # PostgreSQL
```
