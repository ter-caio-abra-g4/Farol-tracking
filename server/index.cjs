/**
 * server/index.js
 * Servidor Express local do Farol Tracking — porta 3001.
 * Sobe junto com o Electron. NÃO afeta nenhum arquivo do G4 OS.
 */

const express = require('express')
const cors = require('cors')
const path = require('path')
const { loadConfig, saveConfig, detectG4OS, importFromG4OS, CONFIG_PATH } = require('./config.cjs')
const gtmService = require('./gtm.cjs')
const ga4Service = require('./ga4.cjs')
const metaService = require('./meta.cjs')
const databricksService = require('./databricks.cjs')

const app = express()
const PORT = 3001

app.use(cors({ origin: ['http://localhost:5175', 'file://'] }))
app.use(express.json())

// ─── Health ────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const cfg = loadConfig()
  const g4 = detectG4OS()
  res.json({
    ok: true,
    configured: !!(cfg.meta?.access_token || cfg.ga4?.service_account_path),
    g4osDetected: g4.available,
    configPath: CONFIG_PATH,
  })
})

// ─── Setup ─────────────────────────────────────────────────────────────────
app.get('/api/setup/detect', (req, res) => {
  const result = importFromG4OS()
  const g4 = detectG4OS()
  res.json({
    g4osDetected: g4.available,
    ga4ServiceAccount: g4.ga4ServiceAccountPath,
    gtmReady: g4.gtmOAuthReady,
    imported: result.imported,
  })
})

app.post('/api/setup/save', (req, res) => {
  try {
    const current = loadConfig()
    const updated = {
      ...current,
      ...req.body,
      ga4: { ...current.ga4, ...req.body.ga4 },
      meta: { ...current.meta, ...req.body.meta },
      gtm: { ...current.gtm, ...req.body.gtm },
    }
    saveConfig(updated)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.get('/api/setup/config', (req, res) => {
  const cfg = loadConfig()
  // Retorna config mascarando token completo
  const safe = {
    ...cfg,
    meta: cfg.meta ? {
      ...cfg.meta,
      access_token: cfg.meta.access_token
        ? cfg.meta.access_token.substring(0, 8) + '...' + cfg.meta.access_token.slice(-4)
        : null,
    } : {},
  }
  res.json(safe)
})

// ─── GTM ───────────────────────────────────────────────────────────────────
app.get('/api/gtm/containers', async (req, res) => {
  try {
    const result = await gtmService.listContainersWithStats()
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, containers: [] })
  }
})

app.get('/api/gtm/container/:publicId', async (req, res) => {
  try {
    const result = await gtmService.getContainerDetails(req.params.publicId)
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, tags: [], triggers: [], variables: [] })
  }
})

// ─── GA4 ───────────────────────────────────────────────────────────────────
app.get('/api/ga4/properties', async (req, res) => {
  try {
    const result = await ga4Service.listProperties()
    const cfg = loadConfig()
    res.json({ ...result, activePropertyId: cfg.ga4?.property_id || null })
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, properties: [] })
  }
})

app.post('/api/ga4/property', (req, res) => {
  try {
    const { property_id } = req.body
    if (!property_id) return res.status(400).json({ ok: false, error: 'property_id obrigatório' })
    const current = loadConfig()
    saveConfig({ ...current, ga4: { ...current.ga4, property_id } })
    res.json({ ok: true, property_id })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.get('/api/ga4/report/:propertyId', async (req, res) => {
  const days = parseInt(req.query.days) || 7
  try {
    const result = await ga4Service.runReport(req.params.propertyId, days)
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message })
  }
})

app.get('/api/ga4/events/:propertyId', async (req, res) => {
  try {
    const result = await ga4Service.getEventSummary(req.params.propertyId)
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, events: [] })
  }
})

app.get('/api/ga4/dashboards/:propertyId', async (req, res) => {
  const days = parseInt(req.query.days) || 28
  try {
    const result = await ga4Service.getDashboards(req.params.propertyId, days)
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message })
  }
})

app.get('/api/ga4/internal-ref/:propertyId', async (req, res) => {
  const days = parseInt(req.query.days) || 28
  try {
    const result = await ga4Service.getInternalRefReport(req.params.propertyId, days)
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, rows: [] })
  }
})

app.get('/api/ga4/source-medium/:propertyId', async (req, res) => {
  const days = parseInt(req.query.days) || 28
  try {
    const result = await ga4Service.getSourceMediumReport(req.params.propertyId, days)
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, rows: [] })
  }
})

app.get('/api/gtm/silent-tags', async (req, res) => {
  try {
    const result = await gtmService.getSilentTags()
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, tags: [] })
  }
})

// ─── Meta ──────────────────────────────────────────────────────────────────
app.get('/api/meta/pixels', async (req, res) => {
  try {
    const result = await metaService.listPixels()
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, pixels: [] })
  }
})

app.get('/api/meta/stats', async (req, res) => {
  try {
    const result = await metaService.getPixelStats()
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message })
  }
})

app.get('/api/meta/events', async (req, res) => {
  try {
    const result = await metaService.getEventQuality()
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, events: [] })
  }
})

app.get('/api/meta/volume', async (req, res) => {
  const days = parseInt(req.query.days) || 7
  try {
    const result = await metaService.getEventVolume(days)
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, rows: [] })
  }
})

app.get('/api/meta/audience', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  try {
    const result = await metaService.getAudienceInsights(days)
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message })
  }
})

app.get('/api/meta/creatives', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  try {
    const result = await metaService.getAdCreativeInsights(days)
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message })
  }
})

app.post('/api/meta/token', (req, res) => {
  try {
    const { access_token } = req.body
    if (!access_token) return res.status(400).json({ ok: false, error: 'access_token obrigatório' })
    const current = loadConfig()
    saveConfig({ ...current, meta: { ...current.meta, access_token } })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.post('/api/meta/pixel', (req, res) => {
  try {
    const { pixel_id, pixel_ids } = req.body
    if (!pixel_id) return res.status(400).json({ ok: false, error: 'pixel_id obrigatório' })
    const current = loadConfig()
    saveConfig({
      ...current,
      meta: {
        ...current.meta,
        pixel_id,
        pixel_ids: pixel_ids || [pixel_id],
      },
    })
    res.json({ ok: true, pixel_id })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ─── Databricks ────────────────────────────────────────────────────────────
app.post('/api/databricks/config', (req, res) => {
  try {
    const { host, http_path, token, catalog, schema } = req.body
    if (!host || !http_path || !token) {
      return res.status(400).json({ ok: false, error: 'host, http_path e token são obrigatórios' })
    }
    const current = loadConfig()
    saveConfig({
      ...current,
      databricks: {
        ...current.databricks,
        host,
        http_path,
        token,
        ...(catalog && { catalog }),
        ...(schema && { schema }),
        token_created_at: new Date().toISOString(),
      },
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.get('/api/databricks/status', async (req, res) => {
  try {
    const result = await databricksService.getStatus()
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message })
  }
})

app.get('/api/databricks/tables', async (req, res) => {
  try {
    const result = await databricksService.listTables()
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, tables: [] })
  }
})

app.get('/api/databricks/preview', async (req, res) => {
  const tableName = req.query.table
  try {
    const result = await databricksService.previewTable(tableName)
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, columns: [], rows: [] })
  }
})

app.get('/api/databricks/funnel/stages', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  try {
    const result = await databricksService.getFunnelStages(days)
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, stages: [] })
  }
})

app.get('/api/databricks/funnel/lost-reasons', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  try {
    const result = await databricksService.getLostReasons(days)
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, reasons: [] })
  }
})

app.get('/api/databricks/funnel/products', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  try {
    const result = await databricksService.getTopProducts(days)
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, products: [] })
  }
})

app.get('/api/databricks/funnel/trend', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  try {
    const result = await databricksService.getFunnelTrend(days)
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, trend: [] })
  }
})

app.get('/api/databricks/executive-summary', async (req, res) => {
  try { res.json(await databricksService.getExecutiveSummary()) }
  catch (err) { res.status(500).json({ mock: true, error: err.message }) }
})

// Invalida todo o cache Databricks (chamado pelo botão Refresh do front)
app.post('/api/databricks/cache-clear', (req, res) => {
  databricksService.clearCache()
  res.json({ ok: true, ts: Date.now() })
})

app.get('/api/databricks/funnel/organic-vs-paid', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  try { res.json(await databricksService.getOrganicVsPaid(days)) }
  catch (err) { res.status(500).json({ mock: true, error: err.message, sources: [], totals: {} }) }
})

// ─── Comparação GA4 × Meta × CRM ──────────────────────────────────────────
app.get('/api/databricks/compare/channels', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  try { res.json(await databricksService.getCompareByChannel(days)) }
  catch (err) { res.status(500).json({ mock: true, error: err.message, channels: [] }) }
})

app.get('/api/databricks/compare/media-roi', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  try { res.json(await databricksService.getMediaROI(days)) }
  catch (err) { res.status(500).json({ mock: true, error: err.message, media: [] }) }
})

app.get('/api/databricks/compare/revenue-by-channel', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  try { res.json(await databricksService.getRevenueByChannel(days)) }
  catch (err) { res.status(500).json({ mock: true, error: err.message, channels: [] }) }
})

app.get('/api/databricks/compare/profiles', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  try { res.json(await databricksService.getConversionByProfile(days)) }
  catch (err) { res.status(500).json({ mock: true, error: err.message, profiles: [] }) }
})

app.get('/api/databricks/compare/campaigns', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  try { res.json(await databricksService.getTopCampaigns(days)) }
  catch (err) { res.status(500).json({ mock: true, error: err.message, campaigns: [] }) }
})

app.get('/api/databricks/compare/form-attribution', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  try { res.json(await databricksService.getFormAttribution(days)) }
  catch (err) { res.status(500).json({ mock: true, error: err.message, rows: [], summary: {} }) }
})

// ─── Analytics ─────────────────────────────────────────────────────────────
app.get('/api/databricks/analytics/trend', async (req, res) => {
  const days = parseInt(req.query.days) || 90
  try { res.json(await databricksService.getAnalyticsTrend(days)) }
  catch (err) { res.status(500).json({ mock: true, error: err.message, trend: [], projection: [] }) }
})

app.get('/api/databricks/analytics/journey', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  try { res.json(await databricksService.getJourneyAttribution(days)) }
  catch (err) { res.status(500).json({ mock: true, error: err.message, journeys: [], totals: {} }) }
})

app.get('/api/databricks/analytics/media-performance', async (req, res) => {
  const days = parseInt(req.query.days) || 90
  try { res.json(await databricksService.getMediaPerformance(days)) }
  catch (err) { res.status(500).json({ mock: true, error: err.message, weekly: [], totals: [], campaigns: [], projection: [] }) }
})

// ─── Start ─────────────────────────────────────────────────────────────────
function startServer() {
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, '127.0.0.1', () => {
      console.log(`[Farol API] Rodando em http://127.0.0.1:${PORT}`)
      // Auto-importar credenciais do G4 OS na primeira vez
      try { importFromG4OS() } catch (_) {}
      resolve(server)
    })
    server.on('error', reject)
  })
}

module.exports = { startServer, app }
