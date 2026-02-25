# Base44 Learning Companion

This repo contains the Base44-generated React frontend plus a custom Express/Prisma backend that mirrors the Base44 API surface. You can develop and test locally without connecting to Base44 cloud services, then publish as usual through the Base44 Builder.

## Prerequisites

- Node.js 20+ and npm 9+
- SQLite (bundled with Prisma; no extra install needed)
- Optional: Docker / Docker Compose for containerized runs

## Repository Layout

```
Base.44.copy/
├── scr/                 # Vite + React frontend
├── server/              # Express API, Prisma schema, seed script
├── docs/BACKEND.md      # Deep dive into backend architecture & Docker options
└── docker-compose.yml   # Launch backend + Vite dev server together
```

## Step 1 – Back-end API

1. Install dependencies and prepare env:
   ```sh
   cd server
   npm install
   cp .env.example .env   # edit if you need different ports, models, secrets
   ```
2. Migrate + seed the SQLite database:
   ```sh
   npx prisma migrate dev --name init
   npm run prisma:seed
   ```
   The seed creates:
   - Instructor: `instructor@example.com` / `Instructor!123`
   - Student: `student@example.com` / `Student!123`
   - Example course, assignment, flashcards, and enrollments
3. Run the backend (default `http://localhost:4000`):
   ```sh
   npm run dev
   ```
   - `/api/apps/base-44-app/auth/login` issues JWTs.
   - `/api/apps/base-44-app/entities/*` powers the SDK calls used in the frontend.
   - LLM provider defaults to `mock`; switch to `ollama` or `openai` by editing `.env`.

## Step 2 – Front-end (Vite)

1. From the repo root:
   ```sh
   npm install
   ```
   Create `./.env.local` (or edit the existing file) with:
   ```
   VITE_BASE44_APP_ID=base-44-app
   VITE_BASE44_APP_BASE_URL=http://localhost:5173
   ```
2. Start the dev server:
   ```sh
   npm run dev
   ```
   Vite proxies `/api/*` to the backend on port 4000 (configured in `vite.config.js`).
3. Authenticate: call the backend login endpoint (or use `curl`/Postman) to obtain `access_token`, then open `http://localhost:5173/?access_token=TOKEN` so the SDK picks it up.

## Optional – Docker

`docs/BACKEND.md` covers:
- Building the backend image (`server/Dockerfile`)
- Running `docker compose up --build` for a full-stack environment
- File-storage volumes and LLM provider knobs

## Publishing Back to Base44

1. Push changes to the connected Git repository – Base44 Builder mirrors the repo.
2. Visit [Base44.com](https://Base44.com), open your project, and click **Publish**.

## Support & Further Reading

- Documentation: <https://docs.base44.com/Integrations/Using-GitHub>
- Support: <https://app.base44.com/support>
- Backend implementation notes: `docs/BACKEND.md`
