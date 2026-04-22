# Autoverse — AI-Powered Browser Workflow Automation

> Record what you do once. The system learns the pattern. Runs it for you forever.

---

## The Journey to This Solution

This project went through two dead ends before landing on something that actually works. Being honest about that is part of the submission.

### Attempt 1 — WhatsApp Payment Reminders

The original idea: automate WhatsApp payment reminders for small business owners. Every kirana store, freelancer, and local vendor manually follows up with the same message every week. That friction is real and universal.

The problem hit fast. WhatsApp's official Cloud API requires Meta Business verification — a multi-day approval process not compatible with a timed assignment. The unofficial libraries (`whatsapp-web.js`, `Baileys`) work by reverse-engineering WhatsApp Web, which violates ToS and gets accounts banned mid-demo — the worst possible outcome during a presentation. The complexity of auth management, session persistence, and rate limiting made the reliability bar too high to hit in 3 days.

**Scrapped. The problem was real. The implementation path wasn't.**

### Attempt 2 — Browser Automation with LLM-Generated Playwright Scripts

New direction: watch what the user does in the browser, have an LLM generate a Playwright Python script, run it via subprocess.

Built it. Demoed it. Three failure modes made it unshippable:

**LLM hallucination at the execution layer.** When the LLM writes code, even a single wrong selector, a JavaScript-style `waitForSelector` instead of Python's `wait_for_selector`, or a missing `await` produces a script that crashes at runtime with an opaque traceback. The user sees "failed" with no useful feedback.

**Arbitrary code execution.** The subprocess ran whatever the LLM produced. No sandboxing meant a hallucinated `os.system()` call in the generated script was a real security hole.

**Fragility under retries.** Built a retry loop with error feedback prompts. It helped ~60% of the time. The other 40% produced the same error in different clothing. Debugging LLM-generated code at runtime is genuinely hard.

**Scrapped. The approach had the right idea. The execution layer was wrong.**

### Attempt 3 — The Replay Engine (What You're Looking At)

The insight: **the LLM shouldn't write code. It should label intent.**

Instead of asking the LLM to produce a Python script, ask it to produce a JSON action plan from a fixed vocabulary of step types. A typed interpreter (`ActionExecutor`) — written once, tested once — handles all Playwright interaction. The LLM can only emit `navigate`, `click`, `extract_list`, `click_if` etc. 

This architecture solved everything:
1. **Zero Hallucination Crashes**: The LLM cannot produce a Python syntax error. Unknown step types are safely ignored.
2. **Session Persistence**: The interpreter automatically captures and restores `storage_state` (cookies/local storage), enabling authenticated workflows cross-session.
3. **Structured Intelligence**: The `extract_list` action allows pairing related data (like title and URL) into grouped objects instantly.

---

## Problem Statement

Repetitive browser tasks consume a disproportionate amount of time for people who work on the web: operations teams pulling the same report daily, sales reps copying data between tabs, small business owners checking the same listings every morning.

The existing solutions fail in predictable ways. Robotic Process Automation tools (UiPath, Automation Anywhere) are enterprise-licensed and require dedicated training. Browser recorder extensions (Selenium IDE, Playwright's built-in recorder) generate brittle literal replays that break on the first UI change. No-code tools (Zapier, Make) require manual workflow construction — you still have to know exactly what you want before you can automate it.

The gap: **there is no tool that lets a non-technical user show the computer what they want, and have it just work.**

Autoverse is an attempt at that gap. Record a task once. The system infers the repeatable pattern. Runs it on demand, parameterised, with results you can use.

---

## Who This Is For

The primary user is someone who does the same browser task repeatedly and has enough technical comfort to install a Chrome extension — but not enough to write Playwright scripts themselves. Operations analysts, growth marketers, small business owners, customer support leads.

The secondary user is a developer who wants to scaffold automations quickly without writing boilerplate Playwright setup code for every new task.

---

## What Was Deliberately Left Out

**Scheduling.** The schema has a `last_run_at` column and the architecture supports cron jobs. Left out because reliable headless scheduling requires either a persistent server (deployment complexity beyond scope) or a desktop agent (distribution complexity). Including a broken scheduler would be worse than omitting one.

**Multi-step chained workflows.** The architecture supports it (DAG of action plans). Not built because getting single-workflow reliability right first is the correct order of operations.

**A polished onboarding flow.** The empty state tells you to open the extension. There's no guided walkthrough. In a real product this matters. In a 3-day submission it was correctly deprioritised.

---

## Solution

Autoverse has three layers, each with a single responsibility.

**The Observer** — a Chrome Extension (MV3) that injects a content script into every page. It captures DOM events using stable CSS selectors (IDs, ARIA labels, semantic classes). It uses hover-based discovery to help the AI identify extraction targets without requiring clicks for every single item.

**The Interpreter** — a FastAPI backend that receives the event log and sends it to the LLM with a strictly constrained prompt. The LLM generates a JSON action plan. A validation layer ensures only allowed actions are accepted.

**The Executor** — a typed Playwright interpreter (`ActionExecutor`) that reads the action plan. It features **Session Persistence**, automatically saving browser cookies and local storage after every run to ensure you stay logged in. It also handles **Structured Extraction** (`extract_list`), which pairs related data points into clean JSON objects.

---

## Technical Approach

### Why This Architecture

The core decision was separating the LLM's role (semantic understanding) from the execution layer (Playwright API calls). This separation has three concrete benefits:

**Reliability.** An LLM cannot produce a runtime Python error because it never produces Python. The only failures are Playwright errors — element not found, timeout, navigation failure — which are predictable, catchable, and surfaced as structured step logs.

**Session Continuity.** By managing the `storage_state` at the interpreter level, Autoverse can handle authenticated sites (like LinkedIn or internal portals) without the user having to re-record login flows every time.

**Smart Visualization.** The frontend contains a **Data Normalizer** that automatically detects when extraction results share the same structure (e.g. multiple lists of titles and prices) and renders them as a clean, sortable table.

### Data Model

The database uses **Alembic** migrations to manage the schema. Key tables:
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
| AI | GPT-4o / Groq (Fast inference, structured JSON output) |
| Automation | Playwright Python (Typed Interpreter, not raw scripts) |
| Infrastructure | Docker Compose, Alembic Migrations |

---

## Setup Instructions

### Prerequisites

- Docker and Docker Compose installed
- An OpenAI or Groq API key
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

This starts PostgreSQL, runs database migrations automatically, and starts the backend and frontend. 

| Service | URL |
|---|---|
| Frontend dashboard | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| extension build | `./extension/dist` |

### 3. Install the Chrome extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select the `./extension/dist` folder (ensure you run `npm run build` in the extension folder first)
5. Pin **Autoverse** to your toolbar

### 4. Record your first workflow

1. Open http://localhost:3000
2. Click **New Recording** and describe your goal.
3. Use the extension to perform your task. **Click at least one item** you want to extract to teach the AI the selector.
4. Click **Stop & Generate Automation**.
5. Run the workflow — results appear as a grouped table in the Run Analysis view.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/api/sessions` | Create a recording session |
| `POST` | `/api/workflows/{id}/run` | Execute workflow with session persistence |
| `GET` | `/api/runs/{id}` | Structured execution result + data table |

---

## What I'd Build Next

**Scheduled runs.** Wiring APScheduler to execute workflows on a cron — mornings for report pulls, hourly for price monitoring.

**Selector robustness scoring.** The executor could track which selectors fail across runs and surface "fragile workflow" warnings proactively.

**Visual Debugger.** Showing a screenshot of exactly where the browser was when a step failed, directly in the Run Analysis timeline.
