const { app, BrowserWindow, shell, ipcMain, screen } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

const isDev = !app.isPackaged

let mainWindow
let pythonProcess
let apiServer = null

// Inicia o servidor Express local
async function startApiServer() {
  try {
    const { startServer } = require(path.join(__dirname, '..', 'server', 'index.cjs'))
    apiServer = await startServer()
    console.log('[Farol] API server iniciado')
  } catch (err) {
    console.error('[Farol] Falha ao iniciar API server:', err.message)
  }
}

// Guarda bounds da janela antes de maximizar para restaurar depois
let restoredBounds = null

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay()

  // Tamanho inicial = 2/3 da workArea centralizado (será maximizado logo depois)
  const initW = Math.round(workArea.width  * (2 / 3))
  const initH = Math.round(workArea.height * (2 / 3))
  const initX = workArea.x + Math.round((workArea.width  - initW) / 2)
  const initY = workArea.y + Math.round((workArea.height - initH) / 2)

  mainWindow = new BrowserWindow({
    x: initX,
    y: initY,
    width: initW,
    height: initH,
    minWidth: 800,
    minHeight: 600,
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

  // Abre já maximizado — o maximize() nativo respeita taskbar e snap do Windows
  mainWindow.maximize()

  // Notifica o renderer quando o estado muda (maximizado vs janela)
  const emitWindowState = () => {
    if (!mainWindow) return
    mainWindow.webContents.send(
      'window-state',
      mainWindow.isMaximized() ? 'maximized' : 'normal'
    )
  }
  mainWindow.on('maximize',   emitWindowState)
  mainWindow.on('unmaximize', emitWindowState)
  mainWindow.on('restore',    emitWindowState)

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
  if (!mainWindow) return
  const { workArea } = screen.getPrimaryDisplay()

  if (mainWindow.isMaximized()) {
    // Restaura para bounds guardados ou 2/3 centralizado como fallback
    if (restoredBounds) {
      mainWindow.unmaximize()
      mainWindow.setBounds(restoredBounds, true)
    } else {
      const w = Math.round(workArea.width  * (2 / 3))
      const h = Math.round(workArea.height * (2 / 3))
      const x = workArea.x + Math.round((workArea.width  - w) / 2)
      const y = workArea.y + Math.round((workArea.height - h) / 2)
      mainWindow.unmaximize()
      mainWindow.setBounds({ x, y, width: w, height: h }, true)
    }
    restoredBounds = null
  } else {
    // Salva bounds atuais antes de maximizar
    restoredBounds = mainWindow.getBounds()
    mainWindow.maximize()
  }
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

app.whenReady().then(async () => {
  await startApiServer()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (pythonProcess) pythonProcess.kill()
    if (apiServer) apiServer.close()
    app.quit()
  }
})
