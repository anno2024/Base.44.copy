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
| `.env` | `backend/.env` | Local backend (`npm run backend:dev` or Docker backend service) | <pre>PORT=4000<br>CORS_ORIGIN=http://localhost:5173<br>LLM_TIMEOUT_MS=45000<br>OLLAMA_BASE_URL=http://ollama:11434<br>OLLAMA_MODEL=llama3.1:8b</pre> |
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

### 3) Run backend

```bash
npm run backend:dev
```

### 4) Run frontend

```bash
npm run dev
```

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
- `ollama-init` waits for the Ollama API and runs `ollama pull llama3.1:8b` so the backend can use the model immediately

Useful commands:

```bash
# follow logs for the backend or ollama
docker compose logs -f backend
docker compose logs -f ollama

# manually pull/refresh a model if you change backend/.env
docker compose exec ollama ollama pull llama3.1:8b

# stop and clean up containers
docker compose down
```

The previous backend-only compose file under `backend/` still works if you only need the API.

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)
