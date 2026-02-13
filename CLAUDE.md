# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is compeek

compeek is a computer use agent framework that turns Claude into an autonomous desktop agent. The AI agent loop runs in the browser — it calls the Anthropic API directly and sends mouse/keyboard commands to Docker containers via HTTP. Each container provides a virtual X11 desktop with a lightweight tool server. No backend needed.

## Commands

```bash
npm run build              # tsc (container server) + vite build (React app)
npm run dev:client         # Vite dev server on :5173
npm test                   # vitest run (19 tests)
npm run test:watch         # vitest watch mode
npx vitest run tests/agent/tools.test.ts          # single test file
npx vitest run -t "handles screenshot action"     # single test by name
docker compose up --build  # 3 desktop containers on ports 3001-3003 / 6081-6083
```

## Architecture

**Browser-driven, two-layer system:**

1. **Frontend + Agent** (`src/app/`) — React + Vite + TailwindCSS. The agent loop (`src/app/agent/loop.ts`) runs in the browser, calling the Anthropic API directly via `@anthropic-ai/sdk` with `dangerouslyAllowBrowser: true`. Uses `computer_20251124` / `computer_20250124`, `bash_20250124`, and `text_editor_20250728` tools. Extended thinking enabled with 10240 token budget. Tool results are fetched from container via HTTP POST.

2. **Container** (`src/container/server.ts`) — Minimal Express server inside Docker. Three endpoints: `GET /api/health`, `POST /api/tool` (executes xdotool/scrot actions), `POST /api/bash`. No Anthropic API calls, no WebSocket, no state.

**Multi-session** — the frontend manages multiple container connections via tabs. Each session has its own health-check polling and independent agent loop. Session configs persist in localStorage.

**Docker** (`docker/Dockerfile`, `docker-compose.yml`) — Ubuntu 22.04 containers with Xvfb (1024x768), Mutter, x11vnc, noVNC, Firefox. Localtunnel auto-starts for public access. Ports per container: 3000 (tool API), 6080 (noVNC), 5900 (VNC).

## Key patterns

- **Browser-native agent**: The AI loop in `src/app/agent/loop.ts` calls Anthropic API from the browser. Tool execution is remote via `POST /api/tool` and `POST /api/bash` to the container's tool server.
- **Event-driven**: Agent activity produces `AgentEvent` objects (types in `src/agent/types.ts`). Events flow directly from the agent loop to React state via callbacks — no WebSocket layer.
- **Tool execution**: `src/agent/tools.ts` wraps xdotool/scrot via `child_process.execSync`. Each action returns `{ base64?, error? }`. Used by the container server.
- **Prompts**: `src/agent/prompts.ts` — `SYSTEM_PROMPT_BASE`, `FORM_FILL_PROMPT`, `GENERAL_WORKFLOW_PROMPT`. Imported in the browser via Vite `@/` alias.
- **Session management**: `src/app/hooks/useSession.ts` (per-session state + agent loop), `src/app/hooks/useSessionManager.ts` (CRUD + localStorage). API key stored in browser via `useSettings.ts`.
- **Tailwind theme**: Custom `compeek-*` color tokens in `tailwind.config.js` (dark theme).

## Build details

- TypeScript `tsconfig.json` compiles `src/**/*` to `dist/`, but **excludes `src/app/**`** — the React app is handled entirely by Vite.
- Vite root is `src/app/`, builds to `dist/public/`. Hostable on GitHub Pages (relative paths via `base: './'`).
- Path alias `@/*` maps to `./src/*` in both tsconfig and vite config. The browser agent loop uses this to import shared types and prompts.
- Tests use vitest with node environment, located in `tests/`.
- Docker builds only the container server files (not the full app).

## Environment variables

- `ANTHROPIC_API_KEY` — stored in browser localStorage, not needed in Docker
- `LOG_LEVEL` — `debug | info | warn | error` (default: `info`, container only)
- `PORT` — container tool server port (default: `3000`)
- `DISPLAY` — X11 display for tool execution (default: `:1` in Docker)
- `COMPEEK_SESSION_NAME` — display name for the container session
