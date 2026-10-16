// DS Bodycam AI Copilot - Preload Bridge
// Secure Context Isolation Bridge between Electron Renderer and Main Process

const { contextBridge, ipcRenderer } = require('electron');

// Helper: validate timecode format (HH:MM:SS:FF or HH:MM:SS;FF)
function isValidTimecode(tc) {
    return typeof tc === 'string' && /^\d{2}:\d{2}:\d{2}[:;]\d{2}$/.test(tc.trim());
}

contextBridge.exposeInMainWorld('resolveAPI', {
    // Health & Connection
    pingResolve: () => ipcRenderer.invoke('resolve:ping'),
    getStatus: () => ipcRenderer.invoke('resolve:getStatus'),

    // Deep Timeline Inspection & Metadata
    analyzeTimeline: () => ipcRenderer.invoke('resolve:analyzeTimeline'),

    // Frame Snapshot Acquisition (Lossless PNG directly from Playhead)
    captureSnapshot: (options = {}) => {
        const sanitized = typeof options === 'object' && options !== null ? options : {};
        return ipcRenderer.invoke('resolve:captureSnapshot', sanitized);
    },
    listLocalSnapshots: () => ipcRenderer.invoke('resolve:listLocalSnapshots'),

    // Playhead Control & Markers
    jumpToTimecode: (timecode) => {
        if (!isValidTimecode(timecode)) {
            return Promise.reject(new Error('Invalid timecode format. Expected HH:MM:SS:FF or HH:MM:SS;FF'));
        }
        return ipcRenderer.invoke('resolve:jumpToTimecode', String(timecode).trim());
    },
    addMarker: (markerData) => {
        if (!markerData || typeof markerData !== 'object') {
            return Promise.reject(new Error('Invalid marker payload.'));
        }
        const sanitized = {
            frame: typeof markerData.frame === 'number' ? Math.floor(markerData.frame) : null,
            timecode: typeof markerData.timecode === 'string' ? markerData.timecode.trim() : null,
            color: typeof markerData.color === 'string' ? markerData.color.slice(0, 30) : 'Blue',
            name: typeof markerData.name === 'string' ? markerData.name.slice(0, 100) : 'Marker',
            note: typeof markerData.note === 'string' ? markerData.note.slice(0, 500) : '',
            duration: typeof markerData.duration === 'number' ? Math.max(1, Math.floor(markerData.duration)) : 1,
            customData: typeof markerData.customData === 'string' ? markerData.customData.slice(0, 100) : 'DS_COPILOT'
        };
        return ipcRenderer.invoke('resolve:addMarker', sanitized);
    },

    // File System & Utilities
    openFolder: () => ipcRenderer.invoke('resolve:openFolder'),
    getSnapshotDirectory: () => ipcRenderer.invoke('resolve:getSnapshotDirectory')
});
