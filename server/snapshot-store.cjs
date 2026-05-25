/**
 * snapshot-store.cjs
 * Persiste snapshots de realtime GA4 em JSONL no userData do Electron.
 *
 * Schema por linha:
 *   { ts, propertyId, activeUsers, events: { eventName: count, ... } }
 *
 * Um único snapshot por poll por propertyId — contém todos os eventos.
 * Janela retida em disco: RETAIN_MS (60 min). Limpeza automática ao gravar.
 */

const fs   = require('fs')
const path = require('path')

const RETAIN_MS = 60 * 60 * 1000  // manter 60 min no disco
const WINDOW_MS = 30 * 60 * 1000  // janela padrão para getTimeline

function getStorePath() {
  const base = process.env.FAROL_USER_DATA || require('os').tmpdir()
  return path.join(base, 'farol-snapshots.jsonl')
}

// Cache em memória: Map<propertyId, Snapshot[]>
const _mem    = new Map()
let _loaded   = false
let _snapCount = 0  // contador global para triggerar compactação

function _ensureLoaded() {
  if (_loaded) return
  _loaded = true
  const p = getStorePath()
  if (!fs.existsSync(p)) return
  try {
    const lines  = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)
    const cutoff = Date.now() - RETAIN_MS
    for (const line of lines) {
      try {
        const snap = JSON.parse(line)
        if (snap.ts < cutoff) continue
        if (!_mem.has(snap.propertyId)) _mem.set(snap.propertyId, [])
        _mem.get(snap.propertyId).push(snap)
        _snapCount++
      } catch (_) {}
    }
  } catch (e) {
    console.warn('[snapshot-store] falha ao carregar histórico:', e.message)
  }
}

/**
 * Grava um snapshot completo da property.
 * @param {string} propertyId
 * @param {number} activeUsers
 * @param {Array<{event:string, count:number}>} topEvents  — array vindo da API
 */
function recordSnapshot({ propertyId, activeUsers, topEvents }) {
  _ensureLoaded()

  // Converte topEvents em mapa { eventName: count }
  const events = {}
  for (const e of (topEvents || [])) {
    if (e.event) events[e.event] = e.count || 0
  }

  const snap = { ts: Date.now(), propertyId, activeUsers, events }

  if (!_mem.has(propertyId)) _mem.set(propertyId, [])
  const list = _mem.get(propertyId)
  list.push(snap)
  _snapCount++

  // Prune memória
  const cutoff = Date.now() - RETAIN_MS
  _mem.set(propertyId, list.filter(s => s.ts >= cutoff))

  // Persiste (append)
  try {
    fs.appendFileSync(getStorePath(), JSON.stringify(snap) + '\n', 'utf8')
  } catch (e) {
    console.warn('[snapshot-store] falha ao persistir snapshot:', e.message)
  }

  // Compacta a cada 300 snaps globais
  if (_snapCount % 300 === 0) _compactFile()
}

function _compactFile() {
  const cutoff = Date.now() - RETAIN_MS
  const all = []
  for (const snaps of _mem.values()) {
    for (const s of snaps) {
      if (s.ts >= cutoff) all.push(s)
    }
  }
  all.sort((a, b) => a.ts - b.ts)
  try {
    fs.writeFileSync(getStorePath(), all.map(s => JSON.stringify(s)).join('\n') + '\n', 'utf8')
    console.log(`[snapshot-store] compactado: ${all.length} snaps`)
  } catch (e) {
    console.warn('[snapshot-store] falha ao compactar:', e.message)
  }
}

/**
 * Retorna timeline agregada por minuto para um evento específico,
 * com page_view como série de referência paralela.
 * Formato compatível com o frontend:
 *   [{ minute, minAgo, [eventName]: count, page_view: count, activeUsers, total }]
 *
 * Se não houver snapshots suficientes (< 3), retorna array vazio
 * para o caller usar o fallback da API.
 */
function getTimeline(propertyId, event, windowMs = WINDOW_MS) {
  _ensureLoaded()
  const list   = _mem.get(propertyId) || []
  const cutoff = Date.now() - windowMs

  const byMinute = {}
  for (const snap of list) {
    if (snap.ts < cutoff) continue
    const d      = new Date(snap.ts)
    const label  = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const minAgo = Math.round((Date.now() - snap.ts) / 60000)

    if (!byMinute[label]) {
      byMinute[label] = { minute: label, minAgo, activeUsers: 0, total: 0 }
    }

    // Atualiza com o snap mais recente daquele minuto
    byMinute[label].activeUsers = snap.activeUsers
    byMinute[label].minAgo      = minAgo

    // Série do evento solicitado
    const evCount = snap.events?.[event] ?? 0
    byMinute[label][event] = evCount
    byMinute[label].total  = evCount

    // Série page_view como referência (se diferente do evento principal)
    if (event !== 'page_view') {
      byMinute[label].page_view = snap.events?.['page_view'] ?? 0
    }
  }

  return Object.values(byMinute).sort((a, b) => b.minAgo - a.minAgo)
}

function getStats() {
  _ensureLoaded()
  let total = 0
  for (const v of _mem.values()) total += v.length
  return { keys: _mem.size, snapshots: total, file: getStorePath() }
}

module.exports = { recordSnapshot, getTimeline, getStats }
