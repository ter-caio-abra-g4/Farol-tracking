/**
 * server/config.js
 * Carrega farol.config.json com fallback para G4 OS quando disponível.
 * NÃO modifica nenhum arquivo do G4 OS — somente lê.
 *
 * Sistema de credenciais portáteis:
 *   - farol.credentials.json pode estar em qualquer caminho salvo em credentials_source
 *   - Na inicialização, se o arquivo externo for mais novo que o local, mescla automaticamente
 *   - Credenciais externas SEMPRE ganham sobre as locais (campos de API)
 *   - Preferências de UI (property_id, etc.) são mantidas localmente
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

// Em produção (Electron empacotado), salva em userData (%APPDATA%\farol-tracking\)
// Em dev, salva na raiz do projeto para facilitar iteração
const USER_DATA = process.env.FAROL_USER_DATA || path.join(__dirname, '..')
const CONFIG_PATH = path.join(USER_DATA, 'farol.config.json')

// Campos que pertencem ao arquivo de credenciais (empresa) — ganham no merge
const CREDENTIAL_KEYS = ['ga4', 'databricks', 'meta', 'gtm', 'searchconsole']

/**
 * Exporta um farol.credentials.json a partir do config atual.
 * Contém apenas os campos de credenciais (sem preferências de UI).
 */
function exportCredentials(outputPath) {
  const cfg = loadConfig()
  const creds = {
    _farol_credentials: '1.0',
    _updated_at: new Date().toISOString(),
  }
  for (const key of CREDENTIAL_KEYS) {
    if (cfg[key]) creds[key] = cfg[key]
  }
  fs.writeFileSync(outputPath, JSON.stringify(creds, null, 2), 'utf8')
  return creds
}

/**
 * Importa um farol.credentials.json e mescla no config local.
 * Campos de credencial do arquivo importado sobrescrevem os locais.
 * Salva o caminho de origem em credentials_source para sync futuro.
 */
function importCredentials(credentialsPath) {
  if (!fs.existsSync(credentialsPath)) throw new Error('Arquivo não encontrado: ' + credentialsPath)
  const creds = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
  if (!creds._farol_credentials) throw new Error('Arquivo inválido — não é um farol.credentials.json')

  const cfg = loadConfig()
  for (const key of CREDENTIAL_KEYS) {
    if (creds[key]) cfg[key] = { ...(cfg[key] || {}), ...creds[key] }
  }
  // Salva caminho de origem para sync automático futuro
  cfg._credentials_source = credentialsPath
  cfg._credentials_synced_at = new Date().toISOString()
  saveConfig(cfg)
  return { ok: true, source: credentialsPath, updatedAt: creds._updated_at }
}

/**
 * Verifica se há um arquivo de credenciais externo configurado e mais novo.
 * Se sim, mescla automaticamente. Chamado na inicialização do servidor.
 * Nunca lança erro — falha silenciosamente para não bloquear o app.
 */
function syncCredentialsIfNewer() {
  try {
    const cfg = loadConfig()
    const source = cfg._credentials_source
    if (!source || !fs.existsSync(source)) return

    const extStat = fs.statSync(source)
    const localSyncedAt = cfg._credentials_synced_at ? new Date(cfg._credentials_synced_at) : new Date(0)

    if (extStat.mtime > localSyncedAt) {
      console.log('[Config] Credenciais externas mais novas — sincronizando:', source)
      importCredentials(source)
    }
  } catch (err) {
    console.warn('[Config] Falha ao sincronizar credenciais:', err.message)
  }
}

const G4OS_PATHS = {
  ga4ServiceAccount: path.join(
    os.homedir(),
    '.g4os', 'workspaces', 'my-workspace',
    'sources', 'ga4', 'service-account.json'
  ),
  metaConfig: path.join(
    os.homedir(),
    '.g4os', 'workspaces', 'my-workspace',
    'sources', 'meta', 'config.json'
  ),
  gtmConfig: path.join(
    os.homedir(),
    '.g4os', 'workspaces', 'my-workspace',
    'sources', 'gtm', 'config.json'
  ),
}

function loadConfig() {
  let cfg = {}
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  } catch (_) {
    cfg = {}
  }
  return cfg
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8')
}

/**
 * Detecta se o G4 OS está instalado e com credenciais disponíveis.
 * Retorna um objeto com os caminhos encontrados.
 */
function detectG4OS() {
  const result = {
    available: false,
    ga4ServiceAccountPath: null,
    metaAccessToken: null,
    gtmOAuthReady: false,
  }

  // GA4 — service-account.json
  if (fs.existsSync(G4OS_PATHS.ga4ServiceAccount)) {
    result.ga4ServiceAccountPath = G4OS_PATHS.ga4ServiceAccount
    result.available = true
  }

  // Meta — access_token no credentials.enc não é legível diretamente,
  // mas o farol.config.json pode ter sido preenchido manualmente ou via setup
  const farolCfg = loadConfig()
  if (farolCfg.meta && farolCfg.meta.access_token) {
    result.metaAccessToken = farolCfg.meta.access_token
  }

  // GTM — usa mcp-remote (OAuth do browser), não precisa de arquivo
  if (fs.existsSync(G4OS_PATHS.gtmConfig)) {
    result.gtmOAuthReady = true
    result.available = true
  }

  return result
}

/**
 * Importa credenciais do G4 OS para o farol.config.json local.
 * Operação não-destrutiva: só preenche campos vazios.
 */
function importFromG4OS() {
  const g4 = detectG4OS()
  const cfg = loadConfig()
  let changed = false

  if (g4.ga4ServiceAccountPath && !cfg.ga4?.service_account_path) {
    cfg.ga4 = cfg.ga4 || {}
    cfg.ga4.service_account_path = g4.ga4ServiceAccountPath
    // Extrair property_id do service account se disponível
    try {
      const sa = JSON.parse(fs.readFileSync(g4.ga4ServiceAccountPath, 'utf8'))
      cfg.ga4.client_email = sa.client_email
    } catch (_) {}
    changed = true
  }

  if (changed) saveConfig(cfg)
  return { imported: changed, g4detected: g4.available, paths: g4 }
}

module.exports = {
  loadConfig, saveConfig,
  detectG4OS, importFromG4OS,
  exportCredentials, importCredentials, syncCredentialsIfNewer,
  CONFIG_PATH,
}
