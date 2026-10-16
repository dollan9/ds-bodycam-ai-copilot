# Project Goal & Requirements: DS Bodycam AI Copilot

## 1. Executive Objective
- **Primary Goal**: Bygga ett specialanpassat DaVinci Resolve Workflow Integration Plugin ("DS Bodycam AI Copilot") med en lokal Python AI-bakgrundsserver, tidslinjeanalys, direkt frame-snapshot (bildrutor utan export) och inbyggd AI-chat.
- **Target Audience / End Users**: Klippare och producenter av polis-bodycam- och true crime-videor i DaVinci Resolve Studio.
- **Complexity Tier**: Large (Workflow Integration Electron App, native C++ node addon, Python background server, DaVinci Studio Scripting API integration).

## 2. Intent Disambiguation
- **Explicit User Requirements**:
  1. Skapa Workflow Integration Plugin "DS Bodycam AI Copilot" som visas som en panel under `Workspace -> Workflow Integrations`.
  2. Inbyggd chattruta där användaren kan skriva instruktioner till AI:n.
  3. "Analysera Tidslinje"-knapp som via DaVinci Studio Scripting API läser av alla klipp, namn, in-/ut-tider och markers, och skickar till lokal Python-bakgrundsserver.
  4. Funktion för att ta snapshots (bildrutor) direkt från DaVinci-spelaren och spara i en mapp så att AI kan se bilderna direkt utan videorendering.
  5. **STRIKT FÖRBUD MOT RENDER/EXPORT**: Inga render-flikar, inga export-inställningar, inga render jobs. Pluginet är uteslutande till för redigering och analys.
  6. Placera filerna i DaVinci Resolves officiella mapp för Workflow Integrations på Windows (`%PROGRAMDATA%\Blackmagic Design\DaVinci Resolve\Support\Developer\Workflow Integration Plugins` och `%PROGRAMDATA%\Blackmagic Design\DaVinci Resolve\Support\Workflow Integration Plugins`).

- **Agent Recommendations & Inferred Enhancements**:
  1. Klickbara tidskoder i chatten och tidslinjelistan som automatiskt hoppar DaVinci-spelarens playhead till exakt tidskod.
  2. Snabbknapp för att sätta redigeringsmarkörer (t.ex. "Sladd / Censor / Blur", "Viktigt citat", "Händelse") direkt i Resolve.
  3. Direkt förhandsvisning av tagna snapshots i UI-panelen.
  4. Robust lokal Python-server utan tunga externa beroenden som startar omedelbart och kommunicerar sömlöst via REST JSON.

## 3. Scope Boundaries
- **In-Scope**:
  - `manifest.xml`, `package.json`, `main.js`, `preload.js`, `renderer.js`, `index.html`, `css/styles.css`.
  - Kopiering och länkning av `WorkflowIntegration.node`.
  - Python background server (`server.py`) med API:er för chat, tidslinjeanalys, snapshot-lagring och markeringsskapande.
  - Snapshot-metod via Resolve API (`timeline.GrabStill()` + `album.ExportStills()` + `album.DeleteStills()`).
  - Tidslinjeanalys (`timeline.GetItemListInTrack()`, `timeline.GetMarkers()`).
  - Installation i båda relevanta plugin-katalogerna i ProgramData.
- **Out-of-Scope**:
  - All form av videorendering / Timeline Export (uttryckligen uteslutet av användaren).
  - Tunga externa molndatabaser.

## 4. Constraints & Guardrails
- **Technical Constraints**: Electron 36.3.2 (DaVinci Resolve intern runtime), Node sandbox & contextIsolation, DaVinci Studio Scripting API (Python 3.11 / JS).
- **Resource Constraints**: Python standardbibliotek / FastAPI om tillgängligt; noll onödiga beroenden som kan fallera.
- **Security & Safety Constraints**: Lokal localhost-kommunikation (127.0.0.1:8765), inga oskyddade öppna portar mot internet.

## 5. Acceptance Criteria & Definition of Done (DoD)
- [ ] Pluginet är korrekt strukturerat med `manifest.xml`, `main.js`, `preload.js`, `index.html`, `renderer.js` och `WorkflowIntegration.node`.
- [ ] Render-fliken är helt borttagen och det finns inga export-funktioner i UI.
- [ ] Chattruta fungerar och kan kommunicera med lokal Python-server.
- [ ] "Analysera Tidslinje" läser klipp (namn, in, ut, duration, spår) och markörer via Resolve Scripting API och skickar till servern.
- [ ] "Ta Snapshot" fångar aktuell bildruta i Resolve och sparar till mapp med direkt preview i UI utan videorendering.
- [ ] Klick på tidskoder i UI flyttar playhead i Resolve.
- [ ] Filerna installerade i `C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Workflow Integration Plugins\com.bodycam.resolve.aicopilot` samt `C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Workflow Integration Plugins\com.bodycam.resolve.aicopilot`.
- [ ] Oberoende kodgranskning (Hermes review_diff) genomförd och godkänd.
