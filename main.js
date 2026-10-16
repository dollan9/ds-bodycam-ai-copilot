// DS Bodycam AI Copilot - DaVinci Resolve Workflow Integration Plugin
// Main Process (Electron) - Hardened & Verified

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let WorkflowIntegration = null;
try {
    WorkflowIntegration = require('./WorkflowIntegration.node');
} catch (e) {
    console.error('Failed to load WorkflowIntegration.node:', e);
}

const PLUGIN_ID = 'com.bodycam.resolve.aicopilot';
const SNAPSHOT_DIR = path.resolve(__dirname, 'snapshots');
const MAX_SNAPSHOT_BYTES = 25 * 1024 * 1024; // 25 MB limit

// Safe directory creation
try {
    if (!fs.existsSync(SNAPSHOT_DIR)) {
        fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    }
} catch (dirErr) {
    console.error(`Kunde inte skapa snapshot-mapp '${SNAPSHOT_DIR}':`, dirErr);
}

let mainWindow = null;
let resolveObj = null;
let isInitialized = false;

// Initialize Resolve Interface
async function getResolve() {
    if (resolveObj) return resolveObj;
    if (!WorkflowIntegration) return null;

    try {
        if (!isInitialized) {
            isInitialized = await WorkflowIntegration.Initialize(PLUGIN_ID);
        }
        if (isInitialized) {
            resolveObj = await WorkflowIntegration.GetResolve();
        }
    } catch (err) {
        console.error('Error in getResolve:', err);
    }
    return resolveObj;
}

// Helper: Get Current Project & Timeline
async function getCurrentContext() {
    const resolve = await getResolve();
    if (!resolve) return { resolve: null, project: null, timeline: null };

    const pm = await resolve.GetProjectManager();
    if (!pm) return { resolve, project: null, timeline: null };

    const project = await pm.GetCurrentProject();
    if (!project) return { resolve, project: null, timeline: null };

    let timeline = await project.GetCurrentTimeline();
    return { resolve, project, timeline };
}

// IPC: Get Status
ipcMain.handle('resolve:getStatus', async () => {
    try {
        const { resolve, project, timeline } = await getCurrentContext();
        if (!resolve) {
            return { connected: false, error: 'DaVinci Resolve ej ansluten' };
        }

        const projectName = project ? await project.GetName() : 'Inget projekt öppet';
        const timelineName = timeline ? await timeline.GetName() : 'Ingen aktiv tidslinje';
        const currentTimecode = timeline ? await timeline.GetCurrentTimecode() : '00:00:00:00';
        const startFrame = timeline ? await timeline.GetStartFrame() : 0;
        const endFrame = timeline ? await timeline.GetEndFrame() : 0;
        const videoTracks = timeline ? await timeline.GetTrackCount('video') : 0;
        const audioTracks = timeline ? await timeline.GetTrackCount('audio') : 0;

        return {
            connected: true,
            projectName,
            timelineName,
            currentTimecode,
            startFrame,
            endFrame,
            videoTracks,
            audioTracks,
            snapshotDir: SNAPSHOT_DIR
        };
    } catch (err) {
        return { connected: false, error: err.message };
    }
});

// IPC: Analyze Timeline
ipcMain.handle('resolve:analyzeTimeline', async () => {
    try {
        const { project, timeline } = await getCurrentContext();
        if (!timeline) {
            return { success: false, error: 'Ingen aktiv tidslinje hittades i DaVinci Resolve.' };
        }

        const timelineName = await timeline.GetName();
        const startFrame = await timeline.GetStartFrame();
        const endFrame = await timeline.GetEndFrame();
        const currentTimecode = await timeline.GetCurrentTimecode();
        const startTimecode = await timeline.GetStartTimecode();

        const videoTracksCount = await timeline.GetTrackCount('video');
        const audioTracksCount = await timeline.GetTrackCount('audio');

        const clips = [];

        // Scan Video Tracks
        for (let t = 1; t <= videoTracksCount; t++) {
            const trackName = await timeline.GetTrackName('video', t) || `Video ${t}`;
            let items = [];
            try {
                items = await timeline.GetItemListInTrack('video', t) || [];
            } catch (trackErr) {
                console.warn(`Fel vid läsning av videospår ${t}:`, trackErr);
            }

            for (const item of items) {
                try {
                    const name = await item.GetName();
                    const start = await item.GetStart();
                    const end = await item.GetEnd();
                    const duration = await item.GetDuration();
                    let markers = {};
                    try {
                        markers = await item.GetMarkers() || {};
                    } catch (mErr) {
                        markers = {};
                    }

                    clips.push({
                        type: 'video',
                        track: `V${t}`,
                        trackName,
                        name,
                        start,
                        end,
                        duration,
                        markersCount: Object.keys(markers).length
                    });
                } catch (clipErr) {
                    console.warn('Fel vid läsning av videoklipp:', clipErr);
                }
            }
        }

        // Scan Audio Tracks
        for (let a = 1; a <= audioTracksCount; a++) {
            const trackName = await timeline.GetTrackName('audio', a) || `Audio ${a}`;
            let items = [];
            try {
                items = await timeline.GetItemListInTrack('audio', a) || [];
            } catch (aTrackErr) {
                console.warn(`Fel vid läsning av ljudspår ${a}:`, aTrackErr);
            }

            for (const item of items) {
                try {
                    const name = await item.GetName();
                    const start = await item.GetStart();
                    const end = await item.GetEnd();
                    const duration = await item.GetDuration();

                    clips.push({
                        type: 'audio',
                        track: `A${a}`,
                        trackName,
                        name,
                        start,
                        end,
                        duration
                    });
                } catch (aClipErr) {
                    console.warn('Fel vid läsning av ljudklipp:', aClipErr);
                }
            }
        }

        // Timeline Markers
        let timelineMarkers = {};
        try {
            timelineMarkers = await timeline.GetMarkers() || {};
        } catch (tmErr) {
            console.warn('Fel vid läsning av tidslinjemarkörer:', tmErr);
        }

        const markersList = [];
        for (const [frame, info] of Object.entries(timelineMarkers)) {
            markersList.push({
                frame: parseInt(frame, 10),
                color: info.color || 'Blue',
                name: info.name || '',
                note: info.note || '',
                duration: info.duration || 1
            });
        }

        return {
            success: true,
            timelineName,
            currentTimecode,
            startTimecode,
            startFrame,
            endFrame,
            totalFrames: endFrame - startFrame,
            videoTracksCount,
            audioTracksCount,
            clipsCount: clips.length,
            clips,
            markersCount: markersList.length,
            markers: markersList,
            analyzedAt: new Date().toISOString()
        };
    } catch (err) {
        console.error('Error analyzing timeline:', err);
        return { success: false, error: err.message };
    }
});

// IPC: Capture Snapshot (Still without rendering, async read, size validated)
ipcMain.handle('resolve:captureSnapshot', async () => {
    try {
        const { project, timeline } = await getCurrentContext();
        if (!timeline) {
            return { success: false, error: 'Ingen aktiv tidslinje att ta bildruta från.' };
        }

        const gallery = await project.GetGallery();
        if (!gallery) {
            return { success: false, error: 'Kunde inte komma åt DaVinci Resolve Gallery.' };
        }

        const album = await gallery.GetCurrentStillAlbum();
        if (!album) {
            return { success: false, error: 'Inget aktivt Still Album tillgängligt.' };
        }

        const timecode = await timeline.GetCurrentTimecode();
        const sanitizedTc = String(timecode).replace(/[^0-9]/g, '-');
        const prefix = `still_${sanitizedTc}_${Date.now()}`;

        // Grab Still from current playhead position
        const still = await timeline.GrabStill();
        if (!still) {
            return { success: false, error: 'GrabStill misslyckades. Kontrollera att tidslinjen har ett videoklipp vid aktuell playhead.' };
        }

        // Export as PNG
        const exportSuccess = await album.ExportStills([still], SNAPSHOT_DIR, prefix, 'png');

        // Immediately delete still from gallery to keep user's project clean
        try {
            await album.DeleteStills([still]);
        } catch (delErr) {
            console.warn('Could not delete temp still from gallery:', delErr);
        }

        if (!exportSuccess) {
            return { success: false, error: 'Kunde inte exportera stillbild till disk.' };
        }

        // Find exported PNG securely inside SNAPSHOT_DIR
        const files = await fs.promises.readdir(SNAPSHOT_DIR);
        const matchingFile = files.find(f => f.startsWith(prefix) && f.endsWith('.png'));

        if (!matchingFile) {
            return { success: false, error: 'Kunde inte lokalisera den exporterade PNG-filen.' };
        }

        const filePath = path.resolve(SNAPSHOT_DIR, path.basename(matchingFile));
        // Verify path stays strictly inside SNAPSHOT_DIR
        if (!filePath.startsWith(SNAPSHOT_DIR)) {
            return { success: false, error: 'Otillåten filsökväg.' };
        }

        const stats = await fs.promises.stat(filePath);
        if (stats.size > MAX_SNAPSHOT_BYTES) {
            return { success: false, error: 'Bildrutan överskrider maximal tillåten filstorlek (25MB).' };
        }

        // Asynchronous non-blocking file read
        const fileBuffer = await fs.promises.readFile(filePath);
        const base64Data = fileBuffer.toString('base64');
        const dataUri = `data:image/png;base64,${base64Data}`;

        return {
            success: true,
            fileName: matchingFile,
            filePath,
            dataUri,
            timecode,
            capturedAt: new Date().toISOString()
        };
    } catch (err) {
        console.error('Error capturing snapshot:', err);
        return { success: false, error: err.message };
    }
});

// IPC: Jump To Timecode
ipcMain.handle('resolve:jumpToTimecode', async (event, timecode) => {
    try {
        if (!timecode || typeof timecode !== 'string' || !/^\d{2}:\d{2}:\d{2}[:;]\d{2}$/.test(timecode.trim())) {
            return { success: false, error: 'Ogiltigt tidskodsformat.' };
        }
        const { timeline } = await getCurrentContext();
        if (!timeline) return { success: false, error: 'Ingen aktiv tidslinje' };

        const success = await timeline.SetCurrentTimecode(timecode.trim());
        return { success };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// IPC: Add Marker
ipcMain.handle('resolve:addMarker', async (event, markerData) => {
    try {
        const { timeline } = await getCurrentContext();
        if (!timeline) return { success: false, error: 'Ingen aktiv tidslinje' };

        let frame = markerData?.frame;
        if (frame === undefined || frame === null || typeof frame !== 'number') {
            const startFrame = await timeline.GetStartFrame();
            frame = startFrame;
        }

        const color = String(markerData?.color || 'Blue').slice(0, 30);
        const name = String(markerData?.name || 'AI Copilot Marker').slice(0, 100);
        const note = String(markerData?.note || '').slice(0, 500);
        const duration = typeof markerData?.duration === 'number' ? Math.max(1, markerData.duration) : 1;

        const success = await timeline.AddMarker(Math.floor(frame), color, name, note, duration, 'DS_AI_COPILOT');
        return { success };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// IPC: List Local Snapshots
ipcMain.handle('resolve:listLocalSnapshots', async () => {
    try {
        if (!fs.existsSync(SNAPSHOT_DIR)) return [];
        const files = await fs.promises.readdir(SNAPSHOT_DIR);
        const fileList = [];

        for (const f of files) {
            if (f.endsWith('.png')) {
                const fullPath = path.resolve(SNAPSHOT_DIR, path.basename(f));
                if (fullPath.startsWith(SNAPSHOT_DIR)) {
                    const stats = await fs.promises.stat(fullPath);
                    fileList.push({
                        name: f,
                        path: fullPath,
                        size: stats.size,
                        time: stats.mtime
                    });
                }
            }
        }

        return fileList.sort((a, b) => b.time - a.time);
    } catch (e) {
        return [];
    }
});

// IPC: Open Folder in Explorer (Strictly confined to SNAPSHOT_DIR)
ipcMain.handle('resolve:openFolder', async () => {
    shell.openPath(SNAPSHOT_DIR);
    return true;
});

// IPC: Get Snapshot Directory Path
ipcMain.handle('resolve:getSnapshotDirectory', () => SNAPSHOT_DIR);

// Create Window
function createWindow() {
    mainWindow = new BrowserWindow({
        title: 'DS Bodycam AI Copilot',
        width: 580,
        height: 920,
        minWidth: 460,
        minHeight: 650,
        backgroundColor: '#111215',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
