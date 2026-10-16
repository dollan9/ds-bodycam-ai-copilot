# DS Bodycam AI Copilot - DaVinci Resolve Workflow Integration Plugin

An autonomous AI Copilot Workflow Integration Plugin for **DaVinci Resolve Studio**, tailored specifically for police bodycam and true crime video editing workflows.

Built as an embedded Electron panel loaded directly via DaVinci Resolve's native `Workspace -> Workflow Integrations` menu, communicating with a lightweight local Python background server and the DaVinci Resolve Studio Scripting API.

---

## 🎯 Key Features

1. **Integrated AI Copilot Chat**
   - Natural language interaction inside DaVinci Resolve.
   - Domain-specific editing guidance for true crime and bodycam documentary standards (EWU, The Hidden Files, Law&Crime).
   - Clickable timecode tags in chat that automatically jump the DaVinci playhead to the exact frame.

2. **Timeline Analysis Engine ("Analysera Tidslinje")**
   - Reads all video tracks, audio tracks, clip names, in/out points, frame durations, and markers via DaVinci Studio Scripting API.
   - Pushes full timeline metadata to the local Python server (`POST /api/timeline/analyze`).
   - Analyzes clip pacing, detects excessively long unbroken takes (>25s), and flags missing audio layers or redactions.

3. **Lossless Frame Snapshots (Zero-Export / No Render)**
   - Captures pristine still frames directly from the active playhead position using Resolve's Gallery Still API (`GrabStill` + `ExportStills` + `DeleteStills`).
   - Automatically cleans up the user's still album to avoid project bloat.
   - Exports lossless PNGs in <100ms with instant thumbnail preview in the panel.
   - Enables Vision AI inspection without rendering or exporting the timeline.

4. **Redaction & Marker Tools**
   - Place color-coded markers directly onto the timeline (Red = Blur/Censor, Blue = Incident, Green = Audio/Dialog, Yellow = B-roll).
   - Timecode navigation input to jump playhead anywhere instantly.

5. **Strict No-Render / Zero-Export Policy**
   - Dedicated strictly to editing, pacing, censorship/blur tracking, and timeline analysis.
   - Render tab and delivery settings are entirely omitted.

---

## 🏗️ Architecture

```
com.bodycam.resolve.aicopilot/
├── manifest.xml             # Blackmagic Workflow Integration Manifest (v1.0)
├── package.json             # Electron configuration
├── WorkflowIntegration.node # BMD native C++ Node.js addon
├── main.js                  # Electron main process (IPC handlers & Resolve API bridge)
├── preload.js               # Context-isolated secure bridge with input sanitization
├── index.html               # Resolve Studio dark-themed UI panel
├── renderer.js              # Event handling & REST client
├── css/
│   └── styles.css           # DaVinci Resolve Studio dark theme
├── server.py                # Python 3.11 background server (localhost:8765)
├── test_server.py           # Automated test suite (4/4 passed)
├── start_copilot_server.bat # Windows Batch launcher
├── start_copilot_server.ps1 # PowerShell launcher
└── snapshots/               # Directory for frame captures
```

---

## 🚀 Installation & Deployment

### Windows Plugin Paths
Place the `com.bodycam.resolve.aicopilot` directory into:
- `%PROGRAMDATA%\Blackmagic Design\DaVinci Resolve\Support\Workflow Integration Plugins\`
- `%PROGRAMDATA%\Blackmagic Design\DaVinci Resolve\Support\Developer\Workflow Integration Plugins\`

### Running the Python Background Server
```powershell
python server.py
# Or double click start_copilot_server.bat
```
The server runs on `http://127.0.0.1:8765`.

### Launching in DaVinci Resolve Studio
1. Launch **DaVinci Resolve Studio**.
2. Open any project with a timeline.
3. In the top menu, navigate to:  
   **Workspace** ➔ **Workflow Integrations** ➔ **DS Bodycam AI Copilot**.

---

## 🧪 Testing
Run the automated test suite:
```powershell
python test_server.py
```

---

## 📄 License
MIT / Proprietary Blackmagic Design Workflow Integration API terms apply.
