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
4. Create an `.env.local` file and set the right environment variables

```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_backend_url
VITE_BACKEND_URL=http://localhost:4000

e.g.
VITE_BASE44_APP_ID=cbef744a8545c389ef439ea6
VITE_BASE44_APP_BASE_URL=https://my-to-do-list-81bfaad7.base44.app
```

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

## Docker deployment

```bash
cd backend
cp .env.example .env
docker compose up --build
```

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)
