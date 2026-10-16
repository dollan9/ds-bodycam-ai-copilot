// DS Bodycam AI Copilot - Renderer Logic

const API_SERVER_URL = 'http://127.0.0.1:8765';

let currentTimelineData = null;
let cachedSnapshots = [];

// DOM Elements
const lblProject = document.getElementById('lblProject');
const lblTimeline = document.getElementById('lblTimeline');
const lblTimecode = document.getElementById('lblTimecode');
const dotResolve = document.getElementById('dotResolve');
const txtResolve = document.getElementById('txtResolve');
const dotServer = document.getElementById('dotServer');
const txtServer = document.getElementById('txtServer');

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const targetTab = document.getElementById(btn.dataset.tab);
        if (targetTab) targetTab.classList.add('active');
    });
});

// Refresh System Status
async function refreshStatus() {
    // Check DaVinci Resolve via IPC
    try {
        if (window.resolveAPI) {
            const status = await window.resolveAPI.getStatus();
            if (status && status.connected) {
                dotResolve.className = 'status-dot active';
                txtResolve.textContent = 'Resolve Ansluten';
                lblProject.textContent = status.projectName || 'Inget projekt';
                lblTimeline.textContent = status.timelineName || 'Ingen tidslinje';
                lblTimecode.textContent = status.currentTimecode || '00:00:00:00';
            } else {
                dotResolve.className = 'status-dot error';
                txtResolve.textContent = 'Resolve Standby';
                lblProject.textContent = '-';
                lblTimeline.textContent = '-';
            }
        }
    } catch (e) {
        dotResolve.className = 'status-dot error';
        txtResolve.textContent = 'Resolve Av';
    }

    // Check Python Background Server
    try {
        const res = await fetch(`${API_SERVER_URL}/api/status`);
        if (res.ok) {
            const data = await res.json();
            dotServer.className = 'status-dot active';
            txtServer.textContent = 'Server Online';
        } else {
            dotServer.className = 'status-dot error';
            txtServer.textContent = 'Server Fel';
        }
    } catch (e) {
        dotServer.className = 'status-dot error';
        txtServer.textContent = 'Server Offline';
    }
}

// Initial status & periodic refresh
refreshStatus();
setInterval(refreshStatus, 4000);

lblTimecode.addEventListener('click', refreshStatus);

// ==========================================
// AI Copilot Chat Implementation
// ==========================================
const chatHistory = document.getElementById('chatHistory');
const chatInput = document.getElementById('chatInput');
const btnSendChat = document.getElementById('btnSendChat');

function appendMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${sender}`;

    const header = document.createElement('div');
    header.className = 'msg-header';
    header.innerHTML = `<span>${sender === 'user' ? 'Du' : 'DS AI Copilot'}</span> • <span>${new Date().toLocaleTimeString()}</span>`;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    // Simple markdown-to-html formatter
    let formatted = text
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code class="clickable-code">$1</code>');

    bubble.innerHTML = formatted;

    // Attach click events to any timecode-formatted text
    bubble.querySelectorAll('code').forEach(codeElem => {
        const textContent = codeElem.textContent.trim();
        if (/^\d{2}:\d{2}:\d{2}[:;]\d{2}$/.test(textContent)) {
            codeElem.style.cursor = 'pointer';
            codeElem.title = 'Klicka för att hoppa till denna tidskod i DaVinci Resolve';
            codeElem.addEventListener('click', async () => {
                if (window.resolveAPI) {
                    await window.resolveAPI.jumpToTimecode(textContent);
                    refreshStatus();
                }
            });
        }
    });

    msgDiv.appendChild(header);
    msgDiv.appendChild(bubble);
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function sendChatMessage(promptText) {
    const text = promptText || chatInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    if (!promptText) chatInput.value = '';

    btnSendChat.disabled = true;
    btnSendChat.textContent = '...';

    try {
        const res = await fetch(`${API_SERVER_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: text })
        });

        if (res.ok) {
            const data = await res.json();
            appendMessage('assistant', data.response || 'Ingen text mottagen.');
        } else {
            appendMessage('assistant', '⚠️ Serverfel: Kunde inte nå AI-servern på localhost:8765. Kontrollera att start_copilot_server.bat är igång.');
        }
    } catch (e) {
        appendMessage('assistant', `⚠️ Anslutningsfel: ${e.message}. Starta servern via start_copilot_server.bat.`);
    } finally {
        btnSendChat.disabled = false;
        btnSendChat.textContent = 'Skicka';
    }
}

btnSendChat.addEventListener('click', () => sendChatMessage());
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
    }
});

// Quick Prompts
document.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        sendChatMessage(prompt);
    });
});

// ==========================================
// Timeline Analysis Implementation
// ==========================================
const btnAnalyzeTimeline = document.getElementById('btnAnalyzeTimeline');
const statClips = document.getElementById('statClips');
const statTracks = document.getElementById('statTracks');
const statMarkers = document.getElementById('statMarkers');
const statDuration = document.getElementById('statDuration');
const clipsTableBody = document.getElementById('clipsTableBody');
const clipSearchInput = document.getElementById('clipSearchInput');

function formatFramesToTimecode(frames, fps = 30) {
    if (!frames || frames <= 0) return '00:00:00';
    const totalSeconds = Math.floor(frames / fps);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s}s`;
}

function renderClipsTable(clips) {
    if (!clips || clips.length === 0) {
        clipsTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">Inga klipp hittades på tidslinjen.</td></tr>';
        return;
    }

    const filterText = clipSearchInput.value.toLowerCase().trim();
    const filtered = clips.filter(c => !filterText || c.name.toLowerCase().includes(filterText) || c.track.toLowerCase().includes(filterText));

    if (filtered.length === 0) {
        clipsTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">Inga klipp matchar sökningen.</td></tr>';
        return;
    }

    clipsTableBody.innerHTML = filtered.map(clip => `
        <tr>
            <td><span class="track-badge ${clip.type}">${clip.track}</span></td>
            <td title="${clip.name}"><strong>${clip.name}</strong></td>
            <td>${clip.start}</td>
            <td>${clip.end}</td>
            <td>${clip.duration}</td>
            <td>
                <button class="btn-jump" onclick="jumpToClipFrame(${clip.start})">Hoppa</button>
            </td>
        </tr>
    `).join('');
}

window.jumpToClipFrame = async function(frame) {
    // Jump to timecode or tell server
    if (window.resolveAPI) {
        // Can convert frame to approx timecode or notify server
        refreshStatus();
    }
};

clipSearchInput.addEventListener('input', () => {
    if (currentTimelineData) {
        renderClipsTable(currentTimelineData.clips);
    }
});

btnAnalyzeTimeline.addEventListener('click', async () => {
    btnAnalyzeTimeline.disabled = true;
    btnAnalyzeTimeline.textContent = '⏳ Analyserar tidslinje i DaVinci Resolve...';

    try {
        if (!window.resolveAPI) throw new Error('resolveAPI saknas i fönstret');

        const result = await window.resolveAPI.analyzeTimeline();
        if (!result.success) {
            alert(`Kunde inte analysera tidslinje: ${result.error}`);
            return;
        }

        currentTimelineData = result;

        // Update stats
        statClips.textContent = result.clipsCount;
        statTracks.textContent = result.videoTracksCount;
        statMarkers.textContent = result.markersCount;
        statDuration.textContent = formatFramesToTimecode(result.totalFrames);

        renderClipsTable(result.clips);

        // Send to local Python Server
        fetch(`${API_SERVER_URL}/api/timeline/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result)
        }).catch(err => console.warn('Server sync error:', err));

        // Switch to chat or notify
        appendMessage('assistant', `✅ **Tidslinje analyserad!**\n- **Namn:** \`${result.timelineName}\`\n- **Klipp:** ${result.clipsCount} st (${result.videoTracksCount} videospår)\n- **Markörer:** ${result.markersCount} st\n- **Total längd:** ${formatFramesToTimecode(result.totalFrames)} (${result.totalFrames} bildrutor).\n\nFråga mig vad som helst om klipptempot, maskering eller händelseförloppet!`);

    } catch (err) {
        alert(`Fel under tidslinjeanalys: ${err.message}`);
    } finally {
        btnAnalyzeTimeline.disabled = false;
        btnAnalyzeTimeline.textContent = '🔍 Analysera Tidslinje Nu';
    }
});

// ==========================================
// Snapshot Implementation (No Render / Export)
// ==========================================
const btnTakeSnapshot = document.getElementById('btnTakeSnapshot');
const btnOpenSnapshotsFolder = document.getElementById('btnOpenSnapshotsFolder');
const snapshotsGrid = document.getElementById('snapshotsGrid');

function renderSnapshots() {
    if (!cachedSnapshots || cachedSnapshots.length === 0) {
        snapshotsGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                Inga bildrutor tagna än. Placera playhead i DaVinci-spelaren och klicka på "Ta Snapshot Nu".
            </div>`;
        return;
    }

    snapshotsGrid.innerHTML = cachedSnapshots.map(snap => `
        <div class="snapshot-card">
            <div class="snapshot-img-wrap" onclick="askAiAboutSnapshot('${snap.fileName}', '${snap.timecode}')">
                <img src="${snap.dataUri || (API_SERVER_URL + '/api/snapshots/' + snap.fileName)}" alt="${snap.fileName}">
                <div class="snapshot-tc-tag">${snap.timecode}</div>
            </div>
            <div class="snapshot-details">
                <div class="snapshot-title" title="${snap.fileName}">${snap.fileName}</div>
                <div class="snapshot-actions">
                    <button class="btn-secondary" style="flex:1;" onclick="askAiAboutSnapshot('${snap.fileName}', '${snap.timecode}')">
                        💬 Fråga AI
                    </button>
                    <button class="btn-jump" onclick="jumpToSnapshotTimecode('${snap.timecode}')">
                        ⏩ Hoppa
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

window.askAiAboutSnapshot = function(fileName, timecode) {
    // Switch to Chat tab
    document.querySelector('.tab-btn[data-tab="tab-chat"]').click();
    sendChatMessage(`Granska bildrutan ${fileName} vid tidskod ${timecode}. Behöver något censureras, maskas eller justeras här?`);
};

window.jumpToSnapshotTimecode = async function(timecode) {
    if (window.resolveAPI) {
        await window.resolveAPI.jumpToTimecode(timecode);
        refreshStatus();
    }
};

btnTakeSnapshot.addEventListener('click', async () => {
    btnTakeSnapshot.disabled = true;
    btnTakeSnapshot.textContent = '📸 Fångar bildruta...';

    try {
        if (!window.resolveAPI) throw new Error('resolveAPI saknas');

        const snap = await window.resolveAPI.captureSnapshot();
        if (!snap.success) {
            alert(`Kunde inte fånga bildruta: ${snap.error}`);
            return;
        }

        cachedSnapshots.unshift(snap);
        renderSnapshots();

        // Inform Python Server
        fetch(`${API_SERVER_URL}/api/snapshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(snap)
        }).catch(err => console.warn('Could not post snapshot to server:', err));

        // Switch or notify
        appendMessage('assistant', `📸 **Ny bildruta fångad!**\n- **Fil:** \`${snap.fileName}\`\n- **Tidskod:** \`${snap.timecode}\`\n\nBildrutan har sparats i snapshot-katalogen helt utan rendering.`);

    } catch (err) {
        alert(`Fel vid fångst av bildruta: ${err.message}`);
    } finally {
        btnTakeSnapshot.disabled = false;
        btnTakeSnapshot.textContent = '📸 Ta Snapshot Nu';
    }
});

btnOpenSnapshotsFolder.addEventListener('click', async () => {
    if (window.resolveAPI) {
        await window.resolveAPI.openFolder();
    }
});

// Load existing snapshots on startup
async function loadSnapshots() {
    try {
        if (window.resolveAPI) {
            const files = await window.resolveAPI.listLocalSnapshots();
            if (files && files.length > 0) {
                cachedSnapshots = files.map(f => ({
                    fileName: f.name,
                    timecode: 'Sparad Still',
                    dataUri: null
                }));
                renderSnapshots();
            }
        }
    } catch (e) {
        console.warn('Could not list local snapshots:', e);
    }
}
loadSnapshots();

// ==========================================
// Quick Editing Tools (Markers & Jump)
// ==========================================
const btnAddMarker = document.getElementById('btnAddMarker');
const txtMarkerName = document.getElementById('txtMarkerName');
const txtMarkerNote = document.getElementById('txtMarkerNote');
const txtJumpTimecode = document.getElementById('txtJumpTimecode');
const btnExecuteJump = document.getElementById('btnExecuteJump');

btnAddMarker.addEventListener('click', async () => {
    const selectedColor = document.querySelector('input[name="markerColor"]:checked')?.value || 'Red';
    const name = txtMarkerName.value.trim() || 'Censor / Blur Markör';
    const note = txtMarkerNote.value.trim() || '';

    try {
        if (!window.resolveAPI) throw new Error('resolveAPI inte tillgänglig');

        const res = await window.resolveAPI.addMarker({
            color: selectedColor,
            name,
            note,
            duration: 1
        });

        if (res.success) {
            alert(`Marker "${name}" skapad på tidslinjen med färg ${selectedColor}!`);
            txtMarkerName.value = '';
            txtMarkerNote.value = '';
            refreshStatus();
        } else {
            alert(`Kunde inte lägga till markör: ${res.error || 'Kontrollera tidslinje'}`);
        }
    } catch (err) {
        alert(`Fel vid tillägg av markör: ${err.message}`);
    }
});

btnExecuteJump.addEventListener('click', async () => {
    const tc = txtJumpTimecode.value.trim();
    if (!tc) return;

    try {
        if (!window.resolveAPI) throw new Error('resolveAPI saknas');
        const res = await window.resolveAPI.jumpToTimecode(tc);
        if (res.success) {
            refreshStatus();
        } else {
            alert(`Kunde inte hoppa till ${tc}: ${res.error}`);
        }
    } catch (err) {
        alert(`Fel: ${err.message}`);
    }
});
