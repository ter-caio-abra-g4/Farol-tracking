/**
 * server/config.js
 * Carrega farol.config.json com fallback para G4 OS quando disponível.
 * NÃO modifica nenhum arquivo do G4 OS — somente lê.
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const CONFIG_PATH = path.join(__dirname, '..', 'farol.config.json')

const G4OS_PATHS = {
  ga4ServiceAccount: path.join(
    os.homedir(),
    '.g4os-public', 'workspaces', 'my-workspace',
    'sources', 'ga4', 'service-account.json'
  ),
  metaConfig: path.join(
    os.homedir(),
    '.g4os-public', 'workspaces', 'my-workspace',
    'sources', 'meta', 'config.json'
  ),
  gtmConfig: path.join(
    os.homedir(),
    '.g4os-public', 'workspaces', 'my-workspace',
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

module.exports = { loadConfig, saveConfig, detectG4OS, importFromG4OS, CONFIG_PATH }
