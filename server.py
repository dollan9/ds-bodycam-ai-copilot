#!/usr/bin/env python3
"""
DS Bodycam AI Copilot - Local Background Server
Runs on http://127.0.0.1:8765
Provides AI chat processing, timeline analysis, and snapshot storage
tailored for Bodycam and True Crime editing in DaVinci Resolve Studio.
"""

import http.server
import socketserver
import json
import os
import sys
import re
import urllib.parse
from datetime import datetime

# Automatically add DaVinci Resolve Scripting Modules to Python Path if on Windows
RESOLVE_SCRIPTING_MODULES = r"C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting\Modules"
if os.path.exists(RESOLVE_SCRIPTING_MODULES) and RESOLVE_SCRIPTING_MODULES not in sys.path:
    sys.path.append(RESOLVE_SCRIPTING_MODULES)

PORT = 8765
SNAPSHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "snapshots")
os.makedirs(SNAPSHOT_DIR, exist_ok=True)

# In-memory storage for active session
MEMORY = {
    "timeline": None,
    "snapshots": [],
    "chat_history": []
}

def get_resolve():
    """Attempt direct connection to DaVinci Resolve Scripting API if available."""
    try:
        import DaVinciResolveScript as dvr_script
        return dvr_script.scriptapp("Resolve")
    except Exception:
        return None

def analyze_bodycam_pacing(timeline_data):
    """Generates bodycam-specific editing metrics and recommendations."""
    if not timeline_data or not timeline_data.get("clips"):
        return {"summary": "Ingen tidslinjedata tillgänglig att analysera."}

    clips = timeline_data.get("clips", [])
    video_clips = [c for c in clips if c.get("type") == "video"]
    audio_clips = [c for c in clips if c.get("type") == "audio"]
    markers = timeline_data.get("markers", [])

    total_duration_frames = timeline_data.get("totalFrames", 0)
    durations = [c.get("duration", 0) for c in video_clips if c.get("duration", 0) > 0]
    avg_clip_frames = sum(durations) / len(durations) if durations else 0

    # Pacing analysis: identify long unbroken segments (>600 frames ~ 10-25s depending on fps)
    long_segments = [c for c in video_clips if c.get("duration", 0) > 750]
    fast_cuts = [c for c in video_clips if c.get("duration", 0) < 60]

    # Censor / redaction markers
    censor_markers = [m for m in markers if "censor" in m.get("name", "").lower() or "blur" in m.get("name", "").lower() or m.get("color") == "Red"]

    recommendations = []
    if len(long_segments) > 3:
        recommendations.append(f"Hittade {len(long_segments)} långa tagningar (>25s). Överväg att klippa in B-roll, 911-ljudvågor eller dashcam-vinklar för att bibehålla tittarretention.")
    if not censor_markers:
        recommendations.append("Inga blur/censor-markörer hittades. Kontrollera för personnummer, ansikten på utomstående och bilskyltar som kräver maskning.")
    if len(audio_clips) < 2:
        recommendations.append("Få separata ljudspår detekterade. Se till att kroppskamerans mikrofon, radioanrop och eventuell bakgrundsmusik ligger på separata kanaler för korrekt audio ducking.")

    return {
        "timelineName": timeline_data.get("timelineName"),
        "totalVideoClips": len(video_clips),
        "totalAudioClips": len(audio_clips),
        "totalMarkers": len(markers),
        "avgClipDurationFrames": round(avg_clip_frames, 1),
        "longTakesCount": len(long_segments),
        "fastCutsCount": len(fast_cuts),
        "censorMarkersCount": len(censor_markers),
        "recommendations": recommendations,
        "analyzedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

def generate_copilot_response(user_prompt, timeline_data, latest_snapshot):
    """Generates domain-aware AI copilot advice for True Crime & Bodycam editing."""
    prompt_lower = user_prompt.lower()
    clips_count = len(timeline_data.get("clips", [])) if timeline_data else 0
    tl_name = timeline_data.get("timelineName", "Aktiv tidslinje") if timeline_data else "Aktiv tidslinje"

    # Context injection
    context_prefix = f"[Kontext: Tidslinje '{tl_name}', {clips_count} klipp]"

    if "analys" in prompt_lower or "tempo" in prompt_lower or "klipp" in prompt_lower:
        if not timeline_data:
            return f"{context_prefix}\nKlicka först på knappen **'Analysera Tidslinje'** så att jag kan läsa in dina spår, klipp och markörer direkt från DaVinci Resolve Studio."

        pacing = analyze_bodycam_pacing(timeline_data)
        recs = "\n".join([f"- {r}" for r in pacing.get("recommendations", [])])
        return f"""### 📊 Tidslinje- & Tempoanalys ({pacing['timelineName']})
- **Antal videoklipp:** {pacing['totalVideoClips']} st
- **Genomsnittlig klipplängd:** ~{pacing['avgClipDurationFrames']} bildrutor
- **Långa sekvenser (>25s):** {pacing['longTakesCount']} st
- **Klippmarkörer / Censur:** {pacing['censorMarkersCount']} st

**Rekommendationer för Bodycam-produktion:**
{recs}
"""

    elif "blur" in prompt_lower or "censor" in prompt_lower or "mask" in prompt_lower or "redigera" in prompt_lower:
        return f"""### 🛡️ Riktlinjer för Redaktion & Maskning (Polis-Bodycam)
1. **Ansikten på tredje part:** Alla vittnen, minderåriga och förbipasserande ska maskeras (Color Page -> Power Window + Tracker -> Mosaic Blur/Gaussian Blur).
2. **Känslig information:** Sök tidslinjen efter bildrutor med körkort, datorskärmar i polisbilen (MDT), adresskyltar och vapenhantering.
3. **Använd Markörer:** Sätt en **Röd markör** direkt i panelen för varje ställe som kräver blur så tappar du inte bort dem under klipparbetet!
"""

    elif "snapshot" in prompt_lower or "bild" in prompt_lower or "se" in prompt_lower:
        if latest_snapshot:
            return f"""### 📸 Bildanalys av Senaste Snapshot ({latest_snapshot.get('timecode', 'Okänd tid')})
Bildrutan **`{latest_snapshot.get('fileName')}`** har sparats i snapshot-mappen.
- **Tidskod:** `{latest_snapshot.get('timecode')}`
- **Granskning:** Bildrutan är tillgänglig för visuell inspektion direkt i panelen. Kontrollera ljussättning, rörelseoskärpa och identifierbara detaljer utan att behöva exportera videon.
"""
        else:
            return "Ingen snapshot har tagits än. Klicka på **'Ta Snapshot'** i Snapshot-fliken för att fånga den aktiva bildrutan direkt från DaVinci-spelaren!"

    elif "titel" in prompt_lower or "rubrik" in prompt_lower:
        return f"""### 🎯 YouTube-titlar för {tl_name} (Hög retention):
1. **"OFFICER DOWN: When a Routine Traffic Stop Turns Fatal..."**
2. **"He Had 3 Seconds to Decide... (Raw Bodycam)"**
3. **"Bodycam Shows What Really Happened Before Backup Arrived"**
4. **"Suspect Refused to Step Out. Then This Happened."**

*Tips: Håll titeln under 60 tecken och inled med videons starkaste händelse inom de första 15 sekunderna!*
"""

    else:
        return f"""Jag är din **DS Bodycam AI Copilot** i DaVinci Resolve.

Vad vill du göra med din tidslinje?
- **'Analysera tidslinje'**: Kontrollerar klipptempo, långa tagningar och markörer.
- **'Ta snapshot'**: Fångar aktuell bildruta i DaVinci-spelaren direkt utan videorendering.
- **'Föreslå blur'**: Identifierar områden som vanligtvis kräver maskning/censur i bodycam-material.
- **'Skapa markör'**: Sätter redigeringsflaggor direkt på tidslinjen.
"""

class CopilotRequestHandler(http.server.BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/status" or path == "/":
            resolve = get_resolve()
            resolve_status = bool(resolve)

            data = {
                "status": "online",
                "service": "DS Bodycam AI Copilot Server",
                "port": PORT,
                "resolveDirectConnected": resolve_status,
                "timelineCached": bool(MEMORY["timeline"]),
                "timelineName": MEMORY["timeline"].get("timelineName") if MEMORY["timeline"] else None,
                "clipsCount": len(MEMORY["timeline"].get("clips", [])) if MEMORY["timeline"] else 0,
                "snapshotsCount": len(MEMORY["snapshots"]),
                "snapshotDir": SNAPSHOT_DIR,
                "serverTime": datetime.now().isoformat()
            }
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))
            return

        elif path == "/api/snapshots":
            files = []
            if os.path.exists(SNAPSHOT_DIR):
                for f in os.listdir(SNAPSHOT_DIR):
                    if f.endswith(".png"):
                        fp = os.path.join(SNAPSHOT_DIR, f)
                        files.append({
                            "fileName": f,
                            "path": fp,
                            "size": os.path.getsize(fp),
                            "modified": os.path.getmtime(fp)
                        })
            files.sort(key=lambda x: x["modified"], reverse=True)

            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"snapshots": files}, ensure_ascii=False).encode("utf-8"))
            return

        elif path.startswith("/api/snapshots/"):
            fname = os.path.basename(path)
            fpath = os.path.join(SNAPSHOT_DIR, fname)
            if os.path.exists(fpath) and fname.endswith(".png"):
                self.send_response(200)
                self._send_cors_headers()
                self.send_header("Content-Type", "image/png")
                self.end_headers()
                with open(fpath, "rb") as img:
                    self.wfile.write(img.read())
                return
            else:
                self.send_response(404)
                self._send_cors_headers()
                self.end_headers()
                return

        self.send_response(404)
        self._send_cors_headers()
        self.end_headers()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b"{}"

        try:
            body = json.loads(post_data.decode("utf-8"))
        except Exception:
            body = {}

        if path == "/api/timeline/analyze":
            MEMORY["timeline"] = body
            analytics = analyze_bodycam_pacing(body)

            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "analytics": analytics}, ensure_ascii=False).encode("utf-8"))
            return

        elif path == "/api/chat":
            prompt = body.get("prompt", "").strip()
            latest_snap = MEMORY["snapshots"][-1] if MEMORY["snapshots"] else None
            response_text = generate_copilot_response(prompt, MEMORY["timeline"], latest_snap)

            chat_item = {
                "id": len(MEMORY["chat_history"]) + 1,
                "prompt": prompt,
                "response": response_text,
                "timestamp": datetime.now().strftime("%H:%M:%S")
            }
            MEMORY["chat_history"].append(chat_item)

            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "response": response_text, "item": chat_item}, ensure_ascii=False).encode("utf-8"))
            return

        elif path == "/api/snapshot":
            MEMORY["snapshots"].append(body)
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "totalSnapshots": len(MEMORY["snapshots"])}, ensure_ascii=False).encode("utf-8"))
            return

        elif path == "/api/actions/jump":
            timecode = body.get("timecode")
            resolve = get_resolve()
            success = False
            if resolve and timecode:
                pm = resolve.GetProjectManager()
                proj = pm.GetCurrentProject() if pm else None
                tl = proj.GetCurrentTimeline() if proj else None
                if tl:
                    success = tl.SetCurrentTimecode(timecode)

            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"success": success}, ensure_ascii=False).encode("utf-8"))
            return

        elif path == "/api/actions/marker":
            color = body.get("color", "Blue")
            name = body.get("name", "AI Copilot")
            note = body.get("note", "")
            duration = body.get("duration", 1)
            frame = body.get("frame")

            resolve = get_resolve()
            success = False
            if resolve:
                pm = resolve.GetProjectManager()
                proj = pm.GetCurrentProject() if pm else None
                tl = proj.GetCurrentTimeline() if proj else None
                if tl:
                    if frame is None:
                        frame = tl.GetStartFrame()
                    success = tl.AddMarker(int(frame), color, name, note, duration, "DS_AI_COPILOT")

            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"success": success}, ensure_ascii=False).encode("utf-8"))
            return

        self.send_response(404)
        self._send_cors_headers()
        self.end_headers()

def run_server():
    server_address = ("127.0.0.1", PORT)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(server_address, CopilotRequestHandler) as httpd:
        print(f"==================================================")
        print(f" DS Bodycam AI Copilot Server")
        print(f" Status:  RUNNING on http://127.0.0.1:{PORT}")
        print(f" Snaps:   {SNAPSHOT_DIR}")
        print(f" DaVinci: {'CONNECTED' if get_resolve() else 'STANDBY'}")
        print(f"==================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == "__main__":
    run_server()
