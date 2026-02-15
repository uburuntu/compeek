# Demo Setup Checklist

## Required

- [ ] Docker installed and running
- [ ] Anthropic API key with Opus 4.6 access
- [ ] Sample passport/document image for demo

## Local Linux Container

```bash
npx @rmbk/compeek start --open --name linux-demo
```

- [ ] Container starts and health check passes
- [ ] Dashboard opens with green connection dot
- [ ] API key set in Settings
- [ ] Example apps accessible at http://localhost:8080/

## Windows VM (Remote Linux Server)

```bash
# On the remote Linux server (requires /dev/kvm):
npx @rmbk/compeek start --os windows --tunnel --name windows-demo
```

- [ ] Remote server has KVM support (`ls /dev/kvm`)
- [ ] Windows VM boots successfully (~3 minutes)
- [ ] Copy tunnel connection string
- [ ] Add to dashboard via "+" → paste connection string
- [ ] Green dot on Windows tab

## Claude Code MCP

```bash
# Start a second Linux container for MCP:
npx @rmbk/compeek start --name mcp-demo

# In Claude Code settings, add MCP server:
npx @rmbk/compeek mcp --container-url http://localhost:3002
```

- [ ] MCP container running
- [ ] Claude Code recognizes MCP tools (screenshot, computer, bash)

## Recording

- [ ] Screen resolution: 1920x1080
- [ ] Browser zoom: 110%
- [ ] All 3 session tabs connected (green dots)
- [ ] Model set to Opus 4.6
- [ ] Sample document image accessible on desktop
- [ ] Screen recorder configured (OBS / QuickTime / Loom)
- [ ] Microphone for voiceover (or record separately)

## Pre-Recording Test Run

- [ ] Start agent on Linux tab → verify form fill works
- [ ] Start agent on Windows tab → verify notepad opens
- [ ] Call MCP screenshot from Claude Code → verify image returns
- [ ] Switch between all 3 tabs — verify no lag
- [ ] Thinking tab shows extended reasoning
- [ ] Timer, step counter, model badge visible on running indicator
