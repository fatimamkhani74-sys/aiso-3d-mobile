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



ipcMain.handle('minimize-window', () => mainWindow?.minimize());
ipcMain.handle('maximize-window', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('close-window', () => mainWindow?.close());
