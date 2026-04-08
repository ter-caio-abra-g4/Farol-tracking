const { app, BrowserWindow, shell, ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

const isDev = !app.isPackaged

let mainWindow
let pythonProcess

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#031A26',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'src', 'assets', 'icon.png'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5175')
    mainWindow.webContents.openDevTools({ mode: 'detach', activate: false })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// IPC: window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())

// IPC: Python bridge
ipcMain.handle('python-call', async (event, { script, args }) => {
  return new Promise((resolve, reject) => {
    const pythonPath = path.join(__dirname, '..', 'python', script)
    const proc = spawn('python', [pythonPath, ...args])
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d) => (stdout += d.toString()))
    proc.stderr.on('data', (d) => (stderr += d.toString()))
    proc.on('close', (code) => {
      if (code === 0) resolve(JSON.parse(stdout || '{}'))
      else reject(new Error(stderr))
    })
  })
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (pythonProcess) pythonProcess.kill()
    app.quit()
  }
})
