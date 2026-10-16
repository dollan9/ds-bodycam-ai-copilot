# DS Bodycam AI Copilot - DaVinci Resolve Studio Workflow Integration

Autonomous AI Copilot Workflow Integration Plugin for **DaVinci Resolve Studio**, engineered specifically for documentary-grade police bodycam and true crime video editing workflows (matching standards set by EWU Bodycam, The Hidden Files, and Law&Crime).

Loaded as an embedded Electron panel directly via DaVinci Resolve Studio's native menu (`Workspace -> Workflow Integrations -> DS Bodycam AI Copilot`), communicating asynchronously with a local Python background engine (`127.0.0.1:8765`) and the DaVinci Resolve Scripting API (`DaVinciResolveScript` / `fusionscript`).

---

## Key Capabilities

### 1. Multi-Provider AI Architecture
- **Google Gemini API**: Native multimodal processing (`gemini-2.5-pro`, `gemini-2.5-flash`) for deep timeline reasoning and frame analysis.
- **OpenAI API**: Full support for `gpt-4o` and reasoning models (`o3-mini`).
- **Anthropic Claude**: Full support for `claude-3-7-sonnet`.
- **Local / Self-Hosted Endpoints**: Connects to Ollama, LM Studio, or vLLM via OpenAI-compatible endpoints (`/v1`).
- Secure key management stored locally in `config.json` with in-panel connection verification testing.

### 2. Full Timeline Multimodal Video Audit Pipeline
- **Critical Error Detection**: Identifies black flash gaps (<5 frames), offline/missing media, clip desyncs, and involuntary jump cuts.
- **Privacy & PII Compliance**: Flags civilian faces, juvenile minors, license plates, mobile data terminals (MDTs/in-car laptops), and identity cards with exact `HH:MM:SS:FF` timecodes.
- **Pacing & Storytelling**: Pinpoints unbroken dead-air (>20s), recommendable trim segments, and dramatic hook opportunities.
- **Audio & Fairlight Intelligence**: Detects background siren/radio bleed, clipping audio, and dialog intelligibility issues requiring subtitle overlays.
- **One-Click Remediation**: Clickable timecode pills immediately position the Resolve playhead; one-click action to place color-coded markers directly onto the active timeline (Red = Critical, Yellow = Censor/Blur, Blue = Pacing, Green = Hook).

### 3. Agentic DaVinci Resolve Controller (`ResolveController`)
- **Safety First**: Automatic duplicate backup timelines before executing AI-driven timeline edits.
- **Timeline & Playhead Control**: Read/write timecodes, query track counts, and navigate playhead position (`SetCurrentTimecode`).
- **Clip & Track Manipulation**: Enable/disable clips, adjust transform properties (Pan, Tilt, Zoom, Opacity), and set clip colors.
- **Color & Audio Enhancements**: Apply CDL primary color corrections and configure Fairlight voice isolation directly via scripting commands.
- **Lossless Frame Capture**: Captures uncompressed still frames in <100ms using the internal Gallery Still API (`GrabStill` + `ExportStills` + `DeleteStills`) without rendering or touching the Deliver page.

### 4. DaVinci Dark Carbon Professional Design System
- Built to match Blackmagic Design, Frame.io, and Linear NLE interfaces.
- DaVinci Dark Carbon palette (`#121215`, `#18181c`, `#202026`) with Resolve Orange (`#e15a29`) and Technical Cyan (`#0ea5e9`).
- High-density typography (`Inter` + `JetBrains Mono` for timecodes).
- Sharp monochrome SVG iconography with zero system emojis.
- High-efficiency telemetry bar displaying live engine status, Resolve connection, project name, active timeline, FPS, and clip counts.

---

## Directory Structure

```
com.bodycam.resolve.aicopilot/
├── manifest.xml             # Blackmagic Workflow Integration Manifest (v1.0, CRLF line endings)
├── package.json             # Electron application configuration
├── WorkflowIntegration.node # BMD native C++ Node.js addon
├── main.js                  # Electron main process (IPC handlers & file streamer)
├── preload.js               # Context-isolated secure bridge with timecode regex sanitization
├── index.html               # High-density DaVinci Dark Carbon NLE interface
├── renderer.js              # Telemetry polling, chat streaming, and action dispatcher
├── css/
│   └── styles.css           # Professional NLE styling (zero emojis, custom scrollbars)
├── server.py                # Python 3.11 background server & ResolveController (127.0.0.1:8765)
├── test_server.py           # Automated test suite (7/7 tests passed)
├── config.example.json      # Configuration template for multi-provider API keys
├── start_copilot_server.bat # Windows Batch launcher
├── start_copilot_server.ps1 # PowerShell launcher
└── snapshots/               # Directory for lossless frame grabs
```

---

## Installation & Setup

### 1. Prerequisites
- **DaVinci Resolve Studio 18, 19, or 21+** (Studio edition required for external scripting API and Workflow Integrations).
- **Python 3.10+** (Python 3.11 recommended).
- **Node.js** (Optional, for standalone Electron development).

### 2. Plugin Deployment Paths
Copy the `com.bodycam.resolve.aicopilot` folder to both official Blackmagic Design Workflow Integration directories on Windows:
```
%PROGRAMDATA%\Blackmagic Design\DaVinci Resolve\Support\Workflow Integration Plugins\
%PROGRAMDATA%\Blackmagic Design\DaVinci Resolve\Support\Developer\Workflow Integration Plugins\
```

### 3. Launching the Background Engine
In PowerShell or Command Prompt:
```powershell
python server.py
# Or execute start_copilot_server.bat
```
The engine starts on `http://127.0.0.1:8765`.

### 4. Opening in DaVinci Resolve Studio
1. Open **DaVinci Resolve Studio**.
2. Open any project and timeline.
3. In the top application menu bar, navigate to:  
   **Workspace** ➔ **Workflow Integrations** ➔ **DS Bodycam AI Copilot**.
4. Configure your preferred AI provider and API key in the **Settings & API** tab.

---

## Automated Verification & Testing

Execute the comprehensive test suite:
```powershell
python test_server.py
```
Validates:
- Health and telemetry endpoints (`/api/status`)
- Multi-provider configuration retrieval and key testing (`/api/config`, `/api/config/test`)
- Chat reasoning engine (`/api/chat`)
- Timeline track and clip inspection (`/api/timeline/inspect`)
- End-to-end video audit pipeline (`/api/timeline/audit`)
- Agentic Resolve command execution (`/api/resolve/execute`)
- Lossless frame snapshot retrieval (`/api/snapshots`)

---

## License & Compliance
This software communicates with Blackmagic Design DaVinci Resolve Studio via official public scripting modules and workflow integration specifications. All rights reserved.
