// DS Bodycam AI Copilot - Preload Bridge
const { contextBridge, ipcRenderer } = require('electron');

// Input validation helpers
function isValidTimecode(tc) {
    return typeof tc === 'string' && /^\d{2}:\d{2}:\d{2}[:;]\d{2}$/.test(tc.trim());
}

contextBridge.exposeInMainWorld('resolveAPI', {
    // Status & Ping
    pingResolve: () => ipcRenderer.invoke('resolve:ping'),
    getStatus: () => ipcRenderer.invoke('resolve:getStatus'),

    // Timeline Analysis
    analyzeTimeline: () => ipcRenderer.invoke('resolve:analyzeTimeline'),

    // Frame Snapshot (Capture Still directly from player without rendering/exporting video)
    captureSnapshot: (options = {}) => {
        const sanitizedOptions = typeof options === 'object' && options !== null ? options : {};
        return ipcRenderer.invoke('resolve:captureSnapshot', sanitizedOptions);
    },
    listLocalSnapshots: () => ipcRenderer.invoke('resolve:listLocalSnapshots'),

    // Edit Navigation & Markers (with input validation)
    jumpToTimecode: (timecode) => {
        if (!isValidTimecode(timecode)) {
            return Promise.reject(new Error('Ogiltigt tidskodsformat. Använd TT:MM:SS:FF.'));
        }
        return ipcRenderer.invoke('resolve:jumpToTimecode', String(timecode).trim());
    },
    addMarker: (markerData) => {
        if (!markerData || typeof markerData !== 'object') {
            return Promise.reject(new Error('Ogiltig markördata.'));
        }
        const sanitized = {
            frame: typeof markerData.frame === 'number' ? Math.floor(markerData.frame) : null,
            color: typeof markerData.color === 'string' ? markerData.color.slice(0, 30) : 'Blue',
            name: typeof markerData.name === 'string' ? markerData.name.slice(0, 100) : 'Marker',
            note: typeof markerData.note === 'string' ? markerData.note.slice(0, 500) : '',
            duration: typeof markerData.duration === 'number' ? Math.max(1, Math.floor(markerData.duration)) : 1
        };
        return ipcRenderer.invoke('resolve:addMarker', sanitized);
    },

    // App Control
    openFolder: () => ipcRenderer.invoke('resolve:openFolder'),
    getSnapshotDirectory: () => ipcRenderer.invoke('resolve:getSnapshotDirectory')
});
