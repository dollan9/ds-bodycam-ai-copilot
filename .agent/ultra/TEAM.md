# Multi-Agent Squad & Delegation: DS Bodycam AI Copilot

## Squad Roster
| AGENT ROLE | ARCHETYPE | PRIMARY RESPONSIBILITY |
| :--- | :--- | :--- |
| **Lead Orchestrator** | Orchestrator | End-to-end mission delivery, requirement enforcement, stage gates. |
| **Core Builder** | `ultra-builder` | Electron plugin (`manifest.xml`, `main.js`, `preload.js`, `index.html`, `renderer.js`, `styles.css`) and Python backend (`server.py`). |
| **System Critic** | `ultra-critic` | Adversarial audit of IPC security, CORS, memory leaks, and DaVinci API timeout resilience. |
| **Verification Lead** | `ultra-tester` | Live testing of server endpoints, DaVinci Resolve still capture, and timeline ingestion. |

## Delegation Contracts & Boundaries
- Builder owns all file generation and code syntax.
- Critic performs blind review of implementation against requirements.
- Tester validates execution against live DaVinci Resolve instance.
