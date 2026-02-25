# Base44 Prototype Backend

This backend replaces the hosted Base44 APIs so that the existing frontend can run locally with full CRUD, AI feedback, and dashboard insights.

## Features

- Authentication with JWT + seeded demo users (`admin` instructor, `student` learner)
- REST-compatible `/api/apps/:appId/entities/*` endpoints consumed by the SDK
- Course + assignment CRUD with automatic ingestion of uploaded content into a lightweight RAG store
- Assignment submissions with structured AI feedback (hint-only aware)
- Flashcard generation endpoints with policy enforcement
- File uploads with PDF text extraction and preview metadata
- Local/LAN-friendly LLM integrations: `mock` (deterministic), `ollama`, or `openai`
- Docker + docker-compose recipes for one-command startup
- Prisma schema + seeds for SQLite storage

## Project Layout

```
server/
  src/
    routes/        API routes (auth, entities, integrations)
    services/      Prisma, RAG, LLM, policy, and file helpers
    lib/           env + JWT + Prisma singletons
  prisma/          Schema + seed script
  Dockerfile       Production build for the backend
```

Uploads are written to `storage/uploads` (mounted inside Docker as a volume).

## Getting Started

1. Install dependencies
   ```sh
   cd server
   npm install
   ```
2. Generate the Prisma client and run the initial migration
   ```sh
   npx prisma migrate dev --name init
   npm run prisma:seed
   ```
3. Copy the example env and adjust secrets if needed
   ```sh
   cp .env.example .env
   ```
4. Start the backend (default port `4000`)
   ```sh
   npm run dev
   ```
5. In another terminal run the Vite app (root folder)
   ```sh
   npm run dev
   ```

The Vite dev server already proxies `/api/*` to `http://localhost:4000` (see `vite.config.js`).

## Demo Credentials

| Role       | Email                        | Password      |
|------------|------------------------------|----------------|
| Instructor | `instructor@example.com`     | `Instructor!123` |
| Student    | `student@example.com`        | `Student!123` |

Obtain an access token by calling `POST /api/apps/base-44-app/auth/login` with the credentials above. When running locally you can append `?access_token=...` to the Vite URL to skip the login screen.

## LLM Providers

Configure these via `server/.env`:

- `LLM_PROVIDER=mock` (default) – deterministic educational hints, no external calls
- `LLM_PROVIDER=ollama` – streams to a local Ollama server (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`)
- `LLM_PROVIDER=openai` – uses `OPENAI_API_KEY` + `OPENAI_MODEL`

All providers inject course policies + retrieved chunks before responding. Hint-only courses get automatic guardrails.

## Docker

### Backend only
```sh
cd server
docker build -t base44-backend .
docker run --env-file .env.example -p 4000:4000 base44-backend
```

### Full stack (backend + Vite)
```sh
docker compose up --build
```
This brings up `backend` on port 4000 and the Vite dev server on port 5173.

## Testing / Linting

```sh
cd server
npm run lint
npm run build
```

(Commands require `npm install` to have completed.)
