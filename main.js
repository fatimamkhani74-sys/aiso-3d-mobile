const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let pendingFilePath = null;

// Ensure single instance lock so double-clicking another file opens in existing window
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      const filePath = findModelInArgs(commandLine);
      if (filePath) {
        mainWindow.webContents.send('load-model', filePath);
      }
    }
  });
}

function findModelInArgs(argsArray) {
  if (!argsArray || !Array.isArray(argsArray)) return null;
  const validExts = ['.glb', '.gltf', '.obj', '.fbx', '.stl'];
  for (let i = 1; i < argsArray.length; i++) {
    const arg = argsArray[i].replace(/^"|"$/g, '');
    const ext = path.extname(arg).toLowerCase();
    if (validExts.includes(ext) && fs.existsSync(arg)) {
      return path.resolve(arg);
    }
  }
  return null;
}

function createWindow(filePath) {
  mainWindow = new BrowserWindow({
    title: 'Aiso 3D Viewer',
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0a0a0e',
    titleBarStyle: 'hidden',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // allow loading local files and hdri
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('did-finish-load', () => {
    const initial = filePath || pendingFilePath || findModelInArgs(process.argv);
    if (initial) {
      mainWindow.webContents.send('load-model', initial);
      pendingFilePath = null;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// macOS open-file event
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('load-model', filePath);
  } else {
    pendingFilePath = filePath;
  }
});

app.whenReady().then(() => {
  const initialFile = findModelInArgs(process.argv);
  createWindow(initialFile);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(null);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: '3D Models (*.glb, *.gltf, *.obj, *.fbx, *.stl)', extensions: ['glb', 'gltf', 'obj', 'fbx', 'stl'] },
      { name: 'GLB / GLTF Models', extensions: ['glb', 'gltf'] },
      { name: 'Wavefront OBJ', extensions: ['obj'] },
      { name: 'Autodesk FBX', extensions: ['fbx'] },
      { name: 'Stereolithography STL', extensions: ['stl'] },

    ]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('open-hdr-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'HDR Environment (*.hdr, *.exr)', extensions: ['hdr', 'exr'] }
    ]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('get-file-data', async (event, filePath) => {
  const buffer = fs.readFileSync(filePath);
  return {
    name: path.basename(filePath),
    ext: path.extname(filePath).toLowerCase(),
    size: fs.statSync(filePath).size,
    buffer: buffer
  };
});
const http = require('http');
const os = require('os');

let arServer = null;
let currentArModelBuffer = null;
let arPort = 8989;

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(interfaces)) {
    for (const alias of interfaces[name]) {
      if (alias.family === 'IPv4' && !alias.internal) {
        if (alias.address.startsWith('192.168.') || alias.address.startsWith('10.') || alias.address.startsWith('172.')) {
          return alias.address;
        }
        candidates.push(alias.address);
      }
    }
  }
  return candidates[0] || 'localhost';
}

function getArMobileHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Aiso 3D - Augmented Reality</title>
  <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body, html { width: 100%; height: 100%; overflow: hidden; background: #08080C; color: #fff; }
    #container { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; }
    
    header {
      position: absolute; top: env(safe-area-inset-top, 16px); left: 16px; right: 16px; z-index: 10;
      display: flex; align-items: center; justify-content: space-between;
      background: rgba(18, 18, 24, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      padding: 10px 16px; border-radius: 30px; border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
    .logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 15px; }
    .badge { background: linear-gradient(135deg, #3B82F6, #8B5CF6); padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; }

    model-viewer {
      width: 100%; height: 100%;
      --poster-color: transparent;
      --progress-bar-color: #3B82F6;
      --progress-bar-height: 3px;
    }

    .ar-launch-btn {
      position: absolute; bottom: calc(env(safe-area-inset-bottom, 24px) + 24px); left: 50%; transform: translateX(-50%);
      z-index: 10; width: calc(100% - 48px); max-width: 340px; height: 56px;
      background: linear-gradient(135deg, #3B82F6, #1D4ED8);
      border: none; border-radius: 28px;
      color: #FFFFFF; font-size: 16px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      box-shadow: 0 10px 30px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3);
      cursor: pointer; -webkit-tap-highlight-color: transparent;
      animation: pulseBtn 2s infinite ease-in-out;
    }
    @keyframes pulseBtn {
      0%, 100% { transform: translateX(-50%) scale(1); box-shadow: 0 10px 30px rgba(59, 130, 246, 0.5); }
      50% { transform: translateX(-50%) scale(1.03); box-shadow: 0 12px 35px rgba(59, 130, 246, 0.75); }
    }

    .hint-pill {
      position: absolute; bottom: calc(env(safe-area-inset-bottom, 24px) + 90px); left: 50%; transform: translateX(-50%);
      z-index: 10; background: rgba(0,0,0,0.65); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      padding: 6px 16px; border-radius: 20px; font-size: 12px; color: #94A3B8; border: 1px solid rgba(255,255,255,0.08);
      white-space: nowrap; pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="container">
    <header>
      <div class="logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
        <span>Aiso 3D</span>
      </div>
      <div class="badge">AR READY</div>
    </header>

    <model-viewer
      id="ar-viewer"
      src="/model.glb"
      ar
      ar-modes="webxr scene-viewer quick-look"
      camera-controls
      touch-action="pan-y"
      auto-rotate
      rotation-per-second="20deg"
      shadow-intensity="1.2"
      shadow-softness="0.8"
      exposure="1.0"
      ar-scale="auto"
      alt="3D Model in Augmented Reality">
      
      <div slot="ar-button" class="ar-launch-btn">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        <span>View in your space (AR)</span>
      </div>
    </model-viewer>

    <div class="hint-pill">Pinch to zoom • 1 finger to rotate</div>
  </div>
</body>
</html>`;
}

function ensureArServer() {
  if (arServer) return;

  arServer = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = req.url.split('?')[0];

    if (url === '/ar' || url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getArMobileHtml());
    } else if (url === '/model.glb') {
      if (currentArModelBuffer) {
        res.writeHead(200, {
          'Content-Type': 'model/gltf-binary',
          'Content-Length': currentArModelBuffer.length
        });
        res.end(currentArModelBuffer);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('No model loaded');
      }
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  arServer.listen(arPort, '0.0.0.0', () => {
    console.log(`AR Server listening on http://0.0.0.0:${arPort}/ar`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      arPort++;
      arServer.listen(arPort, '0.0.0.0');
    } else {
      console.error('AR Server error:', err);
    }
  });
}

ipcMain.handle('start-ar-server', async (event, glbBufferData) => {
  try {
    if (typeof glbBufferData === 'string') {
      currentArModelBuffer = Buffer.from(glbBufferData, 'base64');
    } else if (glbBufferData instanceof Uint8Array || Buffer.isBuffer(glbBufferData)) {
      currentArModelBuffer = Buffer.from(glbBufferData);
    } else if (glbBufferData && glbBufferData.buffer) {
      currentArModelBuffer = Buffer.from(glbBufferData.buffer);
    } else if (ArrayBuffer.isView(glbBufferData)) {
      currentArModelBuffer = Buffer.from(glbBufferData.buffer, glbBufferData.byteOffset, glbBufferData.byteLength);
    } else {
      currentArModelBuffer = Buffer.from(glbBufferData);
    }

    ensureArServer();
    const localIp = getLocalIpAddress();
    const arUrl = `http://${localIp}:${arPort}/ar`;
    return { success: true, url: arUrl, ip: localIp, port: arPort };
  } catch (err) {
    console.error('start-ar-server error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('stop-ar-server', async () => {
  if (arServer) {
    arServer.close();
    arServer = null;
  }
  currentArModelBuffer = null;
  return { success: true };
});

ipcMain.handle('get-local-ip', async () => {
  return getLocalIpAddress();
});

ipcMain.handle('minimize-window', () => mainWindow?.minimize());
ipcMain.handle('maximize-window', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('close-window', () => mainWindow?.close());
