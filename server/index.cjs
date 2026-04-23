/**
 * server/index.js
 * Servidor Express local do Farol Tracking — porta 3001.
 * Sobe junto com o Electron. NÃO afeta nenhum arquivo do G4 OS.
 */

const express = require('express')
const cors = require('cors')
const path = require('path')
const {
  loadConfig, saveConfig, detectG4OS, importFromG4OS,
  exportCredentials, importCredentials, syncCredentialsIfNewer,
  CONFIG_PATH,
} = require('./config.cjs')
const gtmService = require('./gtm.cjs')
const ga4Service = require('./ga4.cjs')
const metaService = require('./meta.cjs')
const databricksService = require('./databricks.cjs')
const scService = require('./searchconsole.cjs')

const app = express()
const PORT = 3001

app.use(cors({ origin: ['http://localhost:5175', 'file://'] }))
app.use(express.json())

// Sincroniza credenciais externas na inicialização (não-bloqueante)
syncCredentialsIfNewer()

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

// ─── Credenciais portáteis ─────────────────────────────────────────────────

// GET status das credenciais externas
app.get('/api/setup/credentials-status', (req, res) => {
  try {
    const cfg = loadConfig()
    const source = cfg._credentials_source || null
    const syncedAt = cfg._credentials_synced_at || null
    let sourceExists = false
    let sourceMtime = null
    if (source) {
      const fs = require('fs')
      try { sourceExists = fs.existsSync(source); if (sourceExists) sourceMtime = fs.statSync(source).mtime } catch (_) {}
    }
    res.json({ source, syncedAt, sourceExists, sourceMtime, configPath: CONFIG_PATH })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST importar de caminho no disco
app.post('/api/setup/import-credentials', (req, res) => {
  try {
    const { path: credPath } = req.body
    if (!credPath) return res.status(400).json({ ok: false, error: 'Caminho não informado' })
    const result = importCredentials(credPath)
    res.json(result)
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

// POST importar conteúdo JSON diretamente (upload via UI — sem caminho no disco)
app.post('/api/setup/import-credentials-inline', (req, res) => {
  try {
    const creds = req.body
    if (!creds._farol_credentials) return res.status(400).json({ ok: false, error: 'Arquivo inválido — não é um farol.credentials.json' })
    const fs = require('fs')
    const os = require('os')
    const tmpPath = require('path').join(os.tmpdir(), 'farol-imported.credentials.json')
    fs.writeFileSync(tmpPath, JSON.stringify(creds, null, 2), 'utf8')
    const result = importCredentials(tmpPath)
    res.json(result)
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

// GET exportar credenciais como JSON para download
app.get('/api/setup/export-credentials', (req, res) => {
  try {
    const os = require('os')
    const tmpPath = require('path').join(os.tmpdir(), 'farol.credentials.json')
    const creds = exportCredentials(tmpPath)
    res.setHeader('Content-Disposition', 'attachment; filename="farol.credentials.json"')
    res.setHeader('Content-Type', 'application/json')
    res.json(creds)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST forçar sync manual do arquivo externo
app.post('/api/setup/sync-credentials', (req, res) => {
  try {
    const cfg = loadConfig()
    const source = cfg._credentials_source
    if (!source) return res.status(400).json({ ok: false, error: 'Nenhum arquivo de credenciais configurado' })
    const result = importCredentials(source)
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
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

app.get('/api/ga4/exit-pages/:propertyId', async (req, res) => {
  const days = parseInt(req.query.days) || 28
  try {
    const result = await ga4Service.getExitPages(req.params.propertyId, days)
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, pages: [] })
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

app.get('/api/gtm/health', async (req, res) => {
  try {
    const result = await gtmService.getConnectionHealth()
    res.json(result)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, connections: [] })
  }
})

app.get('/api/gtm/diag/tag-types', async (req, res) => {
  try {
    const result = await gtmService.getTagTypesDiag()
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
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

app.get('/api/databricks/diagnose', async (req, res) => {
  try {
    const result = await databricksService.diagnose()
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
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

app.get('/api/databricks/analytics/organic', async (req, res) => {
  const days = parseInt(req.query.days) || 90
  try { res.json(await databricksService.getOrganicAttribution(days)) }
  catch (err) { res.status(500).json({ mock: true, error: err.message }) }
})

app.get('/api/databricks/funnel/first-click', async (req, res) => {
  const days = parseInt(req.query.days) || 90
  try { res.json(await databricksService.getFirstClickFunnel(days)) }
  catch (err) { res.status(500).json({ mock: true, error: err.message, canais: [] }) }
})

app.get('/api/databricks/anomaly-alerts', async (req, res) => {
  try { res.json(await databricksService.getAnomalyAlerts()) }
  catch (err) { res.status(500).json({ mock: true, error: err.message, alerts: [] }) }
})

app.get('/api/databricks/sal-won-trend', async (req, res) => {
  const days = parseInt(req.query.days) || 90
  try { res.json(await databricksService.getSalWonTrend(days)) }
  catch (err) { res.status(500).json({ mock: true, error: err.message, semanas: [] }) }
})

app.get('/api/databricks/closing-cohort', async (req, res) => {
  const days = parseInt(req.query.days) || 180
  try { res.json(await databricksService.getClosingCohort(days)) }
  catch (err) { res.status(500).json({ mock: true, error: err.message, cohort: [] }) }
})

// ─── Discrepância GA4 vs Databricks ─────────────────────────────────────────
// Série diária: GA4 event count vs Databricks MQL count, divergência %
app.get('/api/analytics/discrepancy', async (req, res) => {
  const days       = parseInt(req.query.days) || 30
  const propertyId = req.query.propertyId     || null
  const event      = req.query.event          || 'generate_lead'
  if (!propertyId) return res.status(400).json({ error: 'propertyId obrigatório' })
  try {
    const [ga4Raw, dbRaw] = await Promise.all([
      ga4Service.runReport(propertyId, days),
      databricksService.getFunnelTrend(days),
    ])
    const isMock = (ga4Raw.mock ?? true) || (dbRaw.mock ?? true)

    // GA4: filtra pelo evento e agrupa por dia (YYYYMMDD → count)
    const ga4ByDay = {}
    ;(ga4Raw.rows || []).filter(r => r.event === event).forEach(r => {
      ga4ByDay[r.date] = (ga4ByDay[r.date] || 0) + r.count
    })

    // Databricks: usa MQLs do funil como proxy de generate_lead
    const dbByDay = {}
    ;(dbRaw.trend || []).forEach(r => {
      const d = (r.dia || '').replace(/-/g, '')
      dbByDay[d] = r.mqls || 0
    })

    const allDays = [...new Set([...Object.keys(ga4ByDay), ...Object.keys(dbByDay)])].sort()
    const series = allDays.map(d => {
      const ga4  = ga4ByDay[d] || 0
      const db   = dbByDay[d]  || 0
      const diff = ga4 - db
      const pct  = ga4 > 0 ? parseFloat(((Math.abs(diff) / ga4) * 100).toFixed(1)) : null
      const label = d.length === 8 ? `${d.slice(6)}/${d.slice(4,6)}` : d
      return { dia: label, ga4, db, diff, pct_divergencia: pct }
    })

    const totalGa4 = series.reduce((s, r) => s + r.ga4, 0)
    const totalDb  = series.reduce((s, r) => s + r.db,  0)
    const avgDivPct = totalGa4 > 0
      ? parseFloat(((Math.abs(totalGa4 - totalDb) / totalGa4) * 100).toFixed(1))
      : null
    const worstDay = series.length
      ? series.reduce((w, r) => (r.pct_divergencia ?? 0) > (w.pct_divergencia ?? 0) ? r : w, series[0])
      : null

    res.json({ mock: isMock, days, event, series, summary: { totalGa4, totalDb, avgDivPct, worstDay } })
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, series: [], summary: {} })
  }
})

// ─── Triangulação GA4 × Meta × CRM ────────────────────────────────────────────
// Compara generate_lead (GA4) · Lead pixel (Meta) · MQL (Databricks) por dia.
// Calcula divergência entre os 3 e emite um score de saúde por dia.
app.get('/api/analytics/triangulation', async (req, res) => {
  const days       = parseInt(req.query.days) || 30
  const propertyId = req.query.propertyId     || null
  const event      = req.query.event          || 'generate_lead'
  if (!propertyId) return res.status(400).json({ error: 'propertyId obrigatório' })

  try {
    const [ga4Raw, metaRaw, dbRaw] = await Promise.all([
      ga4Service.runReport(propertyId, days),
      metaService.getLeadsByDay(days),
      databricksService.getFunnelTrend(days),
    ])
    const isMock = (ga4Raw.mock ?? true) || (metaRaw.mock ?? true) || (dbRaw.mock ?? true)

    // GA4: filtra pelo evento e agrupa por dia (YYYYMMDD → count)
    const ga4ByDay = {}
    ;(ga4Raw.rows || []).filter(r => r.event === event).forEach(r => {
      ga4ByDay[r.date] = (ga4ByDay[r.date] || 0) + r.count
    })

    // Meta: leads por dia — converte DD/MM → YYYYMMDD para alinhar com GA4
    const metaByDay = {}
    const curYear = new Date().getFullYear()
    ;(metaRaw.rows || []).forEach(r => {
      const [dd, mm] = r.date.split('/')
      const d = new Date(curYear, parseInt(mm) - 1, parseInt(dd))
      const key = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
      metaByDay[key] = (r.leads || 0)
    })

    // Databricks: MQLs do funil por dia
    const dbByDay = {}
    ;(dbRaw.trend || []).forEach(r => {
      const d = (r.dia || '').replace(/-/g, '')
      dbByDay[d] = r.mqls || 0
    })

    const allDays = [...new Set([
      ...Object.keys(ga4ByDay),
      ...Object.keys(metaByDay),
      ...Object.keys(dbByDay),
    ])].sort()

    const series = allDays.map(d => {
      const ga4  = ga4ByDay[d]  || 0
      const meta = metaByDay[d] || 0
      const db   = dbByDay[d]   || 0
      const label = d.length === 8 ? `${d.slice(6)}/${d.slice(4,6)}` : d

      // Divergência % entre pares (base = ga4 ou meta para Meta×DB)
      const divGa4Meta = ga4 > 0 ? parseFloat(((Math.abs(ga4 - meta) / ga4) * 100).toFixed(1)) : null
      const divGa4Db   = ga4 > 0 ? parseFloat(((Math.abs(ga4 - db)   / ga4) * 100).toFixed(1)) : null
      const divMetaDb  = meta > 0 ? parseFloat(((Math.abs(meta - db)  / meta) * 100).toFixed(1)) : null

      // Score por dia: ok < 20% | warning < 50% | critical ≥ 50%
      const maxDiv = Math.max(divGa4Meta ?? 0, divGa4Db ?? 0, divMetaDb ?? 0)
      const score  = maxDiv < 20 ? 'ok' : maxDiv < 50 ? 'warning' : 'critical'

      return { dia: label, ga4, meta, db, divGa4Meta, divGa4Db, divMetaDb, score }
    })

    // Resumo agregado
    const avg = arr => arr.length ? parseFloat((arr.reduce((s,v) => s + v, 0) / arr.length).toFixed(1)) : null
    const summary = {
      avgDivGa4Meta: avg(series.filter(r => r.divGa4Meta !== null).map(r => r.divGa4Meta)),
      avgDivGa4Db:   avg(series.filter(r => r.divGa4Db   !== null).map(r => r.divGa4Db)),
      avgDivMetaDb:  avg(series.filter(r => r.divMetaDb  !== null).map(r => r.divMetaDb)),
      okDays:       series.filter(r => r.score === 'ok').length,
      warnDays:     series.filter(r => r.score === 'warning').length,
      critDays:     series.filter(r => r.score === 'critical').length,
      healthScore:  series.length > 0
        ? Math.round((series.filter(r => r.score === 'ok').length / series.length) * 100)
        : null,
    }

    res.json({ mock: isMock, days, event, series, summary })
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, series: [], summary: {} })
  }
})

// ─── Qualificação histórica por campanha ─────────────────────────────────────
app.get('/api/databricks/funnel/qual-by-campaign', async (req, res) => {
  const days = parseInt(req.query.days) || 30
  try { res.json(await databricksService.getQualByCampaign(days)) }
  catch (err) { res.status(500).json({ mock: true, error: err.message, campaigns: [], weeks: [] }) }
})

// ─── Start ─────────────────────────────────────────────────────────────────
// ─── Search Console ────────────────────────────────────────────────────────
app.get('/api/searchconsole/sites', async (req, res) => {
  try {
    res.json(await scService.listSites())
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, sites: [] })
  }
})

app.post('/api/searchconsole/config', (req, res) => {
  const { site_url } = req.body || {}
  if (!site_url) return res.status(400).json({ error: 'site_url obrigatório' })
  const cfg = loadConfig()
  cfg.searchconsole = { ...(cfg.searchconsole || {}), site_url: site_url.trim() }
  saveConfig(cfg)
  res.json({ ok: true, site_url: cfg.searchconsole.site_url })
})

app.get('/api/searchconsole/performance', async (req, res) => {
  const days    = parseInt(req.query.days) || 28
  const siteUrl = req.query.site || loadConfig().searchconsole?.site_url || 'sc-domain:g4business.com'
  try {
    res.json(await scService.getPerformance(siteUrl, days))
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message })
  }
})

// ─── Live Monitor ───────────────────────────────────────────────────────────

// GA4 Realtime — últimos 30 min (~1 min latência)
app.get('/api/live/ga4', async (req, res) => {
  const { propertyId, event } = req.query
  if (!propertyId) return res.status(400).json({ error: 'propertyId obrigatório' })
  try {
    res.json(await ga4Service.getRealtimeReport(propertyId, event || null))
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message })
  }
})

// Meta hoje — spend + leads do dia atual (~15 min latência)
// ?account=act_XXX para filtrar por conta específica; omitir = todas consolidadas
app.get('/api/live/meta', async (req, res) => {
  try {
    const account = req.query.account || null
    res.json(await metaService.getLiveMetaToday(account))
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message })
  }
})

// Databricks — eventos recentes (latência depende do pipeline ETL)
app.get('/api/live/databricks', async (req, res) => {
  const { event } = req.query
  try {
    const eventName = event || 'generate_lead'
    const data = await databricksService.runLiveQuery(eventName)
    res.json(data)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, latencyNote: 'Pipeline ETL — latência variável' })
  }
})

// CRM ao vivo — leads + qualificados de hoje por campanha
app.get('/api/live/crm', async (req, res) => {
  try {
    const { campaign } = req.query
    const data = await databricksService.runLiveCRM(campaign || null)
    res.json(data)
  } catch (err) {
    res.status(500).json({ mock: true, error: err.message, latencyNote: 'CRM via Databricks — latência pipeline 5-30 min' })
  }
})

// ─── Live History ────────────────────────────────────────────────────────────
// Persiste sessões de monitoramento em live-sessions.json no userData
const fs = require('fs')
const USER_DATA = process.env.FAROL_USER_DATA || path.join(__dirname, '..')
const LIVE_SESSIONS_PATH = path.join(USER_DATA, 'live-sessions.json')

const LIVE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 dias

function readSessions() {
  try {
    if (!fs.existsSync(LIVE_SESSIONS_PATH)) return {}
    return JSON.parse(fs.readFileSync(LIVE_SESSIONS_PATH, 'utf8'))
  } catch { return {} }
}

function writeSessions(data) {
  try { fs.writeFileSync(LIVE_SESSIONS_PATH, JSON.stringify(data, null, 2), 'utf8') } catch (_) {}
}

// Remove sessões mais antigas que 30 dias (chamado a cada gravação)
function pruneOldSessions(sessions) {
  const cutoff = Date.now() - LIVE_SESSION_TTL_MS
  for (const id of Object.keys(sessions)) {
    const created = new Date(sessions[id].createdAt).getTime()
    if (created < cutoff) delete sessions[id]
  }
  return sessions
}

// POST /api/live/history/point — salva um ponto na sessão ativa
app.post('/api/live/history/point', (req, res) => {
  const { sessionId, point } = req.body
  if (!sessionId || !point) return res.status(400).json({ error: 'sessionId e point obrigatórios' })
  const sessions = readSessions()
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      eventFilter: point.eventFilter || '',
      points: [],
    }
  }
  sessions[sessionId].points.push({ ...point, savedAt: new Date().toISOString() })
  sessions[sessionId].updatedAt = new Date().toISOString()
  // Mantém no máximo 1440 pontos por sessão (~12h em polling de 30s)
  if (sessions[sessionId].points.length > 1440) {
    sessions[sessionId].points = sessions[sessionId].points.slice(-1440)
  }
  writeSessions(pruneOldSessions(sessions))
  res.json({ ok: true, total: sessions[sessionId].points.length })
})

// GET /api/live/history/sessions — lista todas as sessões (metadados, sem points)
app.get('/api/live/history/sessions', (req, res) => {
  const sessions = readSessions()
  const list = Object.values(sessions)
    .map(({ id, createdAt, updatedAt, eventFilter, points }) => ({
      id, createdAt, updatedAt, eventFilter,
      pointCount: points?.length || 0,
      firstPoint: points?.[0]?.time || null,
      lastPoint:  points?.[points.length - 1]?.time || null,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  res.json({ sessions: list })
})

// GET /api/live/history/session/:id — retorna todos os points de uma sessão
app.get('/api/live/history/session/:id', (req, res) => {
  const sessions = readSessions()
  const session = sessions[req.params.id]
  if (!session) return res.status(404).json({ error: 'Sessão não encontrada' })
  res.json(session)
})

// DELETE /api/live/history/session/:id — remove uma sessão
app.delete('/api/live/history/session/:id', (req, res) => {
  const sessions = readSessions()
  if (!sessions[req.params.id]) return res.status(404).json({ error: 'Sessão não encontrada' })
  delete sessions[req.params.id]
  writeSessions(sessions)
  res.json({ ok: true })
})

// ─── Error handler global ───────────────────────────────────────────────────
// Captura qualquer erro não tratado nas rotas e devolve JSON em vez de crash
app.use((err, req, res, _next) => {
  console.error(`[Farol API] Erro não tratado em ${req.method} ${req.path}:`, err.message)
  res.status(500).json({ mock: true, error: err.message || 'Erro interno do servidor' })
})

// Handler para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` })
})

function startServer(port = PORT, attempt = 0) {
  return new Promise((resolve, reject) => {
    if (attempt > 4) {
      return reject(new Error(`Não foi possível encontrar uma porta livre após ${attempt} tentativas (${PORT}–${PORT + attempt - 1})`))
    }
    const server = app.listen(port, '127.0.0.1', () => {
      if (port !== PORT) {
        console.warn(`[Farol API] Porta ${PORT} ocupada — usando ${port}`)
      } else {
        console.log(`[Farol API] Rodando em http://127.0.0.1:${port}`)
      }
      // Informa o renderer qual porta foi usada (via env, lida pelo api.js)
      process.env.FAROL_PORT = String(port)
      // Auto-importar credenciais do G4 OS na primeira vez
      try { importFromG4OS() } catch (_) {}
      resolve(server)
    })
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Porta ocupada — tenta a próxima
        server.close()
        startServer(port + 1, attempt + 1).then(resolve).catch(reject)
      } else {
        reject(err)
      }
    })
  })
}

module.exports = { startServer, app }
