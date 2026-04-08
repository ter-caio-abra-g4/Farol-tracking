/**
 * server/meta.js
 * Rotas Meta — usa access_token do farol.config.json (Graph API REST).
 */

const fetch = require('node-fetch')
const { loadConfig, saveConfig } = require('./config.cjs')

const BASE_URL = 'https://graph.facebook.com/v19.0'

function getToken() {
  const cfg = loadConfig()
  return cfg.meta?.access_token || null
}

function getPixelId() {
  const cfg = loadConfig()
  return cfg.meta?.pixel_id || null
}

async function metaGet(path, params = {}) {
  const token = getToken()
  if (!token) throw new Error('Meta access_token não configurado')

  const qs = new URLSearchParams({ ...params, access_token: token }).toString()
  const url = `${BASE_URL}/${path}?${qs}`
  const res = await fetch(url, { timeout: 12000 })
  const data = await res.json()

  if (data.error) throw new Error(data.error.message)
  return data
}

// ─── Pixels disponíveis na conta ──────────────────────────────────────────────
async function listPixels() {
  try {
    // Busca via /me/adaccounts para descobrir contas com pixels
    const meData = await metaGet('me', { fields: 'id,name' })
    const adAccountsData = await metaGet('me/adaccounts', {
      fields: 'id,name,business',
      limit: '25',
    })

    const accounts = adAccountsData.data || []
    const pixels = []

    // Para cada ad account, busca pixels vinculados
    await Promise.all(
      accounts.slice(0, 10).map(async (acc) => {
        try {
          const pixelRes = await metaGet(`${acc.id}/adspixels`, {
            fields: 'id,name,last_fired_time,is_unavailable',
          })
          for (const px of pixelRes.data || []) {
            pixels.push({
              id: px.id,
              name: px.name || `Pixel ${px.id}`,
              lastFired: px.last_fired_time || null,
              unavailable: px.is_unavailable || false,
              adAccountId: acc.id,
              adAccountName: acc.name,
            })
          }
        } catch (_) {}
      })
    )

    if (pixels.length === 0) {
      // Fallback: tenta buscar direto pelo pixel_id configurado
      const pixelId = getPixelId()
      if (pixelId) {
        try {
          const px = await metaGet(pixelId, { fields: 'id,name,last_fired_time' })
          pixels.push({
            id: px.id,
            name: px.name || `Pixel ${px.id}`,
            lastFired: px.last_fired_time || null,
            unavailable: false,
          })
        } catch (_) {}
      }
    }

    return { mock: false, pixels }
  } catch (err) {
    console.error('[Meta] listPixels error:', err.message)
    const pixelId = getPixelId() || '702432142505333'
    return {
      mock: true,
      error: err.message,
      pixels: [{ id: pixelId, name: `Pixel ${pixelId}`, lastFired: null, unavailable: false }],
    }
  }
}

// ─── Stats do pixel (qualidade por evento) ────────────────────────────────────
async function getPixelStats() {
  const pixelId = getPixelId()
  if (!pixelId) return { mock: true, ...getMockMeta() }

  try {
    // Busca resumo de qualidade por evento (últimas 24h)
    const data = await metaGet(`${pixelId}/stats`, {
      aggregation: 'event',
      since: Math.floor((Date.now() - 86400000) / 1000).toString(),
      until: Math.floor(Date.now() / 1000).toString(),
    })

    const events = (data.data || []).map((e) => {
      const received = e.count || 0
      const matchRate = e.match_rate_approx
        ? Math.round(e.match_rate_approx * 100)
        : null
      const matched = matchRate !== null ? Math.round(received * (matchRate / 100)) : null
      const quality =
        matchRate === null ? '—'
        : matchRate >= 90 ? 'Excelente'
        : matchRate >= 80 ? 'Alto'
        : matchRate >= 70 ? 'Médio'
        : 'Baixo'
      return {
        name: e.event,
        received,
        matched: matched ?? received,
        matchRate: matchRate ?? 0,
        status: matchRate === null ? 'ok' : matchRate >= 80 ? 'ok' : 'warn',
        quality,
      }
    })

    const avgMatchRate = events.filter(e => e.matchRate > 0).length > 0
      ? Math.round(
          events.filter(e => e.matchRate > 0).reduce((s, e) => s + e.matchRate, 0) /
          events.filter(e => e.matchRate > 0).length
        )
      : 0

    return {
      mock: false,
      pixelId,
      score: avgMatchRate,
      matchRate: avgMatchRate,
      deduplication: null, // calculado separado se CAPI ativo
      events,
    }
  } catch (err) {
    console.error('[Meta] getPixelStats error:', err.message)
    return { mock: true, ...getMockMeta(), error: err.message }
  }
}

// ─── Volume diário (CAPI vs Pixel, últimos N dias) ───────────────────────────
async function getEventVolume(days = 7) {
  const pixelId = getPixelId()
  if (!pixelId) return { mock: true, rows: getMockVolume(days) }

  try {
    const since = Math.floor((Date.now() - days * 86400000) / 1000)
    const until = Math.floor(Date.now() / 1000)

    const data = await metaGet(`${pixelId}/stats`, {
      aggregation: 'day',
      since: since.toString(),
      until: until.toString(),
    })

    const rows = (data.data || []).map((d) => ({
      date: d.time ? new Date(d.time * 1000).toLocaleDateString('pt-BR', { month: '2-digit', day: '2-digit' }) : d.date,
      total: d.count || 0,
      capi: d.server_count || Math.round((d.count || 0) * 0.62),  // fallback heurístico
      pixel: d.browser_count || Math.round((d.count || 0) * 0.38),
    }))

    return { mock: false, rows }
  } catch (err) {
    console.error('[Meta] getEventVolume error:', err.message)
    return { mock: true, rows: getMockVolume(days), error: err.message }
  }
}

// ─── Qualidade por evento (endpoint alternativo) ─────────────────────────────
async function getEventQuality() {
  const pixelId = getPixelId()
  if (!pixelId) return { mock: true, events: getMockMeta().events }

  try {
    // event_stats retorna dados por evento com match_rate_approx
    const data = await metaGet(`${pixelId}/event_stats`, {
      fields: 'event_name,match_rate_approx,count_deduplicated',
    })
    const events = (data.data || []).map((e) => {
      const matchRate = e.match_rate_approx ? Math.round(e.match_rate_approx * 100) : 0
      return {
        name: e.event_name,
        received: e.count_deduplicated || 0,
        matched: Math.round((e.count_deduplicated || 0) * (e.match_rate_approx || 0)),
        matchRate,
        status: matchRate >= 80 ? 'ok' : 'warn',
        quality: matchRate >= 90 ? 'Excelente' : matchRate >= 80 ? 'Alto' : matchRate >= 70 ? 'Médio' : 'Baixo',
      }
    })
    return { mock: false, events }
  } catch (err) {
    return { mock: true, events: getMockMeta().events, error: err.message }
  }
}

// ─── Mock data ────────────────────────────────────────────────────────────────
function getMockMeta() {
  return {
    pixelId: '702432142505333',
    score: 87,
    matchRate: 87,
    deduplication: 94,
    events: [
      { name: 'Purchase',         received: 342,   matched: 298,  matchRate: 87, status: 'ok',   quality: 'Alto' },
      { name: 'Lead',             received: 1820,  matched: 1548, matchRate: 85, status: 'ok',   quality: 'Alto' },
      { name: 'PageView',         received: 48200, matched: 44890, matchRate: 93, status: 'ok',  quality: 'Excelente' },
      { name: 'InitiateCheckout', received: 510,   matched: 420,  matchRate: 82, status: 'warn', quality: 'Médio' },
      { name: 'AddToCart',        received: 890,   matched: 712,  matchRate: 80, status: 'warn', quality: 'Médio' },
    ],
  }
}

function getMockVolume(days = 7) {
  const rows = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const label = d.toLocaleDateString('pt-BR', { month: '2-digit', day: '2-digit' })
    const base = 900 + Math.round(Math.random() * 400)
    rows.push({
      date: label,
      total: base,
      capi: Math.round(base * 0.62),
      pixel: Math.round(base * 0.38),
    })
  }
  return rows
}

module.exports = { getPixelStats, getEventQuality, getEventVolume, listPixels, getMockMeta }
