# compeek Demo Storyboard (3:00)

## Pre-Recording Setup

1. Start Linux container: `npx @rmbk/compeek start --open --name linux-demo`
2. Start Windows container on remote Linux server: `npx @rmbk/compeek start --os windows --tunnel --name windows-demo`
3. Start MCP Linux container: `npx @rmbk/compeek start --name mcp-demo`
4. Open dashboard, connect all 3 sessions
5. Set API key, select Opus 4.6
6. Have sample passport image saved locally
7. Boot Windows VM well before recording (~3 min startup)
8. Configure Claude Code MCP: `npx @rmbk/compeek mcp --container-url <url>`
9. Verify all 3 tabs show green connection dots

## Timeline

### [0:00-0:10] Hook
- "What if AI could use any desktop — just like you do? No APIs. No plugins. Just screen and keyboard."
- Dashboard visible with 3 connected session tabs

### [0:10-0:35] Linux: Start form-fill task
- Attach passport image (click Attach button, select file, thumbnail appears)
- Type goal: "Go to http://localhost:8080/client-onboarding/ and fill the form using the attached passport photo"
- Select Opus 4.6, click Start Agent
- Show first screenshot + thinking tab notification dot pulsing

### [0:35-0:55] Windows: Start notepad task
- Click Windows tab (WIN badge visible)
- Type goal: "Open Notepad and type 'Hello from compeek! AI is controlling Windows.'"
- Start Agent — running indicator shows "Opus 4.6 · Step 1 · 0:03"

### [0:55-1:15] Claude Code MCP
- Cut to terminal showing Claude Code
- Show MCP tools being called
- "Take a screenshot of the desktop, then open mousepad and write a short poem about AI"

### [1:15-1:40] Spiral → Linux
- Agent is mid-workflow, filling form fields
- Activity feed scrolling with clicks and typing
- Switch to Thinking tab — Opus 4.6 reasoning visible in real-time
- Overlay showing blue circles on click targets

### [1:40-2:00] Spiral → Windows
- Agent has opened Notepad and is typing
- Timer shows "Opus 4.6 · Step 8 · 0:52"

### [2:00-2:25] Linux: Completion
- Form filled successfully
- Completion card: "23 actions in 1:34"
- Success state visible on the form

### [2:25-2:45] MCP result
- Claude Code terminal showing the poem written in mousepad
- Screenshot from MCP visible

### [2:45-3:00] Closing
- All 3 tabs visible in dashboard
- "compeek — AI eyes and hands for any desktop. One command: npx @rmbk/compeek start"
- GitHub URL
