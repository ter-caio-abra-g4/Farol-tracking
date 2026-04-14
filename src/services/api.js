/**
 * src/services/api.js
 * Cliente HTTP para o servidor Express local (localhost:3001).
 * Todas as chamadas passam por aqui — nunca direto para APIs externas do React.
 */

// Porta dinâmica: o servidor pode ter subido em 3001–3005 se houve conflito
// window.__FAROL_PORT é injetado pelo preload se disponível, senão usa 3001
function getBase() {
  const port = window.__FAROL_PORT || 3001
  return `http://127.0.0.1:${port}`
}

async function get(path, fallback = null, { retries = 1, retryDelay = 800 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${getBase()}${path}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      const isLast = attempt === retries
      if (!isLast) {
        await new Promise((r) => setTimeout(r, retryDelay))
        continue
      }
      console.warn(`[API] GET ${path} falhou após ${attempt + 1} tentativa(s):`, err.message)
      return fallback
    }
  }
}

async function post(path, body) {
  try {
    const res = await fetch(`${getBase()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn(`[API] POST ${path} falhou:`, err.message)
    return null
  }
}

export const api = {
  // Health / setup
  health: () => get('/api/health', { ok: false, configured: false }),
  detectG4OS: () => get('/api/setup/detect', { g4osDetected: false }),
  getConfig: () => get('/api/setup/config', {}),
  saveConfig: (cfg) => post('/api/setup/save', cfg),

  // Credenciais portáteis
  credentialsStatus: () => get('/api/setup/credentials-status', { source: null, syncedAt: null, sourceExists: false }),
  importCredentialsFromPath: (path) => post('/api/setup/import-credentials', { path }),
  importCredentialsInline: (json) => post('/api/setup/import-credentials-inline', json),
  exportCredentials: () => get('/api/setup/export-credentials', null),
  syncCredentials: () => post('/api/setup/sync-credentials', {}),

  // GTM
  gtmContainers: () => get('/api/gtm/containers', { mock: true, containers: [] }),
  gtmContainer: (id) => get(`/api/gtm/container/${id}`, { mock: true, tags: [], triggers: [], variables: [] }),
  gtmSilentTags: () => get('/api/gtm/silent-tags', { mock: true, tags: [] }),
  gtmHealth: () => get('/api/gtm/health', { mock: true, connections: [] }),

  // GA4
  ga4Properties: () => get('/api/ga4/properties', { mock: true, properties: [], activePropertyId: null }),
  ga4SetProperty: (property_id) => post('/api/ga4/property', { property_id }),
  ga4Report: (propertyId, days = 7) => get(`/api/ga4/report/${propertyId}?days=${days}`, { mock: true, rows: [] }),
  ga4Events: (propertyId) => get(`/api/ga4/events/${propertyId}`, { mock: true, events: [] }),
  ga4Dashboards: (propertyId, days = 28) => get(`/api/ga4/dashboards/${propertyId}?days=${days}`, { mock: true }),
  ga4InternalRef: (propertyId, days = 28) => get(`/api/ga4/internal-ref/${propertyId}?days=${days}`, { mock: true, rows: [] }),
  ga4SourceMedium: (propertyId, days = 28) => get(`/api/ga4/source-medium/${propertyId}?days=${days}`, { mock: true, rows: [] }),
  ga4ExitPages: (propertyId, days = 28) => get(`/api/ga4/exit-pages/${propertyId}?days=${days}`, { mock: true, pages: [] }),

  // Databricks
  databricksSetConfig: (cfg) => post('/api/databricks/config', cfg),
  databricksCacheClear: () => post('/api/databricks/cache-clear', {}),
  databricksExecutiveSummary: () => get('/api/databricks/executive-summary', { mock: true }),
  databricksStatus: () => get('/api/databricks/status', { mock: true }),
  databricksTables: () => get('/api/databricks/tables', { mock: true, tables: [] }),
  databricksPreview: (tableName) => get(`/api/databricks/preview?table=${encodeURIComponent(tableName)}`, { mock: true, columns: [], rows: [] }),
  databricksFunnelStages: (days = 30) => get(`/api/databricks/funnel/stages?days=${days}`, { mock: true, stages: [] }),
  databricksFunnelLostReasons: (days = 30) => get(`/api/databricks/funnel/lost-reasons?days=${days}`, { mock: true, reasons: [] }),
  databricksFunnelProducts: (days = 30) => get(`/api/databricks/funnel/products?days=${days}`, { mock: true, products: [] }),
  databricksFunnelTrend: (days = 30) => get(`/api/databricks/funnel/trend?days=${days}`, { mock: true, trend: [] }),
  databricksFunnelFirstClick: (days = 90) => get(`/api/databricks/funnel/first-click?days=${days}`, { mock: true, canais: [] }),
  databricksFunnelOrganicVsPaid: (days = 30) => get(`/api/databricks/funnel/organic-vs-paid?days=${days}`, { mock: true, sources: [], totals: {} }),
  databricksAnomalyAlerts:   ()           => get(`/api/databricks/anomaly-alerts`,                   { mock: true, alerts: [] }),
  databricksSalWonTrend:     (days = 90)  => get(`/api/databricks/sal-won-trend?days=${days}`,        { mock: true, semanas: [] }),
  databricksClosingCohort:   (days = 180) => get(`/api/databricks/closing-cohort?days=${days}`,       { mock: true, cohort: [] }),

  // Comparação GA4 × Meta × CRM
  databricksCompareChannels: (days = 30) => get(`/api/databricks/compare/channels?days=${days}`, { mock: true, channels: [] }),
  databricksCompareMediaROI: (days = 30) => get(`/api/databricks/compare/media-roi?days=${days}`, { mock: true, media: [] }),
  databricksCompareRevenue: (days = 30) => get(`/api/databricks/compare/revenue-by-channel?days=${days}`, { mock: true, channels: [] }),
  databricksCompareProfiles: (days = 30) => get(`/api/databricks/compare/profiles?days=${days}`, { mock: true, profiles: [] }),
  databricksCompareCampaigns: (days = 30) => get(`/api/databricks/compare/campaigns?days=${days}`, { mock: true, campaigns: [] }),
  databricksFormAttribution: (days = 30) => get(`/api/databricks/compare/form-attribution?days=${days}`, { mock: true, rows: [], summary: {} }),

  // Analytics
  analyticsGetTrend:        (days = 90) => get(`/api/databricks/analytics/trend?days=${days}`,            { mock: true, trend: [], projection: [] }),
  analyticsGetJourney:      (days = 30) => get(`/api/databricks/analytics/journey?days=${days}`,           { mock: true, journeys: [], totals: {} }),
  analyticsGetMedia:        (days = 90) => get(`/api/databricks/analytics/media-performance?days=${days}`, { mock: true, weekly: [], totals: [], campaigns: [], projection: [] }),
  analyticsGetOrganic:      (days = 90) => get(`/api/databricks/analytics/organic?days=${days}`, { mock: true }),
  analyticsGetDiscrepancy:  (propertyId, days = 30, event = 'generate_lead') =>
    get(`/api/analytics/discrepancy?propertyId=${propertyId}&days=${days}&event=${encodeURIComponent(event)}`, { mock: true, series: [], summary: {} }),
  funnelQualByCampaign:     (days = 30) => get(`/api/databricks/funnel/qual-by-campaign?days=${days}`, { mock: true, campaigns: [], weeks: [], topCampKeys: [] }),

  // Search Console
  scSites: () => get('/api/searchconsole/sites', { mock: true, sites: [] }),
  scPerformance: (days = 28, site = '') => get(`/api/searchconsole/performance?days=${days}&site=${encodeURIComponent(site)}`, { mock: true }),
  scSetSite: (site_url) => post('/api/searchconsole/config', { site_url }),

  // Meta
  metaPixels: () => get('/api/meta/pixels', { mock: true, pixels: [] }),
  metaStats: () => get('/api/meta/stats', { mock: true }),
  metaEvents: () => get('/api/meta/events', { mock: true, events: [] }),
  metaVolume: (days = 7) => get(`/api/meta/volume?days=${days}`, { mock: true, rows: [] }),
  metaSetToken: (access_token) => post('/api/meta/token', { access_token }),
  metaSetPixel: (pixel_id, pixel_ids) => post('/api/meta/pixel', { pixel_id, pixel_ids }),
  metaAudience: (days = 30) => get(`/api/meta/audience?days=${days}`, { mock: true }),
  metaCreatives: (days = 30) => get(`/api/meta/creatives?days=${days}`, { mock: true, ads: [] }),

  // Live Monitor
  liveGa4:        (propertyId, event = '') => get(`/api/live/ga4?propertyId=${propertyId}${event ? `&event=${encodeURIComponent(event)}` : ''}`, { mock: true }),
  liveMeta:       ()                       => get('/api/live/meta', { mock: true }),
  liveDatabricks: (event = 'generate_lead') => get(`/api/live/databricks?event=${encodeURIComponent(event)}`, { mock: true }),
  liveCrm:        (campaign = '')           => get(`/api/live/crm${campaign ? `?campaign=${encodeURIComponent(campaign)}` : ''}`, { mock: true }),

  // Live History — persistência de sessões entre trocas de tela e reinicializações
  liveSavePoint:   (sessionId, point)  => post('/api/live/history/point', { sessionId, point }),
  liveSessions:    ()                  => get('/api/live/history/sessions', { sessions: [] }),
  liveSession:     (id)                => get(`/api/live/history/session/${encodeURIComponent(id)}`, null),
  liveDeleteSession: (id)              => {
    // DELETE não tem helper — usa fetch direto
    return fetch(`${getBase()}/api/live/history/session/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .then(r => r.json()).catch(() => null)
  },
}
