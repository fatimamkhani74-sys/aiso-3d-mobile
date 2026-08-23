const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onLoadModel: (callback) => {
    ipcRenderer.removeAllListeners('load-model');
    ipcRenderer.on('load-model', (event, filePath) => callback(filePath));
  },
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openHdrDialog: () => ipcRenderer.invoke('open-hdr-dialog'),
  getFileData: (filePath) => ipcRenderer.invoke('get-file-data', filePath),

  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
});
