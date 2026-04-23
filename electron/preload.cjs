const { contextBridge, ipcRenderer } = require('electron')

// Injeta a porta do servidor no window para que api.js use a porta correta
// mesmo se o servidor subiu em porta alternativa (3002, 3003, etc.)
const serverPort = process.env.FAROL_PORT || '3001'
contextBridge.exposeInMainWorld('__FAROL_PORT', Number(serverPort))

contextBridge.exposeInMainWorld('rais', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Estado da janela — consulta inicial + callback quando muda
  getWindowState: () => ipcRenderer.invoke('get-window-state'),
  onWindowState: (cb) => {
    ipcRenderer.on('window-state', (_e, state) => cb(state))
  },

  // Python bridge
  pythonCall: (script, args = []) =>
    ipcRenderer.invoke('python-call', { script, args }),

  // File picker para service account
  pickServiceAccount: () => ipcRenderer.invoke('pick-service-account'),

  // Notificação nativa do SO
  notify: (title, body, urgency = 'normal') =>
    ipcRenderer.invoke('show-notification', { title, body, urgency }),

  // Auto-updater
  onUpdateStatus: (cb) => {
    ipcRenderer.on('update-status', (_e, info) => cb(info))
  },
  installUpdate: () => ipcRenderer.send('update-install-now'),
})
