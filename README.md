**Welcome to your Base44 project**

**About**

View and Edit your app on [Base44.com](http://Base44.com)

This project contains everything you need to run your app locally.

**Edit the code in your local development environment**

Any change pushed to the repo will also be reflected in the Base44 Builder.

**Prerequisites:**

1. Clone the repository using the project's Git URL
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Create the required environment files:

| File | Location | Purpose | Required keys |
| --- | --- | --- | --- |
| `.env.local` | repo root | Vite dev server (`npm run dev`) | <pre>VITE_BASE44_APP_ID=your_app_id<br>VITE_BASE44_APP_BASE_URL=https://yourapp.base44.app<br>VITE_BASE44_FUNCTIONS_VERSION=1<br>VITE_BACKEND_URL=http://localhost:4000</pre> |
| `.env` | `backend/.env` | Local backend (`npm run backend:dev` or Docker backend service) | <pre>PORT=4000<br>CORS_ORIGIN=http://localhost:5173<br>LLM_TIMEOUT_MS=45000<br>OLLAMA_BASE_URL=http://ollama:11434<br>OLLAMA_MODEL=llama3.1:8b<br>OLLAMA_EMBED_MODEL=bge-m3<br>RAG_TOP_K=4<br>RAG_USE_HISTORY=true<br>RAG_HISTORY_TURNS=8<br>RAG_RETRIEVAL_MODE=hybrid</pre> |
| `.env.docker` | repo root | `docker compose` build args for the frontend image | <pre>VITE_BASE44_APP_ID=local-app<br>VITE_BASE44_APP_BASE_URL=http://localhost:5173<br>VITE_BASE44_FUNCTIONS_VERSION=1<br>VITE_BACKEND_URL=http://localhost:4000</pre> |

> Tip: templates live in `backend/.env.example` and `.env.docker.example`. Copy them and adjust values as needed.

## Local backend (compatible with this project)

This repo now includes a backend in `backend/` with:

- Role-based access (instructor + student)
- Entity APIs for Course, Assignment, Submission, ChatSession, Flashcard, CourseEnrollment
- RAG chat endpoint using uploaded course material
- Local LLM support via Ollama
- Assignment feedback endpoint with structured output
- Dashboard analytics endpoints for time usage and period filters
- GDPR export/anonymization endpoints

### 1) Install backend dependencies

```bash
npm --prefix backend install
```

### 2) Configure backend environment

```bash
cp backend/.env.example backend/.env
```

Optional: change model in `backend/.env` (default is `llama3.1:8b`).

RAG-related options in `backend/.env`:

```env
RAG_TOP_K=4
RAG_USE_HISTORY=true
RAG_HISTORY_TURNS=8
RAG_RETRIEVAL_MODE=hybrid
OLLAMA_EMBED_MODEL=bge-m3
```

- `RAG_USE_HISTORY=true` means retrieval uses recent conversation turns as search signal.
- Retrieved context is combined from uploaded sources (including parsed PDFs when text can be extracted) and instructor-defined course context.
- `RAG_RETRIEVAL_MODE` supports `lexical`, `embedding`, or `hybrid` (recommended).

### 3) Run backend

```bash
npm run backend:dev
```

### 4) Run frontend

```bash
npm run dev
```

### 5) Verify locally (dev smoke test)

Backend health:

```bash
curl -i http://localhost:4000/health
```

Frontend:

- Open `http://localhost:5173`
- Choose role in login screen: `Instructor` or `Student`

Optional checks:

```bash
npm run lint
npm run build
```

### 6) Local LLM (Ollama)

If you want real local model responses (instead of fallback text):

```bash
ollama serve
ollama pull llama3.2:3b
ollama pull bge-m3
```

Then set model in `backend/.env`:

```env
OLLAMA_MODEL=llama3.2:3b
OLLAMA_EMBED_MODEL=bge-m3
```

Note:

- This app needs a **generative** model for final answers (e.g. `llama3.2:3b` or similar).
- For embedding retrieval, run an embedding model (recommended: `bge-m3`).
- Instructor configuration/policy is still enforced server-side before/after generation.

## Demo users

Use one of these tokens as `access_token` (stored in local storage automatically when login is triggered):

- Instructor: `instructor-token`
- Student: `student-token`

Dev login endpoint: `POST /api/auth/dev-login` with body `{ "role": "admin" }` or `{ "role": "student" }`.

## Full-stack Docker (frontend + backend + Ollama)

1. Copy the provided environment templates:
   - `cp backend/.env.example backend/.env` – adjust `CORS_ORIGIN` or the Ollama model if needed.
   - `cp .env.docker.example .env.docker` – set the real `VITE_BASE44_*` values you normally keep in `.env.local`. Keep `VITE_BACKEND_URL=http://localhost:4000` so the browser can talk to the backend via the published port.
2. Build and start the stack:

```bash
docker compose --env-file .env.docker up --build
```

This brings up three long-running services plus a one-shot helper:

- `frontend` (Vite build served by nginx) on http://localhost:5173
- `backend` (Express API) on http://localhost:4000 with volumes `backend/data` + `backend/uploads`
- `ollama` exposing http://localhost:11434 and persisting models in the named `ollama-data` volume
- `ollama-init` waits for the Ollama API and pulls both `OLLAMA_MODEL` (default `llama3.1:8b`) and `OLLAMA_EMBED_MODEL` (default `bge-m3`) so chat + retrieval models are ready before the backend starts

Useful commands:

```bash
# follow logs for the backend or ollama
docker compose logs -f backend
docker compose logs -f ollama

# manually pull/refresh models if you change backend/.env
docker compose exec ollama ollama pull llama3.1:8b
docker compose exec ollama ollama pull bge-m3

# stop and clean up containers
docker compose down
```

If backend runs in Docker and Ollama runs on your host machine, set this in `backend/.env` before `docker compose up`:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.2:3b
RAG_TOP_K=4
RAG_USE_HISTORY=true
RAG_HISTORY_TURNS=8
RAG_RETRIEVAL_MODE=hybrid
OLLAMA_EMBED_MODEL=bge-m3
```

And make sure Ollama is running on host:

```bash
ollama serve
ollama pull llama3.2:3b
ollama pull bge-m3
```

Verify Docker backend is running:

```bash
curl -i http://localhost:4000/health
```

Notes:

- The root `docker compose.yml` runs frontend, backend, Ollama, and the init helper together; no extra commands are needed for the frontend once the stack is up.
- If you skip the frontend container (e.g., local `npm run dev`), keep `backend/.env` and `OLLAMA_*` values in sync so retrieval works consistently.

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)
