const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onLoadModel: (callback) => {
    ipcRenderer.removeAllListeners('load-model');
    ipcRenderer.on('load-model', (event, filePath) => callback(filePath));
  },
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openHdrDialog: () => ipcRenderer.invoke('open-hdr-dialog'),
  getFileData: (filePath) => ipcRenderer.invoke('get-file-data', filePath),
  startArServer: (glbData) => ipcRenderer.invoke('start-ar-server', glbData),
  stopArServer: () => ipcRenderer.invoke('stop-ar-server'),
  getLocalIp: () => ipcRenderer.invoke('get-local-ip'),

  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
});
