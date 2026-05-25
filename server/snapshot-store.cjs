/**
 * snapshot-store.cjs
 * Persiste snapshots de realtime GA4 em JSONL no userData do Electron.
 * Cada linha: { ts, propertyId, event, activeUsers, eventCount }
 * Janela mantida: RETAIN_MS (padrão 60 min). Limpeza automática ao gravar.
 */

const fs   = require('fs')
const path = require('path')

const RETAIN_MS  = 60 * 60 * 1000   // manter 60 min de histórico no disco
const WINDOW_MS  = 30 * 60 * 1000   // retornar últimos 30 min na timeline

// Resolve o caminho do arquivo de snapshots
function getStorePath() {
  const base = process.env.FAROL_USER_DATA || require('os').tmpdir()
  return path.join(base, 'farol-snapshots.jsonl')
}

// Cache em memória para evitar releitura constante do disco
// Estrutura: Map<`${propertyId}:${event}`, Snapshot[]>
const _mem = new Map()
let _loaded = false

function _ensureLoaded() {
  if (_loaded) return
  _loaded = true
  const p = getStorePath()
  if (!fs.existsSync(p)) return
  try {
    const lines = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)
    const cutoff = Date.now() - RETAIN_MS
    for (const line of lines) {
      try {
        const snap = JSON.parse(line)
        if (snap.ts < cutoff) continue
        const key = `${snap.propertyId}:${snap.event}`
        if (!_mem.has(key)) _mem.set(key, [])
        _mem.get(key).push(snap)
      } catch (_) { /* linha corrompida — ignora */ }
    }
  } catch (e) {
    console.warn('[snapshot-store] falha ao carregar histórico:', e.message)
  }
}

function recordSnapshot({ propertyId, event, activeUsers, eventCount }) {
  _ensureLoaded()
  const snap = { ts: Date.now(), propertyId, event, activeUsers, eventCount }
  const key = `${propertyId}:${event}`
  if (!_mem.has(key)) _mem.set(key, [])

  const list = _mem.get(key)
  list.push(snap)

  // Remove entradas antigas da memória
  const cutoff = Date.now() - RETAIN_MS
  const pruned = list.filter(s => s.ts >= cutoff)
  _mem.set(key, pruned)

  // Persiste no arquivo JSONL (append)
  try {
    fs.appendFileSync(getStorePath(), JSON.stringify(snap) + '\n', 'utf8')
  } catch (e) {
    console.warn('[snapshot-store] falha ao persistir snapshot:', e.message)
  }

  // Compacta o arquivo de tempos em tempos (a cada 200 snaps para esta key)
  if (pruned.length % 200 === 0) _compactFile()
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
  } catch (e) {
    console.warn('[snapshot-store] falha ao compactar:', e.message)
  }
}

/**
 * Retorna a timeline de snapshots para uma property+evento,
 * agregada por minuto, nos últimos WINDOW_MS.
 * Formato de saída compatível com o que o frontend já espera:
 *   [{ minute: 'HH:MM', minAgo: N, [event]: count, page_view: count, total: N }]
 */
function getTimeline(propertyId, event, windowMs = WINDOW_MS) {
  _ensureLoaded()
  const key = `${propertyId}:${event}`
  const list = _mem.get(key) || []
  const cutoff = Date.now() - windowMs

  const byMinute = {}
  for (const snap of list) {
    if (snap.ts < cutoff) continue
    const d = new Date(snap.ts)
    const label = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const minAgo = Math.round((Date.now() - snap.ts) / 60000)
    if (!byMinute[label]) byMinute[label] = { minute: label, minAgo, total: 0, activeUsers: 0 }
    byMinute[label][event]       = snap.eventCount
    byMinute[label].page_view    = byMinute[label].page_view || 0
    byMinute[label].total        = snap.eventCount
    byMinute[label].activeUsers  = snap.activeUsers
    byMinute[label].minAgo       = minAgo
  }

  return Object.values(byMinute).sort((a, b) => b.minAgo - a.minAgo)
}

/**
 * Retorna contagem total de snapshots em memória (debug).
 */
function getStats() {
  _ensureLoaded()
  let total = 0
  for (const v of _mem.values()) total += v.length
  return { keys: _mem.size, snapshots: total, file: getStorePath() }
}

module.exports = { recordSnapshot, getTimeline, getStats }
