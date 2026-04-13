/**
 * server/searchconsole.cjs
 * Google Search Console via googleapis — mesmo service account do GA4.
 * Requer que o e-mail do service account seja adicionado como usuário
 * na propriedade do Search Console (permissão Restrita é suficiente).
 */

const { google } = require('googleapis')
const { loadConfig } = require('./config.cjs')
const path = require('path')
const os   = require('os')

const G4OS_SA_PATH = path.join(
  os.homedir(),
  '.g4os-public', 'workspaces', 'my-workspace',
  'sources', 'ga4', 'service-account.json'
)

async function getAuthClient() {
  const cfg = loadConfig()
  const saPath = cfg.ga4?.service_account_path || G4OS_SA_PATH

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: saPath,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    })
    return await auth.getClient()
  } catch (_) {}

  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    })
    return await auth.getClient()
  } catch (_) {}

  return null
}

/**
 * Lista as propriedades do Search Console acessíveis pelo service account.
 */
async function listSites() {
  const auth = await getAuthClient()
  if (!auth) return { mock: true, sites: getMockSites() }

  try {
    const sc = google.searchconsole({ version: 'v1', auth })
    const res = await sc.sites.list()
    const sites = (res.data.siteEntry || []).map(s => ({
      url: s.siteUrl,
      permissionLevel: s.permissionLevel,
    }))
    return { mock: false, sites }
  } catch (err) {
    console.error('[GSC] listSites error:', err.message)
    return { mock: true, sites: getMockSites(), error: err.message }
  }
}

/**
 * Retorna dados de performance (impressões, cliques, CTR, posição)
 * para uma propriedade + período.
 *
 * @param {string} siteUrl  ex: 'https://g4educacao.com/' ou 'sc-domain:g4educacao.com'
 * @param {number} days     ex: 28
 */
async function getPerformance(siteUrl, days = 28) {
  const auth = await getAuthClient()
  if (!auth) return getMockPerformance(days)

  const sc = google.searchconsole({ version: 'v1', auth })

  const endDate   = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - days)

  const fmt = (d) => d.toISOString().slice(0, 10)

  try {
    // 1. KPIs totais
    const totalsRes = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: fmt(startDate),
        endDate:   fmt(endDate),
        dimensions: [],
      },
    })
    const totals = totalsRes.data.rows?.[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 }

    // 2. Top queries por cliques
    const queriesRes = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: fmt(startDate),
        endDate:   fmt(endDate),
        dimensions: ['query'],
        rowLimit: 10,
        orderBy: [{ fieldName: 'clicks', sortOrder: 'DESCENDING' }],
      },
    })
    const queries = (queriesRes.data.rows || []).map(r => ({
      query:       r.keys[0],
      clicks:      r.clicks,
      impressions: r.impressions,
      ctr:         +(r.ctr * 100).toFixed(1),
      position:    +r.position.toFixed(1),
    }))

    // 3. Top páginas por cliques
    const pagesRes = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: fmt(startDate),
        endDate:   fmt(endDate),
        dimensions: ['page'],
        rowLimit: 10,
        orderBy: [{ fieldName: 'clicks', sortOrder: 'DESCENDING' }],
      },
    })
    const pages = (pagesRes.data.rows || []).map(r => ({
      page:        r.keys[0],
      clicks:      r.clicks,
      impressions: r.impressions,
      ctr:         +(r.ctr * 100).toFixed(1),
      position:    +r.position.toFixed(1),
    }))

    // 4. Tendência diária de cliques + impressões
    const trendRes = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: fmt(startDate),
        endDate:   fmt(endDate),
        dimensions: ['date'],
        rowLimit: 90,
      },
    })
    const trend = (trendRes.data.rows || []).map(r => ({
      date:        r.keys[0],
      clicks:      r.clicks,
      impressions: r.impressions,
      ctr:         +(r.ctr * 100).toFixed(1),
      position:    +r.position.toFixed(1),
    }))

    return {
      mock: false,
      siteUrl,
      days,
      totals: {
        clicks:      totals.clicks,
        impressions: totals.impressions,
        ctr:         +(totals.ctr * 100).toFixed(1),
        position:    +totals.position.toFixed(1),
      },
      queries,
      pages,
      trend,
    }
  } catch (err) {
    console.error('[GSC] getPerformance error:', err.message)
    return { ...getMockPerformance(days), error: err.message }
  }
}

// ── Mock data ──────────────────────────────────────────────────────────────

function getMockSites() {
  return [
    { url: 'sc-domain:g4business.com', permissionLevel: 'siteOwner' },
  ]
}

function getMockPerformance(days) {
  const trend = []
  const base  = new Date()
  base.setDate(base.getDate() - days)
  for (let i = 0; i < days; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    const noise = () => 0.8 + Math.random() * 0.4
    trend.push({
      date:        d.toISOString().slice(0, 10),
      clicks:      Math.round(420 * noise()),
      impressions: Math.round(9800 * noise()),
      ctr:         +(4.3 * noise()).toFixed(1),
      position:    +(12.8 * noise()).toFixed(1),
    })
  }

  return {
    mock: true,
    siteUrl: 'sc-domain:g4business.com',
    days,
    totals: {
      clicks:      trend.reduce((s, r) => s + r.clicks, 0),
      impressions: trend.reduce((s, r) => s + r.impressions, 0),
      ctr:         4.3,
      position:    12.8,
    },
    queries: [
      { query: 'g4 business',         clicks: 2100, impressions: 14200, ctr: 14.8, position: 1.1 },
      { query: 'g4 educacao',         clicks:  980, impressions: 10400, ctr:  9.4, position: 1.8 },
      { query: 'curso de liderança',  clicks:  640, impressions:  9200, ctr:  7.0, position: 3.2 },
      { query: 'treinamento gestão',  clicks:  510, impressions:  9800, ctr:  5.2, position: 5.4 },
      { query: 'curso de vendas b2b', clicks:  420, impressions:  7100, ctr:  5.9, position: 4.0 },
      { query: 'gestão empresarial',  clicks:  340, impressions:  7900, ctr:  4.3, position: 5.9 },
      { query: 'masterclass g4',      clicks:  290, impressions:  4400, ctr:  6.6, position: 2.7 },
      { query: 'g4 summit',           clicks:  250, impressions:  3900, ctr:  6.4, position: 2.9 },
      { query: 'liderança empresas',  clicks:  220, impressions:  5800, ctr:  3.8, position: 8.1 },
      { query: 'gestão de equipes',   clicks:  190, impressions:  5100, ctr:  3.7, position: 8.9 },
    ],
    pages: [
      { page: 'https://g4business.com/',                clicks: 2400, impressions: 19500, ctr: 12.3, position: 1.8 },
      { page: 'https://g4business.com/lideranca',       clicks:  920, impressions: 10200, ctr:  9.0, position: 3.6 },
      { page: 'https://g4business.com/vendas',          clicks:  760, impressions:  8900, ctr:  8.5, position: 4.0 },
      { page: 'https://g4business.com/gestao',          clicks:  570, impressions:  7600, ctr:  7.5, position: 4.9 },
      { page: 'https://g4business.com/summit',          clicks:  500, impressions:  5400, ctr:  9.3, position: 2.8 },
      { page: 'https://g4business.com/blog/lideranca',  clicks:  340, impressions:  7100, ctr:  4.8, position: 8.4 },
      { page: 'https://g4business.com/masterclass',     clicks:  295, impressions:  4400, ctr:  6.7, position: 3.3 },
      { page: 'https://g4business.com/blog/gestao',     clicks:  255, impressions:  6200, ctr:  4.1, position: 9.5 },
      { page: 'https://g4business.com/sobre',           clicks:  200, impressions:  3600, ctr:  5.6, position: 4.5 },
      { page: 'https://g4business.com/blog/vendas-b2b', clicks:  170, impressions:  4300, ctr:  4.0, position: 10.8 },
    ],
    trend,
  }
}

module.exports = { listSites, getPerformance }
