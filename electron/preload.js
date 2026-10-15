const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fwNative', {
  platform: 'electron',
  downloadAndInstall(url, onProgress) {
    const listener = (_e, p) => onProgress && onProgress(p);
    ipcRenderer.on('fw:progress', listener);
    return ipcRenderer.invoke('fw:download-and-install', url)
      .finally(() => ipcRenderer.removeListener('fw:progress', listener));
  }
});
