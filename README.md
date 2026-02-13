# compeek — AI Eyes & Hands for Any Desktop Application

> A general-purpose computer use agent framework powered by Claude Opus 4.6. Define goals in natural language, point at any software, watch the agent work with full observability.

**No APIs. No plugins. No integrations. Just screen and keyboard.**

## What is compeek?

**compeek** (компик + peek) is a framework that turns Claude Opus 4.6 into an autonomous desktop agent. It can see any application through screenshots, interact via mouse and keyboard, read physical documents through vision, and validate its own work — all without requiring any integration with the target software.

### Key Capabilities

- **See**: Screenshot any application + zoom into details (Opus 4.6 exclusive)
- **Think**: Extended thinking for transparent reasoning about complex workflows
- **Act**: Mouse clicks, keyboard input, scrolling — full desktop control
- **Read**: Extract structured data from photos of documents (passports, IDs, invoices)
- **Validate**: Self-check work by comparing filled forms against expected data
- **Observe**: Real-time dashboard with agent vision overlay showing what the AI sees and thinks

### Use Cases

| Use Case | Description |
|----------|-------------|
| **Document → Form** | Upload a document photo, compeek fills any form application |
| **Desktop Automation** | Natural language instructions to operate any software |
| **Visual QA** | Test applications by describing expected behavior |
| **Cross-App Workflows** | Chain actions across multiple disconnected applications |
| **Legacy Software** | Automate systems with no API through GUI interaction |

## Architecture

```
┌──────────────────────────────────────────┐
│  Docker Container                         │
│  ┌─────────────────────────────────┐     │
│  │  Virtual Desktop (Xvfb + Mutter) │     │
│  │  ┌───────────┐ ┌──────────────┐ │     │
│  │  │  Firefox   │ │  Target App  │ │     │
│  │  └───────────┘ └──────────────┘ │     │
│  └──────────┬──────────────────────┘     │
│             │ xdotool, scrot              │
│  ┌──────────┴──────────────────────┐     │
│  │  compeek Server (Node.js)        │     │
│  │  ├── Agent Loop ↔ Anthropic API  │     │
│  │  ├── WebSocket (real-time events)│     │
│  │  └── REST API (workflow control) │     │
│  └──────────┬──────────────────────┘     │
│             │ :3000 :6080 :5900           │
└─────────────┼────────────────────────────┘
              │
         Browser: compeek Dashboard (React)
```

## Quick Start

### Prerequisites

- Docker
- An Anthropic API key with Opus 4.6 access

### Run

```bash
# Set your API key
export ANTHROPIC_API_KEY=your_key_here

# Build and run
docker compose up --build

# Open in browser
# Dashboard: http://localhost:3000
# Desktop VNC: http://localhost:6080
```

### Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run server (requires Docker desktop environment)
npm run dev
```

## Tech Stack

- **TypeScript** — Full-stack, single codebase
- **Claude Opus 4.6** — Computer use (`computer_20251124`), vision, extended thinking, zoom
- **React + Vite + TailwindCSS** — Dashboard with real-time agent overlay
- **Express + WebSocket** — Backend API with live event streaming
- **Docker** — Sandboxed desktop environment (Xvfb, Mutter, noVNC, Firefox)

## Opus 4.6 Features Used

| Feature | Usage |
|---------|-------|
| Computer Use (`computer_20251124`) | Core desktop interaction: screenshot, mouse, keyboard |
| **Zoom** (NEW) | Inspect screen regions at full resolution for reading small text |
| Extended Thinking | Transparent reasoning shown in real-time UI |
| Vision | Extract data from document photos |
| Agent Loop | Autonomous multi-step task execution |

## Project Structure

```
compeek/
├── src/
│   ├── agent/          # Agent loop, tool implementations, prompts
│   ├── workflow/       # Workflow engine, validation
│   ├── server/         # Express + WebSocket server
│   └── app/            # React dashboard
├── target-app/         # Demo form application
├── docker/             # Dockerfile
└── docker-compose.yml
```

## Built for

**"Built with Opus 4.6: a Claude Code Hackathon"** by Anthropic (Feb 2026)

Problem Statement 1: **Build a Tool That Should Exist** — compeek makes any existing software AI-capable without touching its code.

## License

MIT
