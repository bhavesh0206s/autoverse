# Autoverse — AI-Powered Browser Workflow Automation

> Record what you do once. The system learns the pattern. Runs it for you forever.

---

## The Journey to This Solution

This project went through two dead ends before landing on something that actually works.

### Attempt 1 — WhatsApp Payment Reminders

The original idea: automate WhatsApp payment reminders for small business owners. Every kirana store, freelancer, and local vendor manually follows up with the same message every week. That friction is real and universal.

The problem hit fast. WhatsApp's official Cloud API requires Meta Business verification - a multi-day approval process not compatible with a timed assignment. The unofficial libraries (`whatsapp-web.js`, `Baileys`) work by reverse-engineering WhatsApp Web, which violates ToS and gets accounts banned. Using Playwright to automate WhatsApp was quite challenging, as it involved handling dynamic elements, authentication flows, and maintaining stable scripts despite frequent interface changes.

**Scrapped. The problem was real. The implementation path wasn't.**

### Attempt 2 — Browser Automation with LLM-Generated Playwright Scripts

New direction: watch what the user does in the browser, have an LLM generate a Playwright Python script.

Built it but one failure modes made it unshippable:

**LLM hallucination at the execution layer.** When an LLM generates code, even a single incorrect selector can cause the script to fail at runtime, often producing an unclear traceback. As a result, the user simply sees a “failed” message with little to no meaningful feedback about what went wrong. Built a retry loop with error feedback prompts. It helped ~60% of the time. The other 40% produced the same error in different ways. Debugging LLM-generated code at runtime become genuinely hard.

**Scrapped. The approach had the right idea. The execution layer was wrong.**

### Attempt 3 — The Replay Engine (What You're Looking At)

The insight: **the LLM shouldn't write code. It should label intent.**

Instead of asking the LLM to produce a Python script, ask it to produce a JSON action plan from a fixed step types. A typed interpreter (`ActionExecutor`) — handles all Playwright interaction. The LLM can only emit `navigate`, `click`, `extract_list`, `click_if` etc. 

This architecture solved everything:
1. **Zero Hallucination Crashes**: The LLM cannot produce a Python syntax error. Unknown step types are safely ignored.
2. **Session Persistence**: The interpreter automatically captures and restores `storage_state` (cookies/local storage), enabling authenticated workflows cross-session.

---

## Problem Statement

A lot of people who work on the web end up spending way too much time on repetitive browser tasks, things like pulling the same report every day, copying data between tabs, or checking listings every morning. It’s tedious, but hard to avoid.

The tools that exist today don’t really solve the problem in a practical way. Traditional RPA platforms are powerful, but they’re expensive and come with a steep learning curve. Browser recorders can capture actions, but they tend to be fragile—one small change in the UI and everything breaks.

In the end, people are left stuck between tools that are complex to handle real-world workflows.

The gap: **there is no tool that lets a non-technical user show the computer what they want, and have it just work.**

Autoverse is an attempt at that gap. Record a task once. The system extracts the repeatable pattern. Runs it on demand, parameterised, with results you can use.

---

## Who This Is For

The primary user is someone who does the same browser task repeatedly and has enough technical comfort to install a Chrome extension — but not enough to write Playwright scripts themselves. Operations analysts, growth marketers, small business owners, customer support leads.

---

## What Was Deliberately Left Out

**Scheduling.** The schema has a `last_run_at` column and the architecture supports cron jobs. Left out because reliable headless scheduling requires either a persistent server (deployment complexity beyond scope) or a desktop agent (distribution complexity). Including a broken scheduler would be worse than omitting one.

**A polished onboarding flow.** The empty state tells you to open the extension. There's no guided walkthrough. In a real product this matters. In a 5-day submission it was correctly deprioritised.

---

## Solution

Autoverse has three layers, each with a single responsibility.

**The Observer (Extension)**: Captures events using stable selectors.

**The Intelligence (Backend)**: FastAPI + LLM that creates the JSON action plan.

**The Executor (Playwright Service)**: Our typed engine that handles Session Persistence and Structured Extraction.

**The Dashboard (Frontend)**: The React-powered command center with the Smart Data Normalizer for tabular results.

---

### Demo:

**Link**: 

## Technical Approach

### Data Model

Key tables:
- `workflows`: Stores the parameters, JSON action plan, and the `storage_state`.
- `run_logs`: Stores the execution history, durations, and resulting data.
- `sessions`: Stores the raw raw multi-batch events from the recorder.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State management | TanStack Query v5 |
| Backend | FastAPI, SQLAlchemy 2 (async), Pydantic v2 |
| Database | PostgreSQL 16 (JSONB) |
| AI | Groq (Fast inference, structured JSON output) |
| Automation | Playwright Python |
| Infrastructure | Docker, Docker Compose |

---

## Setup Instructions

### Prerequisites

- Docker and Docker Compose installed
- An Groq API key
- Google Chrome

### 1. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set your API key:

```
OPENAI_API_KEY=sk-...  # or GROQ_API_KEY
```

### 2. Start the stack

```bash
docker-compose up --build
```

This starts PostgreSQL, the backend and frontend. 

| Service | URL |
|---|---|
| Frontend dashboard | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| extension build | `./extension/dist` |

### 3. Install the Chrome extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select the `./extension/dist` folder (ensure you run  `npm i && npm run build` in the extension folder first)
5. Pin **Autoverse** to your toolbar

### 4. Record your first workflow

1. Open http://localhost:3000
2. Click **New Recording** and describe your goal.
3. Use the extension to perform your task. **Click at least two item** you want to extract to teach the AI the selector.
4. Click **Stop & Generate Automation**.
5. Run the workflow: results appear in the Workflow view.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/api/sessions` | Create a recording session |
| `POST` | `/api/workflows/{id}/run` | Execute workflow with session persistence |
| `GET` | `/api/runs/{id}` | Structured execution result + data table |


