const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('rais', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Python bridge
  pythonCall: (script, args = []) =>
    ipcRenderer.invoke('python-call', { script, args }),
})
