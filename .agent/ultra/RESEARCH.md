# Deep Research & Evidence Ledger: DaVinci Resolve Workflow Integration

## 1. Primary Sources & Environment Evidence

| CLAIM | SOURCE | CONFIDENCE | VERIFIED STATUS | IMPACT |
| :--- | :--- | :--- | :--- | :--- |
| DaVinci Resolve version is 21.1.1 Studio running on Windows | DaVinci Resolve MCP `get_resolve_status` | 100% | VERIFIED | Full Studio API (Python/JS, AI, Gallery) available |
| Embedded Electron executable exists in Resolve | `C:\Program Files\Blackmagic Design\DaVinci Resolve\Electron\electron.exe` (v36.3.2) | 100% | VERIFIED | Plugin runs on modern Chromium/Node runtime |
| WorkflowIntegration.node binary exists and is compatible | BMD Developer SDK (`Examples/SamplePlugin/WorkflowIntegration.node`) | 100% | VERIFIED | Directly usable by our Electron main.js |
| Timeline clip & marker extraction works live | Live test on `DS_Bodycam_Case002_STUDIO_MASTER` | 100% | VERIFIED | 71 clips on V1/V2 inspected with start, end, duration |
| Instant frame snapshot works without rendering video | Live test: `GrabStill()` + `ExportStills(..., "png")` + `DeleteStills()` | 100% | VERIFIED | Saved 6.2MB lossless PNG in <100ms; cleaned up gallery |
| Playhead navigation works | `timeline.SetCurrentTimecode(tc)` | 100% | VERIFIED | Enables clicking timecodes in UI to jump playhead |
| User directive on rendering | User request: "du ska itne exporta den bara rediegra" & "ta bort redner taben från meny nu" | 100% | VERIFIED | Render tab and all export functions strictly removed |

## 2. API Reference & Architectural Design

### A. DaVinci Resolve Scripting API (Workflow Integration)
- Electron Main process loads `WorkflowIntegration.node`:
  ```javascript
  const WorkflowIntegration = require('./WorkflowIntegration.node');
  await WorkflowIntegration.Initialize('com.bodycam.resolve.aicopilot');
  const resolve = await WorkflowIntegration.GetResolve();
  ```
- In IPC handlers or Python backend, we can query:
  - `project.GetCurrentTimeline()`
  - `timeline.GetTrackCount('video')` & `timeline.GetTrackCount('audio')`
  - `timeline.GetItemListInTrack(type, index)`: `GetName()`, `GetStart()`, `GetEnd()`, `GetDuration()`, `GetMarkers()`
  - `timeline.GetMarkers()`: returns dict of frame -> `{ color, name, note, duration, customData }`
  - `timeline.SetCurrentTimecode(tc)`: moves playhead to specific timecode.
  - `timeline.AddMarker(frame, color, name, note, duration)`: adds marker.

### B. Frame Snapshot Engine (No Export / No Render)
Instead of delivering a slow render job that locks the machine:
1. Call `gallery = project.GetGallery()`
2. Call `album = gallery.GetCurrentStillAlbum()`
3. Call `still = timeline.GrabStill()`
4. Call `album.ExportStills([still], targetDir, prefix, "png")`
5. Call `album.DeleteStills([still])`
This produces a pristine uncompressed PNG image of the exact frame at the playhead in a fraction of a second, without touching the Deliver page or rendering video.

### C. Local Python Background Server (`server.py`)
- Python 3.11.9 is available on `PATH`.
- Uses lightweight standard library `http.server` with custom JSON REST handlers.
- Endpoints:
  - `GET /api/status`: Resolve & server health check.
  - `POST /api/chat`: AI Copilot assistance for bodycam editing (pacing, blur redactions, dialogue sync, tension curves).
  - `POST /api/timeline/analyze`: Ingests and stores timeline clip/marker data, computes analytics.
  - `POST /api/snapshot`: Registers captured frame, analyzes scene details.
  - `POST /api/actions/jump`: Instructs Resolve to move playhead.
  - `POST /api/actions/marker`: Adds marker to timeline.
  - `GET /api/snapshots`: Returns list of captured frames with metadata.
