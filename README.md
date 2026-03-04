# TrustBase AI — Short README

## What We Built
- A two-tier application that answers vendor security questionnaires using uploaded reference documents.
- Frontend: Create React App with CRACO, React Router, Tailwind-inspired UI, and shadcn components. Routes: landing, auth, dashboard, questionnaire creation, results. Builds to `frontend/build`.
- Backend: FastAPI providing `/api` endpoints for auth, documents, questionnaires, and AI processing. Persists data in MongoDB via `motor`.
- AI answering: Aggregates document content and calls an LLM (key `EMERGENT_LLM_KEY`) to generate structured answers with confidence, citation, and evidence text.
- Deployment: Vercel hosts the static frontend. `vercel.json` sets `buildCommand`, `outputDirectory`, and SPA rewrites while excluding `/api/*`.

## Assumptions
- Backend is deployed separately (Railway/Render/Fly/FastAPI server) and reachable over HTTPS.
- Environment variables are correctly set:
  - Frontend: `REACT_APP_BACKEND_URL` (base URL of the FastAPI backend, no trailing slash).
  - Backend: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, optional `CORS_ORIGINS`, `EMERGENT_LLM_KEY`.
- MongoDB is available and the connection string has network access from the backend host.
- SPA routing is required; non-API routes should serve `index.html`.
- Typical docs are text or PDF; file sizes within configured limits.

## Trade-offs
- CRA + CRACO instead of Next.js: simpler build but requires manual Vercel configuration (outputDirectory, rewrites). Next.js would offer tighter Vercel integration and serverless/API options.
- Separate backend deployment: clearer responsibility boundaries but adds cross-origin concerns (CORS, env management) and relies on external hosting for FastAPI.
- MongoDB storage of document text: fast to implement; for large PDFs and search, a vector store or chunked indexing would scale better.
- LLM answers from a single prompt: quick iteration; multi-pass retrieval or RAG pipeline would improve accuracy and citations.
- Build stability: we disabled “warnings as errors” (`CI=false`) to avoid blocking deployments; longer term, fix lint issues and enable strict CI again.
- SPA rewrite excludes `/api/*` to avoid swallowing API calls; alternatively, a Vercel proxy rewrite could keep calls same-origin.

## What We’d Improve With More Time
- Migrate frontend to Next.js for streamlined Vercel deploy, API routes, and ISR; or keep CRA and add a Vercel proxy rewrite for `/api/*`.
- Harden auth: password policies, rate limiting, email verification, password reset, and refresh tokens.
- Observability: structured logging, request tracing, error reporting, and metrics for processing tasks.
- Document handling: robust PDF parsing, chunking, embeddings, semantic search, and citation quality checks.
- Storage: move raw files to S3/GCS and store metadata in DB; add lifecycle policies and access controls.
- Testing and CI: end-to-end tests for auth and workflows, lint/type checks, and GitHub Actions pipeline.
- Performance: background workers for AI tasks, queuing, retries, and status websockets.
- DX: configuration templates and scripts, stronger typing, and cleanup of peer-dependency warnings.
