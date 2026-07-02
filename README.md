# Questionnaire System (AI Coding Assessment)

> **This is my completed solution.** The original assessment brief is preserved below
> unchanged. See `docs/ARCHITECTURE.md` for the schema/rule-engine design,
> `docs/ADR.md` for the key decisions, and `task.md` / `CLAUDE.md` for the AI
> collaboration process artifacts.

## Running locally

Three processes, three terminals, from the repo root:

```bash
# 1. Storage backend (dumb CRUD JSON store, port 4000)
cd backend
npm install
npm start

# 2. Runtime app — the one end users fill out (port 5174)
cd frontend/web
npm install
npm run dev

# 3. Admin app — author questionnaires (port 5173)
cd frontend/admin
npm install
npm run dev
```

Then open:
- **Admin:** http://localhost:5173 — lists/creates/edits questionnaires, saved to the backend.
- **Runtime:** http://localhost:5174 — loads `onboarding-health-check` (a seeded sample
  questionnaire) by default. Load any other questionnaire with `?id=<questionnaire-id>`,
  or click "Preview in runtime app" from the Admin editor.

Both frontend apps default their API URL to `http://localhost:4000`; override via
`VITE_API_URL` in a `.env` file (see `.env.example` in each app) if you run the backend
elsewhere.

### Sample questionnaire

`backend/data/questionnaires.json` seeds one questionnaire, **Onboarding Health Check**,
that exercises all three required dynamic-flow behaviors in one flow:
- **Branching** — a different follow-up question appears depending on employment status
  (employed → asks employer name; self-employed → asks business type; unemployed → asks
  about job search).
- **Skipping** — those branch-specific questions disappear entirely if their branch isn't
  active.
- **Scoring + multi-condition branching** — two questions compute a `riskScore` from
  selected symptom/travel answers; a final question is gated on
  `riskScore >= 5 OR (traveled recently AND reported fever)` — a nested `AND`/`OR` rule.

## Overview

Build a **schema-driven questionnaire system**. This is a frontend-heavy assessment.

The system has two front-end applications:

1. **Admin Interface** – create and configure questionnaires (questions, options, logic)
2. **User Interface (Runtime)** – parses the questionnaire schema and renders it for end users, including dynamic behavior

> **What is NOT required:** You do NOT need to implement answer submission or persistence. The focus is purely on **defining and parsing the questionnaire schema**, and **correctly rendering and controlling the question flow at runtime**.

---

## Repository Structure & Getting Started

1. Clone the assessment repository:
   ```
   git clone git@github.com:neutronsg/engineering-assessment-fe.git
   cd engineering-assessment-fe
   ```

2. The repository contains the following directories:
   ```
   backend/             # Your backend implementation (if needed)
   backend_example/     # Example backend for reference
   frontend/
      admin/            # Admin interface application
      web/              # User-facing runtime application
   README.md
   README.zh-CN.md
   ```

3. Implement your solution within the existing structure:
   - Place the **Admin Interface** code under `frontend/admin`
   - Place the **User Interface (Runtime)** code under `frontend/web`
   - You may use the `backend/` directory for your data storage layer if desired, or you can use other approaches (see Backend section)

4. Push your completed work to a **public repository** and provide the repository URL for review.

---

## Core Requirements

You must implement at least the following:

- **Questionnaire authoring** – support creating and configuring at least these question types:
  - Single choice (radio)
  - Multiple choice (checkbox)
  - Free text
- **Dynamic questionnaire flow** – the sequence and visibility of questions adapt based on user answers. For example: branching to different follow‑up questions, skipping irrelevant sections, or combining multiple answers to determine which questions appear next (e.g., scoring, multi-condition branching). You design the rule engine and data model that drives this behavior.
- **Runtime parsing & rendering** – the user-facing application reads a questionnaire definition (schema) and produces a working interactive form that respects the defined logic.

Depth is valued over breadth. Focus on making the core path robust and well-architected rather than adding many features.

---

## Design Ownership

The following are intentionally not specified – you must design them yourself:

- Data model / schema for questionnaire definitions
- The rule engine for dynamic flow (how rules are defined, stored, and evaluated)
- UI component tree and layout
- State management approach

We are interested in **how you approach an ambiguous problem**, define the boundaries, and produce a clean architecture that an AI can then help you implement effectively.

---

## AI Usage

This is an **AI‑assisted assessment**. You are expected to work with AI tools (such as ChatGPT, Claude Code, Copilot, Cursor, Codex, etc.) throughout the process.

The complexity and openness of this task make AI collaboration essential to complete it within a reasonable timeframe. You should focus on:

- Defining the right problem and constraints
- Designing the architecture and component decomposition
- Guiding the AI with precise instructions and context
- Reviewing, refining, and integrating AI‑generated code

We will evaluate your **ability to collaborate with AI**, not just your raw coding speed.

---

## Backend & Data Persistence

There are no restrictions on how you handle data storage. Use any approach that lets you store and retrieve questionnaire definitions (REST API, local JSON, mock services, etc.). The `backend/` directory is available if you choose to build a simple storage service, and `backend_example/` is provided for reference. The backend serves **solely as a data storage/retrieval service** and must contain no business logic (e.g., validation, scoring, branching rules). All logic must reside in the frontend. Backend implementation is not assessed; only the data contract matters as part of your frontend architecture.

---

## Evaluation Focus

We will assess:

- How well you **decompose the problem** and structure the solution
- The **architecture and data model** you design
- How you leverage AI to explore trade‑offs and generate robust code
- The quality of your **collaboration with AI** (clear direction, iterative refinement, error handling)
- The correctness and reactivity of the **dynamic questionnaire flow**

---

## Deliverables

1. **Source code** pushed to your public repository, following the repository structure described above
2. **Clear instructions** on how to run your applications locally (add to the existing README or create a new one)
3. **Intermediate artifacts** that shaped the project — whether authored by you or generated by AI (e.g., `CLAUDE.md`, repo skills, `task.md`, PRD documents, architecture decision records, diagrams, or other structured context files). These are the primary window into how you defined the problem, directed the work, and collaborated with AI.
4. A short **architecture decision record** explaining your 2–3 most important choices (optional but highly recommended)
5. **Public repository URL** – submit the link to your completed solution

---

## Important

There is no single correct solution. We evaluate how you **design, direct, and quality‑control** in an AI‑augmented workflow.

