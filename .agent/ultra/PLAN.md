# Implementation Plan: DS Bodycam AI Copilot

## Phase P0: Core Correctness & Architecture Setup
- [x] Verify DaVinci Resolve environment, Studio scripting API, and embedded Electron version.
- [x] Confirm strict user requirement: **NO RENDER TAB, NO EXPORT FUNCTIONS**.
- [ ] Create project folder structure and copy `WorkflowIntegration.node`.
- [ ] Author `manifest.xml` with plugin ID `com.bodycam.resolve.aicopilot` and title "DS Bodycam AI Copilot".
- [ ] Author `package.json` with main entrypoint `main.js`.
- [ ] Author `preload.js` with secure contextBridge exposing `resolveAPI`.

## Phase P1: Core Functional Requirements
- [ ] Implement `main.js`:
  - Connect to DaVinci Resolve via `WorkflowIntegration.node`.
  - Implement IPC handler `resolve:getTimelineData` (extracts tracks, clips, in/out, markers).
  - Implement IPC handler `resolve:captureSnapshot` (calls `GrabStill()`, exports PNG to disk, cleans up still from album).
  - Implement IPC handler `resolve:setTimecode` (jumps playhead).
  - Implement IPC handler `resolve:addMarker` (creates marker at current or specified frame).
- [ ] Implement `server.py` (Local Python Background Server):
  - Standard library HTTP server with CORS support on `127.0.0.1:8765`.
  - Endpoints: `/api/status`, `/api/chat`, `/api/timeline/analyze`, `/api/snapshot`, `/api/actions/jump`, `/api/actions/marker`.
  - Bodycam-specialized AI copilot responses (pacing analysis, blur/censor identification, timeline summarization).
  - File watcher / serving for snapshots.
- [ ] Implement `index.html`:
  - Header: Plugin Title, DaVinci Resolve status pill, Python Server status pill.
  - Tabs:
    1. **AI Chat**: Conversational prompt input, response history, quick action chips.
    2. **Tidslinje**: "Analysera Tidslinje" button, clip count, duration, searchable clip list, markers list, jump-to-timecode buttons.
    3. **Snapshots**: "Ta Snapshot" button, live gallery of captured stills, "Skicka till AI"-funktion.
    4. **Snabbåtgärder**: Quick markers for redaction/face blur, jump to start/end.
  - (STRICTLY NO RENDER OR EXPORT TAB).
- [ ] Implement `renderer.js`:
  - Wires UI buttons to `window.resolveAPI` and `fetch('http://127.0.0.1:8765/...')`.
  - Manages chat history, markdown rendering, snapshot gallery updates.
- [ ] Implement `css/styles.css`:
  - Native DaVinci Resolve Studio dark theme (`#18181b`, `#27272a`, `#3f3f46`, accents `#f97316` and `#3b82f6`).

## Phase P2: Integration & Deployment
- [ ] Create `start_server.bat` and `start_server.ps1` for starting background server.
- [ ] Deploy plugin package to:
  - `C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Workflow Integration Plugins\com.bodycam.resolve.aicopilot`
  - `C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Workflow Integration Plugins\com.bodycam.resolve.aicopilot`
- [ ] Verify both directory structures.

## Phase P3: Verification, Adversarial Debate & Hermes Review
- [ ] Test Python server endpoints (`/api/status`, `/api/timeline/analyze`, `/api/chat`, `/api/snapshot`).
- [ ] Test Electron launch or simulation using Resolve's bundled `electron.exe`.
- [ ] Verify snapshot generation and cleanup in live DaVinci Resolve.
- [ ] Run blind adversarial critique on potential edge cases (CORS, port conflicts, empty timeline, offline server).
- [ ] Run Hermes independent code review `review_diff`.
- [ ] Present comprehensive summary in Swedish to the user.
