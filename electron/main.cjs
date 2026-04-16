const { app, BrowserWindow, shell, ipcMain, screen, dialog } = require('electron')
const path = require('path')

const isDev = !app.isPackaged

let mainWindow
let apiServer = null

// ── Auto-updater ─────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (isDev) return // não checa updates em modo dev

  const { autoUpdater } = require('electron-updater')

  autoUpdater.autoDownload    = true  // baixa em background sem perguntar
  autoUpdater.autoInstallOnAppQuit = true  // instala na próxima vez que fechar

  // Update disponível — notifica na UI
  autoUpdater.on('update-available', (info) => {
    console.log(`[Farol] Update disponível: v${info.version}`)
    mainWindow?.webContents.send('update-status', {
      status: 'available',
      version: info.version,
    })
  })

  // Download concluído — pergunta se quer instalar agora
  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[Farol] Update baixado: v${info.version}`)
    mainWindow?.webContents.send('update-status', {
      status: 'downloaded',
      version: info.version,
    })
  })

  autoUpdater.on('error', (err) => {
    console.warn('[Farol] Auto-updater erro:', err.message)
  })

  // Checa ao iniciar (com delay para janela já estar pronta)
  setTimeout(() => autoUpdater.checkForUpdates(), 5000)
}

// IPC: instalar update imediatamente (chamado pelo renderer quando usuário confirma)
ipcMain.on('update-install-now', () => {
  const { autoUpdater } = require('electron-updater')
  autoUpdater.quitAndInstall(false, true)
})

// Inicia o servidor Express local
async function startApiServer() {
  try {
    process.env.FAROL_USER_DATA = app.getPath('userData')
    const { startServer } = require(path.join(__dirname, '..', 'server', 'index.cjs'))
    apiServer = await startServer()
    console.log('[Farol] API server iniciado')
  } catch (err) {
    console.error('[Farol] Falha ao iniciar API server:', err.message)
    // Notifica o usuário em vez de abrir com tela branca silenciosa
    dialog.showErrorBox(
      'Farol Tracking — Erro ao iniciar',
      `O servidor interno não conseguiu subir.\n\nMotivo: ${err.message}\n\nTente fechar outros aplicativos que usem a porta 3001 e abra o Farol novamente.`
    )
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

// IPC: file picker para service account JSON
ipcMain.handle('pick-service-account', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar Google Service Account',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths.length) return null
  const fs = require('fs')
  try {
    const content = fs.readFileSync(filePaths[0], 'utf8')
    const parsed = JSON.parse(content)
    // Valida que é um service account real
    if (!parsed.client_email || !parsed.private_key) return { error: 'Arquivo não parece ser um Service Account válido' }
    // Copia para userData para que o caminho seja estável
    const dest = require('path').join(app.getPath('userData'), 'service-account.json')
    fs.writeFileSync(dest, content, 'utf8')
    // Retorna também o conteúdo para salvar inline — elimina dependência de caminho físico
    return { path: dest, client_email: parsed.client_email, key: parsed }
  } catch (e) {
    return { error: e.message }
  }
})

// IPC: Notificação nativa do sistema operacional
ipcMain.handle('show-notification', (_event, { title, body, urgency = 'normal' }) => {
  try {
    const { Notification } = require('electron')
    if (!Notification.isSupported()) return { ok: false, reason: 'not-supported' }
    const n = new Notification({
      title: title || 'Farol',
      body: body || '',
      icon: require('path').join(__dirname, '..', 'src', 'assets', 'icon.png'),
      urgency, // 'normal' | 'critical' | 'low'
      silent: urgency === 'low',
    })
    n.on('click', () => mainWindow?.focus())
    n.show()
    return { ok: true }
  } catch (e) {
    console.warn('[Farol] Notification error:', e.message)
    return { ok: false, reason: e.message }
  }
})


app.whenReady().then(async () => {
  await startApiServer()
  createWindow()
  setupAutoUpdater()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (apiServer) apiServer.close()
    app.quit()
  }
})
