# TrustBase AI — Product Requirements Document

## Overview
**Product Name:** TrustBase AI  
**Mission:** Automate vendor questionnaire answering with AI precision  
**Last Updated:** February 2026

---

## Problem Statement
Businesses spend hours manually answering vendor security questionnaires. AnswerIQ uses AI to automatically answer these questionnaires by referencing the user's own documents (security policies, SOC 2 reports, etc.), with citations and "Not found in references" fallback.

---

## User Personas
- **Compliance Officers** — Need to respond to vendor questionnaires quickly and accurately
- **Security Teams** — Manage SOC 2, ISO 27001, NIST documentation
- **Sales/Procurement Teams** — Handle RFPs and vendor due diligence requests

---

## Architecture
- **Frontend:** React 19 + Tailwind CSS + shadcn/ui (dark navy theme)
- **Backend:** FastAPI (Python) with async background task processing
- **Database:** MongoDB (motor async driver)
- **AI:** OpenAI GPT-4o via emergentintegrations (EMERGENT_LLM_KEY)
- **Auth:** JWT-based (python-jose + passlib/bcrypt)

### Backend Files
- `server.py` — FastAPI app, CORS, router registration
- `database.py` — MongoDB client (motor)
- `models.py` — Pydantic models (UserModel, DocumentModel, QuestionnaireModel, QuestionnaireAnswer)
- `auth.py` — JWT helpers, password hashing, get_current_user dependency
- `auth_routes.py` — /api/auth/register, /api/auth/login, /api/auth/me
- `document_routes.py` — /api/documents CRUD (PDF/TXT upload, text extraction)
- `questionnaire_routes.py` — /api/questionnaires CRUD + /process + /download
- `ai_service.py` — GPT-4o answering with citations, batched (20 questions/batch)

### Frontend Files
- `App.js` — React Router with ProtectedRoute
- `context/AuthContext.js` — JWT auth state management
- `pages/LandingPage.jsx` — Public landing page
- `pages/AuthPage.jsx` — Login/signup toggle
- `pages/Dashboard.jsx` — Document library + questionnaire history
- `pages/NewQuestionnaire.jsx` — Multi-step upload + processing workflow
- `pages/Results.jsx` — Q&A table with citations + CSV download
- `components/DashboardLayout.jsx` — Sidebar layout for authenticated pages

---

## API Endpoints
```
POST /api/auth/register    — Create account {name, email, password}
POST /api/auth/login       — Login {email, password} → token
GET  /api/auth/me          — Get current user

GET    /api/documents          — List user's reference documents
POST   /api/documents          — Upload PDF/TXT reference document
DELETE /api/documents/{id}     — Delete document

GET  /api/questionnaires            — List user's questionnaires
POST /api/questionnaires            — Upload questionnaire (parses questions)
GET  /api/questionnaires/{id}       — Get questionnaire + answers
POST /api/questionnaires/{id}/process  — Start AI processing (background task)
GET  /api/questionnaires/{id}/download — Download answered CSV
```

---

## Core Requirements (Static)
1. JWT-based authentication (email + password)
2. Reference document upload (PDF, TXT) — persisted per user in MongoDB
3. Questionnaire upload (PDF, TXT) — questions auto-parsed
4. AI answering using GPT-4o with citations from reference docs
5. "Not found in references" fallback for missing information
6. CSV download of answered questionnaire
7. Dark navy + white design with subtle gradients

---

## What's Been Implemented (Feb 2026)
- [x] Landing page (navbar, hero, how-it-works, features bento, CTA, footer)
- [x] JWT auth (register, login, me endpoint, protected routes)
- [x] Reference document upload (PDF/TXT extraction, stored in MongoDB)
- [x] Document management (list, delete per user)
- [x] Questionnaire file upload — smart parser (Q1/Q2 style, numbered+?, line "?" fallback, title skip)
- [x] AI processing via GPT-4o with background tasks, full document context (45k chars/doc)
- [x] Confidence scores: HIGH / MEDIUM / LOW (AI-assessed)
- [x] Evidence snippets: exact passage per answer, collapsible "View Evidence"
- [x] Answer citations: source document + supporting quote
- [x] "Not found in references" fallback
- [x] Editable answers: Edit/Save/Cancel per card, persisted via PATCH endpoint, "Edited" badge
- [x] Per-question regenerate: re-run AI for a single question (synchronous)
- [x] Full "Regenerate Answers": saves current answers as versioned snapshot first
- [x] Version history: dropdown to view any previous run's full answers
- [x] Coverage summary card: total, answered, not-found, confidence bars, progress bar
- [x] DOCX export: professional report with cover, confidence colors, citations, evidence
- [x] Results page polling (3s interval) while AI processes
- [x] Dashboard with stats, tabs (Documents / Questionnaires)
- [x] Design: Plus Jakarta Sans, dark navy (#020817), sky blue (#38BDF8)
- [x] Delete Questionnaire: three-dot menu per row → dropdown → confirmation dialog → DELETE /api/questionnaires/{id} (tested Feb 2026)

---

## Prioritized Backlog

### P0 — Critical (Core flow gaps)
- None currently known

### P1 — High Value
- [ ] Questionnaire name editing
- [ ] Re-process questionnaire with different documents
- [ ] Pagination for large document/questionnaire lists
- [ ] Email notifications when processing completes

### P2 — Nice to Have
- [ ] Support for more file types (DOCX, XLSX questionnaires)
- [ ] Vector search / semantic matching for better citation accuracy
- [ ] Manual answer editing after AI generation
- [ ] Team/organization accounts with shared document libraries
- [ ] Questionnaire templates library
- [ ] Usage analytics dashboard

---

## Next Tasks
1. Add shareable read-only results link for vendors/stakeholders (P2)
2. Add questionnaire name editing from Dashboard
3. Add re-process with different documents option
4. Add DOCX upload support for questionnaire/document uploads
