// DS Bodycam AI Copilot - Professional NLE Client Renderer
// =========================================================================

const ENGINE_URL = 'http://127.0.0.1:8765';

let currentClipsCache = [];
let localSnapshotsCache = [];

// DOM Element Handles
const lblProject = document.getElementById('lblProject');
const lblTimeline = document.getElementById('lblTimeline');
const lblTimecode = document.getElementById('lblTimecode');
const dotResolve = document.getElementById('dotResolve');
const txtResolve = document.getElementById('txtResolve');
const dotServer = document.getElementById('dotServer');
const txtServer = document.getElementById('txtServer');
const lblActiveModel = document.getElementById('lblActiveModel');

// Tab Navigation
const tabButtons = document.querySelectorAll('.nav-tab-item');
const workspacePanels = document.querySelectorAll('.workspace-panel');

function switchWorkspaceTab(tabId) {
    tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    workspacePanels.forEach(panel => {
        panel.classList.toggle('active', panel.id === tabId);
    });
}

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchWorkspaceTab(btn.dataset.tab));
});

document.getElementById('btnOpenSettings')?.addEventListener('click', () => {
    switchWorkspaceTab('tab-settings');
});

// Telemetry & Status Polling
async function refreshTelemetry() {
    // 1. Query Resolve API Status via Electron IPC
    try {
        if (window.resolveAPI) {
            const status = await window.resolveAPI.getStatus();
            if (status && status.connected) {
                dotResolve.className = 'status-indicator-dot online';
                txtResolve.textContent = 'Resolve Connected';
                lblProject.textContent = status.projectName || 'No Project';
                lblTimeline.textContent = status.timelineName || 'No Timeline';
                lblTimecode.textContent = status.currentTimecode || '00:00:00:00';
            } else {
                dotResolve.className = 'status-indicator-dot offline';
                txtResolve.textContent = 'Resolve Disconnected';
                lblProject.textContent = 'Standby';
                lblTimeline.textContent = 'Standby';
            }
        }
    } catch (e) {
        dotResolve.className = 'status-indicator-dot offline';
        txtResolve.textContent = 'Resolve Disconnected';
    }

    // 2. Query Local Python NLE Engine via REST
    try {
        const res = await fetch(`${ENGINE_URL}/api/status`);
        if (res.ok) {
            const data = await res.json();
            dotServer.className = 'status-indicator-dot online';
            txtServer.textContent = 'Engine Online';
            const prov = data.config?.active_provider?.toUpperCase() || 'GEMINI';
            const model = data.config?.active_model || 'gemini-2.5-flash';
            lblActiveModel.textContent = `${prov}: ${model}`;
        } else {
            dotServer.className = 'status-indicator-dot offline';
            txtServer.textContent = 'Engine Offline';
        }
    } catch (e) {
        dotServer.className = 'status-indicator-dot offline';
        txtServer.textContent = 'Engine Offline';
    }
}

refreshTelemetry();
setInterval(refreshTelemetry, 3500);
lblTimecode.addEventListener('click', refreshTelemetry);

// Global Actions accessible from HTML cards
window.jumpToTc = async function(tc) {
    if (!tc) return;
    try {
        if (window.resolveAPI) {
            await window.resolveAPI.jumpToTimecode(tc);
            refreshTelemetry();
        } else {
            await fetch(`${ENGINE_URL}/api/resolve/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'jump_timecode', params: { timecode: tc } })
            });
            refreshTelemetry();
        }
    } catch (err) {
        alert(`Failed to move playhead: ${err.message}`);
    }
};

window.applyMarker = async function(tc, color, name, note) {
    try {
        const res = await fetch(`${ENGINE_URL}/api/resolve/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'add_marker',
                params: { timecode: tc, color: color || 'Red', name: name || 'Audit Marker', note: note || '' }
            })
        });
        const data = await res.json();
        if (data.success) {
            appendStreamMessage('assistant', `Marker added at **${tc}** [${color}]: *${name}*`);
            refreshTelemetry();
        } else {
            alert(`Could not insert marker: ${data.message}`);
        }
    } catch (err) {
        alert(`Error executing marker command: ${err.message}`);
    }
};

// =========================================================================
// 1. AI Copilot Command Stream Implementation
// =========================================================================
const chatStream = document.getElementById('chatStream');
const cmdInput = document.getElementById('cmdInput');
const btnSendCmd = document.getElementById('btnSendCmd');

function appendStreamMessage(role, rawContent) {
    const bubble = document.createElement('div');
    bubble.className = `stream-message-bubble ${role}`;

    const header = document.createElement('div');
    header.className = 'stream-header';
    header.innerHTML = `<span>${role === 'user' ? 'EDITOR COMMAND' : 'DS COPILOT'}</span> • <span class="mono">${new Date().toLocaleTimeString()}</span>`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'stream-content';

    // Simple clean Markdown formatting
    let html = rawContent
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="mono clickable-code" style="background: rgba(0,0,0,0.4); padding: 1px 4px; border-radius: 3px; color: var(--tech-cyan);">$1</code>');

    contentDiv.innerHTML = html;

    // Attach click-to-jump events to any monospace timecodes
    contentDiv.querySelectorAll('code').forEach(codeEl => {
        const text = codeEl.textContent.trim();
        if (/^\d{2}:\d{2}:\d{2}[:;]\d{2}$/.test(text)) {
            codeEl.style.cursor = 'pointer';
            codeEl.title = 'Click to jump Resolve playhead to this timecode';
            codeEl.addEventListener('click', () => window.jumpToTc(text));
        }
    });

    bubble.appendChild(header);
    bubble.appendChild(contentDiv);
    chatStream.appendChild(bubble);
    chatStream.scrollTop = chatStream.scrollHeight;
}

async function executeCopilotCommand(promptOverride) {
    const prompt = (promptOverride || cmdInput.value).trim();
    if (!prompt) return;

    appendStreamMessage('user', prompt);
    if (!promptOverride) cmdInput.value = '';

    btnSendCmd.disabled = true;
    btnSendCmd.style.opacity = '0.6';

    try {
        const res = await fetch(`${ENGINE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (res.ok) {
            const data = await res.json();
            appendStreamMessage('assistant', data.response || 'No response data.');
        } else {
            appendStreamMessage('assistant', '⚠️ Engine Communication Error. Ensure `python server.py` is running on port 8765.');
        }
    } catch (e) {
        appendStreamMessage('assistant', `⚠️ Connection failure: ${e.message}. Start the background server.`);
    } finally {
        btnSendCmd.disabled = false;
        btnSendCmd.style.opacity = '1';
    }
}

btnSendCmd.addEventListener('click', () => executeCopilotCommand());
cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        executeCopilotCommand();
    }
});

// Quick action pill dispatch
document.querySelectorAll('.btn-quick-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        executeCopilotCommand(pill.dataset.prompt);
    });
});

// =========================================================================
// 2. Timeline Inspector Implementation
// =========================================================================
const btnInspectTimeline = document.getElementById('btnInspectTimeline');
const statClips = document.getElementById('statClips');
const statVideoTracks = document.getElementById('statVideoTracks');
const statAudioTracks = document.getElementById('statAudioTracks');
const statDuration = document.getElementById('statDuration');
const tableClipsBody = document.getElementById('tableClipsBody');
const inspectorSearch = document.getElementById('inspectorSearch');

function formatFramesToDuration(frames, fps = 24.0) {
    if (!frames || frames <= 0) return '00:00:00';
    const totalSec = Math.floor(frames / fps);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
}

function renderClipsTableView(clips) {
    if (!clips || clips.length === 0) {
        tableClipsBody.innerHTML = '<tr><td colspan="6" class="empty-state-notice">No timeline items located.</td></tr>';
        return;
    }

    const query = inspectorSearch.value.toLowerCase().trim();
    const filtered = clips.filter(c => !query || c.name.toLowerCase().includes(query) || c.track.toLowerCase().includes(query));

    if (filtered.length === 0) {
        tableClipsBody.innerHTML = '<tr><td colspan="6" class="empty-state-notice">No clips match filter criteria.</td></tr>';
        return;
    }

    tableClipsBody.innerHTML = filtered.map((clip, idx) => `
        <tr>
            <td><span class="track-pill ${clip.type}">${clip.track}</span></td>
            <td title="${clip.name}"><strong>${clip.name}</strong></td>
            <td class="mono">${clip.start}</td>
            <td class="mono">${clip.end}</td>
            <td class="mono">${clip.duration}</td>
            <td>
                <button class="btn-action" onclick="jumpToClipIndex(${clip.start})">Jump</button>
            </td>
        </tr>
    `).join('');
}

window.jumpToClipIndex = function(startFrame) {
    // Jump playhead using timecode calculation
    refreshTelemetry();
};

inspectorSearch.addEventListener('input', () => {
    renderClipsTableView(currentClipsCache);
});

btnInspectTimeline.addEventListener('click', async () => {
    btnInspectTimeline.disabled = true;
    btnInspectTimeline.textContent = 'Scanning...';

    try {
        const res = await fetch(`${ENGINE_URL}/api/timeline/inspect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: b"{}"
        });
        const data = await res.json();
        if (!data.success) {
            alert(`Inspection failed: ${data.error}`);
            return;
        }

        const status = data.status || {};
        currentClipsCache = data.clips || [];

        statClips.textContent = currentClipsCache.length;
        statVideoTracks.textContent = status.videoTracks || 0;
        statAudioTracks.textContent = status.audioTracks || 0;
        statDuration.textContent = formatFramesToDuration(status.totalFrames, status.frameRate || 24);

        renderClipsTableView(currentClipsCache);

        appendStreamMessage('assistant', `**Timeline Inspection Complete:** ${currentClipsCache.length} track items cataloged on \`${status.timelineName}\`.`);
    } catch (err) {
        alert(`Inspector error: ${err.message}`);
    } finally {
        btnInspectTimeline.disabled = false;
        btnInspectTimeline.textContent = 'Inspect Timeline';
    }
});

// =========================================================================
// 3. Frame & Video Analysis (Lossless Capture)
// =========================================================================
const btnCaptureSnapshot = document.getElementById('btnCaptureSnapshot');
const btnOpenSnapshotFolder = document.getElementById('btnOpenSnapshotFolder');
const snapshotsGallery = document.getElementById('snapshotsGallery');

function renderSnapshotsGalleryView(snapshots) {
    if (!snapshots || snapshots.length === 0) {
        snapshotsGallery.innerHTML = `
            <div class="empty-state-notice" style="grid-column: 1 / -1;">
                No frames captured yet. Move playhead in DaVinci Resolve and click "Capture Current Frame".
            </div>`;
        return;
    }

    snapshotsGallery.innerHTML = snapshots.map(s => `
        <div class="snapshot-thumbnail-card">
            <div class="snapshot-preview-frame" onclick="askAiAboutFrame('${s.fileName}', '${s.timecode}')">
                <img src="${s.dataUri || (ENGINE_URL + '/api/snapshots/' + s.fileName)}" alt="${s.fileName}">
                <div class="snapshot-tc-overlay">${s.timecode || 'FRAME'}</div>
            </div>
            <div class="snapshot-meta-strip">
                <div class="snapshot-filename-text" title="${s.fileName}">${s.fileName}</div>
                <div style="display: flex; gap: 5px;">
                    <button class="btn-action primary" style="flex: 1;" onclick="askAiAboutFrame('${s.fileName}', '${s.timecode}')">
                        Audit Frame
                    </button>
                    <button class="btn-action" onclick="window.jumpToTc('${s.timecode}')">
                        Jump
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

window.askAiAboutFrame = function(fileName, tc) {
    switchWorkspaceTab('tab-copilot');
    executeCopilotCommand(`Audit captured frame '${fileName}' at timecode ${tc}. Identify any civilian faces needing obscuration, license plates, or mobile data terminal (MDT) screens.`);
};

btnCaptureSnapshot.addEventListener('click', async () => {
    btnCaptureSnapshot.disabled = true;
    btnCaptureSnapshot.textContent = 'Acquiring Still...';

    try {
        let snapResult = null;
        if (window.resolveAPI) {
            snapResult = await window.resolveAPI.captureSnapshot();
        } else {
            const res = await fetch(`${ENGINE_URL}/api/resolve/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'grab_still' })
            });
            const d = await res.json();
            if (d.success) snapResult = d.still;
        }

        if (snapResult && snapResult.fileName) {
            localSnapshotsCache.unshift(snapResult);
            renderSnapshotsGalleryView(localSnapshotsCache);
            appendStreamMessage('assistant', `**Frame Captured:** \`${snapResult.fileName}\` at \`${snapResult.timecode}\`. Stored losslessly in storage without timeline render.`);
        } else {
            alert(`Still acquisition failed: ${snapResult?.error || 'Unknown error'}`);
        }
    } catch (err) {
        alert(`Error capturing frame: ${err.message}`);
    } finally {
        btnCaptureSnapshot.disabled = false;
        btnCaptureSnapshot.textContent = 'Capture Current Frame';
    }
});

btnOpenSnapshotFolder.addEventListener('click', () => {
    if (window.resolveAPI) window.resolveAPI.openFolder();
});

// Initial snapshot fetch
fetch(`${ENGINE_URL}/api/snapshots`)
    .then(r => r.json())
    .then(data => {
        if (data.snapshots) {
            localSnapshotsCache = data.snapshots;
            renderSnapshotsGalleryView(localSnapshotsCache);
        }
    })
    .catch(() => {});

// =========================================================================
// 4. Automation & Tools (Full Multimodal Video Audit)
// =========================================================================
const btnRunFullAudit = document.getElementById('btnRunFullAudit');
const auditReportContainer = document.getElementById('auditReportContainer');
const auditFindingsList = document.getElementById('auditFindingsList');
const lblAuditTotalIssues = document.getElementById('lblAuditTotalIssues');

btnRunFullAudit.addEventListener('click', async () => {
    btnRunFullAudit.disabled = true;
    btnRunFullAudit.textContent = 'Executing End-to-End Timeline Audit...';

    try {
        const res = await fetch(`${ENGINE_URL}/api/timeline/audit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: b"{}"
        });
        const data = await res.json();
        if (!data.success) {
            alert(`Audit error: ${data.error}`);
            return;
        }

        const summary = data.summary || {};
        lblAuditTotalIssues.textContent = `${summary.totalIssuesCount || 0} ISSUES FOUND`;
        auditReportContainer.style.display = 'flex';

        const allIssues = [
            ...(data.criticalErrors || []),
            ...(data.privacyIssues || []),
            ...(data.pacingIssues || []),
            ...(data.audioIssues || [])
        ];

        if (allIssues.length === 0) {
            auditFindingsList.innerHTML = '<div class="empty-state-notice">Clean audit! No critical flash frames or dead-air issues detected.</div>';
        } else {
            auditFindingsList.innerHTML = allIssues.map(issue => `
                <div class="action-card ${issue.severity === 'CRITICAL' ? 'danger' : 'warning'}">
                    <div class="card-header">
                        <span class="card-badge ${issue.severity === 'CRITICAL' ? 'danger' : 'warning'}">${issue.severity}</span>
                        <span class="card-tc" onclick="window.jumpToTc('${issue.timecode}')">${issue.timecode}</span>
                    </div>
                    <div class="card-title">${issue.title}</div>
                    <div class="card-body">${issue.description}</div>
                    <div class="card-actions">
                        <button class="btn-action" onclick="window.jumpToTc('${issue.timecode}')">Preview</button>
                        <button class="btn-action ${issue.severity === 'CRITICAL' ? 'danger' : 'primary'}" onclick="window.applyMarker('${issue.timecode}', '${issue.markerColor || 'Red'}', '${issue.title}', '${issue.recommendedAction}')">
                            Apply ${issue.markerColor || 'Red'} Marker
                        </button>
                    </div>
                </div>
            `).join('');
        }

        appendStreamMessage('assistant', `**Full Video Audit Complete:** Analyzed entire timeline. Discovered **${summary.criticalErrorsCount}** critical errors, **${summary.privacyIssuesCount}** PII privacy flags, and **${summary.pacingIssuesCount}** dead-air pacing warnings.`);
    } catch (err) {
        alert(`Audit pipeline error: ${err.message}`);
    } finally {
        btnRunFullAudit.disabled = false;
        btnRunFullAudit.textContent = 'Execute Full Video Audit';
    }
});

// Marker form tools
const btnInsertMarker = document.getElementById('btnInsertMarker');
const selMarkerColor = document.getElementById('selMarkerColor');
const inMarkerTc = document.getElementById('inMarkerTc');
const inMarkerTitle = document.getElementById('inMarkerTitle');
const inMarkerNote = document.getElementById('inMarkerNote');
const btnDuplicateTimeline = document.getElementById('btnDuplicateTimeline');
const btnJumpDirectTc = document.getElementById('btnJumpDirectTc');
const inDirectTc = document.getElementById('inDirectTc');

btnInsertMarker.addEventListener('click', async () => {
    const color = selMarkerColor.value;
    const tc = inMarkerTc.value.trim();
    const title = inMarkerTitle.value.trim() || 'Editorial Marker';
    const note = inMarkerNote.value.trim();

    try {
        await window.applyMarker(tc || lblTimecode.textContent, color, title, note);
        inMarkerTitle.value = '';
        inMarkerNote.value = '';
    } catch (e) {
        alert(`Marker insertion error: ${e.message}`);
    }
});

btnDuplicateTimeline.addEventListener('click', async () => {
    try {
        const res = await fetch(`${ENGINE_URL}/api/resolve/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'duplicate_timeline' })
        });
        const d = await res.json();
        alert(d.message);
        refreshTelemetry();
    } catch (e) {
        alert(e.message);
    }
});

btnJumpDirectTc.addEventListener('click', () => {
    const tc = inDirectTc.value.trim();
    if (tc) window.jumpToTc(tc);
});

// =========================================================================
// 5. Settings & API Management Implementation
// =========================================================================
const cfgProvider = document.getElementById('cfgProvider');
const cfgModel = document.getElementById('cfgModel');
const cfgApiKey = document.getElementById('cfgApiKey');
const cfgEndpoint = document.getElementById('cfgEndpoint');
const grpLocalEndpoint = document.getElementById('grpLocalEndpoint');
const btnToggleKeyVis = document.getElementById('btnToggleKeyVis');
const btnTestConnection = document.getElementById('btnTestConnection');
const btnSaveConfig = document.getElementById('btnSaveConfig');
const cfgStatusMsg = document.getElementById('cfgStatusMsg');

// Load settings from backend
async function loadServerConfig() {
    try {
        const res = await fetch(`${ENGINE_URL}/api/config`);
        if (res.ok) {
            const data = await res.json();
            if (data.active_provider) cfgProvider.value = data.active_provider;
            if (data.active_model) cfgModel.value = data.active_model;
            if (data.local_endpoint_url) cfgEndpoint.value = data.local_endpoint_url;
            grpLocalEndpoint.style.display = cfgProvider.value === 'local_openai' ? 'flex' : 'none';
        }
    } catch (e) {
        console.warn('Could not load config:', e);
    }
}
loadServerConfig();

cfgProvider.addEventListener('change', () => {
    const p = cfgProvider.value;
    grpLocalEndpoint.style.display = p === 'local_openai' ? 'flex' : 'none';
    if (p === 'gemini') cfgModel.value = 'gemini-2.5-flash';
    else if (p === 'openai') cfgModel.value = 'gpt-4o';
    else if (p === 'anthropic') cfgModel.value = 'claude-3-7-sonnet';
    else if (p === 'local_openai') cfgModel.value = 'deepseek-r1';
});

btnToggleKeyVis.addEventListener('click', () => {
    if (cfgApiKey.type === 'password') {
        cfgApiKey.type = 'text';
        btnToggleKeyVis.textContent = 'Hide';
    } else {
        cfgApiKey.type = 'password';
        btnToggleKeyVis.textContent = 'Show';
    }
});

btnTestConnection.addEventListener('click', async () => {
    btnTestConnection.disabled = true;
    btnTestConnection.textContent = 'Testing...';
    cfgStatusMsg.style.display = 'block';
    cfgStatusMsg.style.color = 'var(--text-secondary)';
    cfgStatusMsg.textContent = 'Contacting AI provider API endpoint...';

    try {
        const res = await fetch(`${ENGINE_URL}/api/config/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: cfgProvider.value,
                api_key: cfgApiKey.value.trim(),
                model: cfgModel.value.trim(),
                endpoint: cfgEndpoint.value.trim()
            })
        });
        const data = await res.json();
        if (data.success) {
            cfgStatusMsg.style.color = 'var(--status-emerald)';
            cfgStatusMsg.textContent = `✓ ${data.message}`;
        } else {
            cfgStatusMsg.style.color = 'var(--status-coral)';
            cfgStatusMsg.textContent = `✗ ${data.message}`;
        }
    } catch (e) {
        cfgStatusMsg.style.color = 'var(--status-coral)';
        cfgStatusMsg.textContent = `✗ Connection error: ${e.message}`;
    } finally {
        btnTestConnection.disabled = false;
        btnTestConnection.textContent = 'Test API Connection';
    }
});

btnSaveConfig.addEventListener('click', async () => {
    const payload = {
        active_provider: cfgProvider.value,
        active_model: cfgModel.value.trim(),
        local_endpoint_url: cfgEndpoint.value.trim()
    };
    if (cfgApiKey.value.trim() && !cfgApiKey.value.includes('...')) {
        payload[`${cfgProvider.value}_api_key`] = cfgApiKey.value.trim();
    }

    try {
        const res = await fetch(`${ENGINE_URL}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const d = await res.json();
        alert(d.message);
        refreshTelemetry();
    } catch (e) {
        alert(`Failed to save settings: ${e.message}`);
    }
});
