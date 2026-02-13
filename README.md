# compeek — AI Eyes & Hands for Any Desktop

> A computer use agent framework powered by Claude. Define goals in natural language, point at any software, watch the agent work.

**No APIs. No plugins. No integrations. Just screen and keyboard.**

[Dashboard](https://compeek.rmbk.me) | [Docker Image](https://ghcr.io/uburuntu/compeek) | [npm](https://www.npmjs.com/package/compeek)

## Quick Start

```bash
# One-line install (Linux/macOS/WSL2)
curl -fsSL https://compeek.rmbk.me/install.sh | bash

# Or via npx
npx compeek start --open

# Or docker directly
docker run -d -p 3001:3000 -p 6081:6080 --shm-size=512m ghcr.io/uburuntu/compeek
```

The container prints a **connection string** and a **clickable dashboard link** — no manual port entry needed. Check `docker logs compeek-1`.

Open the [dashboard](https://compeek.rmbk.me), paste your Anthropic API key in Settings, and start a workflow.

## What is compeek?

**compeek** (компик + peek) turns Claude into an autonomous desktop agent. It sees any application through screenshots, interacts via mouse and keyboard, and validates its own work — all without requiring any integration with the target software.

- **See** — screenshot any application + zoom into details
- **Think** — extended thinking for transparent reasoning
- **Act** — mouse clicks, keyboard input, scrolling
- **Read** — extract data from document photos (passports, IDs, invoices)
- **Validate** — self-check by comparing filled forms against expected data
- **Observe** — real-time dashboard showing what the AI sees and thinks

## Architecture

```
Browser (React dashboard)          Docker Container
┌──────────────────────┐          ┌──────────────────────┐
│  Agent Loop          │          │  Xvfb + Mutter       │
│  ├─ Anthropic API    │  HTTP    │  ├─ Firefox          │
│  └─ Tool dispatch ───┼─────────┼─▸ Tool Server :3000  │
│                      │          │  │  └─ xdotool/scrot │
│  Session Manager     │          │  ├─ noVNC :6080      │
│  Settings (API key)  │          │  └─ VNC :5900        │
└──────────────────────┘          └──────────────────────┘
```

The agent loop runs **in the browser** — it calls the Anthropic API directly and sends mouse/keyboard commands to Docker containers via HTTP. Each container is a stateless virtual desktop with a lightweight tool server. No backend needed.

## Desktop Modes

Set `DESKTOP_MODE` when starting a container:

| Mode | What starts | Use case |
|------|-------------|----------|
| `full` (default) | Xvfb + Mutter + Tint2 + Firefox + target app | QA testing with pre-loaded app |
| `browser` | Xvfb + Mutter + Firefox | General web browsing agent |
| `minimal` | Xvfb + Mutter only | Agent launches everything itself |
| `headless` | Xvfb + tool server only | API-only, bash commands only |

```bash
npx compeek start --mode browser
# or
docker run -d -e DESKTOP_MODE=browser -p 3001:3000 -p 6081:6080 --shm-size=512m ghcr.io/uburuntu/compeek
```

## Connection Strings

Containers print a base64-encoded config and a dashboard link on startup:

```
Connection string: eyJuYW1lIj...
Dashboard link:    https://compeek.rmbk.me/#config=eyJuYW1lIj...
```

Three ways to connect:
1. **Click the link** — auto-adds the session
2. **Paste the string** in the Add Session dialog
3. **Manual entry** — type host and ports

## CLI

```bash
npx compeek start          # Pull image, start container, print connection info
npx compeek start --open   # Same + open dashboard in browser
npx compeek stop           # Stop all compeek containers
npx compeek stop 1         # Stop compeek-1
npx compeek status         # List running containers
npx compeek logs           # Follow container logs
npx compeek open           # Open dashboard with auto-connect URL
```

Flags for `start`: `--name`, `--api-port`, `--vnc-port`, `--mode`, `--no-pull`, `--open`.

## Development

```bash
npm install
npm run dev:client         # Vite dev server on :5173
npm run build              # tsc + vite build
npm test                   # 19 tests
docker compose up --build  # 3 containers on ports 3001-3003 / 6081-6083
```

## Project Structure

```
compeek/
├── src/
│   ├── agent/             # Shared tools, types, prompts
│   ├── app/               # React dashboard (Vite)
│   ├── container/         # Express tool server (Docker)
│   └── lib/               # Logger
├── bin/compeek.mjs        # CLI (npx compeek)
├── install.sh             # One-line installer
├── docker/                # Dockerfile + entrypoint
├── target-app/            # Demo form application
└── docker-compose.yml
```

## Built for

**"Built with Opus 4.6: a Claude Code Hackathon"** by Anthropic (Feb 2026)

## License

MIT
