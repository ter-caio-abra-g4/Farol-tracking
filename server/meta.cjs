/**
 * server/meta.js
 * Rotas Meta — usa access_token do farol.config.json (Graph API REST).
 */

const fetch = require('node-fetch')
const { loadConfig } = require('./config.cjs')

const BASE_URL = 'https://graph.facebook.com/v19.0'

function getToken() {
  const cfg = loadConfig()
  return cfg.meta?.access_token || null
}

function getPixelId() {
  const cfg = loadConfig()
  return cfg.meta?.pixel_id || '702432142505333'
}

async function metaGet(path, params = {}) {
  const token = getToken()
  if (!token) throw new Error('Meta access_token não configurado')

  const qs = new URLSearchParams({ ...params, access_token: token }).toString()
  const url = `${BASE_URL}/${path}?${qs}`
  const res = await fetch(url, { timeout: 10000 })
  const data = await res.json()

  if (data.error) throw new Error(data.error.message)
  return data
}

async function getPixelStats() {
  const pixelId = getPixelId()
  try {
    const data = await metaGet(`${pixelId}/stats`, {
      aggregation: 'event',
      since: Math.floor((Date.now() - 86400000) / 1000).toString(),
      until: Math.floor(Date.now() / 1000).toString(),
    })

    const events = (data.data || []).map((e) => {
      const received = e.count || 0
      const matched = Math.round(received * (e.match_rate_approx || 0.87))
      const matchRate = e.match_rate_approx
        ? Math.round(e.match_rate_approx * 100)
        : 87
      return {
        name: e.event,
        received,
        matched,
        matchRate,
        status: matchRate >= 80 ? 'ok' : 'warn',
        quality: matchRate >= 90 ? 'Excelente' : matchRate >= 80 ? 'Alto' : matchRate >= 70 ? 'Medio' : 'Baixo',
      }
    })

    const avgMatchRate = events.length > 0
      ? Math.round(events.reduce((s, e) => s + e.matchRate, 0) / events.length)
      : 0

    return {
      mock: false,
      pixelId,
      score: avgMatchRate,
      matchRate: avgMatchRate,
      events,
    }
  } catch (err) {
    console.error('[Meta] getPixelStats error:', err.message)
    return { mock: true, ...getMockMeta(), error: err.message }
  }
}

async function getEventQuality() {
  const pixelId = getPixelId()
  try {
    const data = await metaGet(`${pixelId}/event_stats`, {
      fields: 'event_name,match_rate_approx,count_deduplicated',
    })
    return { mock: false, events: data.data || [] }
  } catch (err) {
    return { mock: true, events: getMockMeta().events, error: err.message }
  }
}

function getMockMeta() {
  return {
    pixelId: '702432142505333',
    score: 87,
    matchRate: 87,
    deduplication: 94,
    events: [
      { name: 'Purchase', received: 342, matched: 298, matchRate: 87, status: 'ok', quality: 'Alto' },
      { name: 'Lead', received: 1820, matched: 1548, matchRate: 85, status: 'ok', quality: 'Alto' },
      { name: 'PageView', received: 48200, matched: 44890, matchRate: 93, status: 'ok', quality: 'Excelente' },
      { name: 'InitiateCheckout', received: 510, matched: 420, matchRate: 82, status: 'warn', quality: 'Medio' },
      { name: 'AddToCart', received: 890, matched: 712, matchRate: 80, status: 'warn', quality: 'Medio' },
    ],
  }
}

module.exports = { getPixelStats, getEventQuality, getMockMeta }
