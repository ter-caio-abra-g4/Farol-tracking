/**
 * src/services/api.js
 * Cliente HTTP para o servidor Express local (localhost:3001).
 * Todas as chamadas passam por aqui — nunca direto para APIs externas do React.
 */

const BASE = 'http://127.0.0.1:3001'

async function get(path, fallback = null) {
  try {
    const res = await fetch(`${BASE}${path}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`[API] GET ${path} falhou:`, err.message)
    return fallback
  }
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return await res.json()
}

export const api = {
  // Health / setup
  health: () => get('/api/health', { ok: false, configured: false }),
  detectG4OS: () => get('/api/setup/detect', { g4osDetected: false }),
  getConfig: () => get('/api/setup/config', {}),
  saveConfig: (cfg) => post('/api/setup/save', cfg),

  // GTM
  gtmContainers: () => get('/api/gtm/containers', { mock: true, containers: [] }),
  gtmContainer: (id) => get(`/api/gtm/container/${id}`, { mock: true, tags: [], triggers: [], variables: [] }),

  // GA4
  ga4Properties: () => get('/api/ga4/properties', { mock: true, properties: [], activePropertyId: null }),
  ga4SetProperty: (property_id) => post('/api/ga4/property', { property_id }),
  ga4Report: (propertyId, days = 7) => get(`/api/ga4/report/${propertyId}?days=${days}`, { mock: true, rows: [] }),
  ga4Events: (propertyId) => get(`/api/ga4/events/${propertyId}`, { mock: true, events: [] }),
  ga4Dashboards: (propertyId, days = 28) => get(`/api/ga4/dashboards/${propertyId}?days=${days}`, { mock: true }),

  // Meta
  metaStats: () => get('/api/meta/stats', { mock: true }),
  metaEvents: () => get('/api/meta/events', { mock: true, events: [] }),
}
