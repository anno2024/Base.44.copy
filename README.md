# EduMate

EduMate is a local-first learning platform with course management, assignments, flashcards, and an Ollama-powered study assistant.

This repository was originally derived from a Base44 export, but the supported workflow in this repo is standard local development with the frontend in the project root and the backend in `backend/`.

## What is included

- React/Vite frontend
- Express backend in `backend/`
- Role-based instructor and student flows
- Entity APIs for courses, assignments, submissions, chat sessions, flashcards, and enrollments
- RAG chat over uploaded course material
- Local LLM and embedding support through Ollama
- Assignment feedback and dashboard analytics endpoints

## Prerequisites

1. Install Node.js
2. Install Ollama so the `ollama` command is available locally
3. Clone the repository and navigate to the project directory
4. Install project dependencies:

```bash
npm install
npm --prefix backend install
```

## Local backend (compatible with this project)

This repo now includes a backend in `backend/` with:

- Role-based access (instructor + student)
- Entity APIs for Course, Assignment, ChatSession, Flashcard, CourseEnrollment
- RAG chat endpoint using uploaded course material
- Local LLM support via Ollama
- PDF-based assignments for upload and download
- Dashboard analytics endpoints for time usage and period filters
- GDPR export/anonymization endpoints

## Environment setup

Create `.env.local` in the project root:

```bash
VITE_BACKEND_URL=http://localhost:4000
```

Optional Base44 compatibility values, only if you still want to work against an exported Base44 app or enable the Base44 Vite plugin:

```bash
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://my-to-do-list-81bfaad7.base44.app
BASE44_ENABLE_VITE_PLUGIN=true
```

For normal local development, `VITE_BACKEND_URL=http://localhost:4000` is enough.

The `VITE_BASE44_*` variable names are still kept for compatibility with the exported frontend client, but they are no longer required just to run the app locally.

Create the backend env file by copying `backend/.env.example` to `backend/.env`.

PowerShell:

```bash
Copy-Item backend/.env.example backend/.env
```

Optional: change the Ollama models in `backend/.env`. Defaults:

```bash
OLLAMA_MODEL=qwen2.5:7b-instruct
OLLAMA_EMBED_MODEL=bge-m3
OLLAMA_AUTO_PULL=true
LLM_TIMEOUT_MS=180000
```

## Running locally

Start the backend:

```bash
npm run backend:dev
```

That command now checks whether Ollama is already available at `http://localhost:11434`, starts `ollama serve` automatically when needed, and pulls any missing configured models automatically by default.

If you only want to start Ollama, use:

```bash
npm run ollama:start
```

Then start the frontend in a second terminal:

```bash
npm run dev
```

Open the frontend at `http://localhost:5173`.

## Demo users

Use one of these tokens as `access_token`:

- Instructor: `instructor-token`
- Student: `student-token`

Dev login endpoint:

```http
POST /api/auth/dev-login
```

Request body:

```json
{ "role": "admin" }
```

or

```json
{ "role": "student" }
```

## Ollama notes

- Ollama is started automatically by `npm run backend:dev` and `npm run backend:start`.
- Missing configured models are pulled automatically by default.
- If you want to disable that behavior, set `OLLAMA_AUTO_PULL=false` in `backend/.env`.
- If you prefer to pull models manually, for example:

```bash
ollama pull qwen2.5:7b-instruct
ollama pull bge-m3
```

## Docker

```bash
cd backend
Copy-Item .env.example .env
docker compose up --build
```
