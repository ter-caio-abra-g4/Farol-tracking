/**
 * server/ga4.js
 * Rotas GA4 — usa service-account.json do G4 OS (somente leitura).
 */

const { google } = require('googleapis')
const { loadConfig } = require('./config.cjs')
const { recordSnapshot, getTimeline } = require('./snapshot-store.cjs')

// ─── Cache em memória ────────────────────────────────────────────────────────
const CACHE_TTL_MS      = 5 * 60 * 1000   // 5 min — reports
const CACHE_TTL_PROPS   = 10 * 60 * 1000  // 10 min — properties (muda pouco)
const MAX_STALE_MS      = 60 * 60 * 1000  // 1 hora — máx para uso como stale fallback
const _cache = new Map()
const _stale = new Map()

function cacheGet(key) {
  const entry = _cache.get(key)
  if (!entry) return null
  const ttl = key === 'properties' ? CACHE_TTL_PROPS : CACHE_TTL_MS
  if (Date.now() - entry.ts > ttl) { _cache.delete(key); return null }
  return entry.value
}
function cacheSet(key, value) {
  _cache.set(key, { value, ts: Date.now() })
  _stale.set(key, { value, ts: Date.now() })
}
function getStale(key) {
  const entry = _stale.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > MAX_STALE_MS) { _stale.delete(key); return null }
  return { ...entry.value, _stale: true, _stale_ts: entry.ts }
}
function clearCache(key) {
  if (key) { _cache.delete(key); _stale.delete(key) }
  else { _cache.clear(); _stale.clear() }
}
function isAuthError(msg = '') {
  return /403|401|invalid.*token|unauthorized|access.*denied|permission/i.test(String(msg))
}

async function withCache(key, fn) {
  const fresh = cacheGet(key)
  if (fresh !== null) return fresh

  let lastResult = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await fn()
    if (!result?.mock) {
      cacheSet(key, result)
      return result
    }
    if (result?.error && isAuthError(result.error)) break
    lastResult = result
    if (attempt < 3) await new Promise(r => setTimeout(r, 800 * attempt))
  }

  const stale = getStale(key)
  if (stale) return stale

  return lastResult
}

async function getAuthClient() {
  const cfg = loadConfig()
  const scopes = ['https://www.googleapis.com/auth/analytics.readonly']

  // Preferência 1: chave inline (portátil — funciona em qualquer máquina)
  if (cfg.ga4?.service_account_key?.private_key) {
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: cfg.ga4.service_account_key,
        scopes,
      })
      return await auth.getClient()
    } catch (err) {
      console.error('[GA4] Auth error (inline key):', err.message)
    }
  }

  // Fallback: caminho físico do arquivo
  const keyFile = cfg.ga4?.service_account_path
  if (!keyFile) return null

  try {
    const auth = new google.auth.GoogleAuth({ keyFile, scopes })
    return await auth.getClient()
  } catch (err) {
    console.error('[GA4] Auth error (keyFile):', err.message)
    return null
  }
}

async function listProperties() {
  return withCache('properties', async () => {
    const auth = await getAuthClient()
    if (!auth) return { mock: true, properties: getMockProperties() }

    try {
      const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth })

      // Lista contas e depois propriedades em paralelo (Promise.all por conta)
      const accountsRes = await analyticsAdmin.accounts.list()
      const accounts = accountsRes.data.accounts || []

      const results = await Promise.all(
        accounts.map(async (acc) => {
          const accId = acc.name.replace('accounts/', '')
          try {
            const propsRes = await analyticsAdmin.properties.list({
              filter: `parent:accounts/${accId}`,
              pageSize: 50,
            })
            return (propsRes.data.properties || []).map((p) => ({
              id: p.name.replace('properties/', ''),
              name: p.displayName,
              account: acc.displayName,
            }))
          } catch (_) { return [] }
        })
      )

      return { mock: false, properties: results.flat() }
    } catch (err) {
      console.error('[GA4] listProperties error:', err.message)
      return { mock: true, properties: getMockProperties(), error: err.message }
    }
  })
}

async function runReport(propertyId, days = 7) {
  return withCache(`report_${propertyId}_${days}`, async () => {
  const auth = await getAuthClient()
  if (!auth) return { mock: true, data: getMockReport() }

  try {
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth })
    const res = await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'date' }, { name: 'eventName' }],
        metrics: [
          { name: 'eventCount' },
          { name: 'activeUsers' },
        ],
        limit: 100,
        orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      },
    })

    const rows = (res.data.rows || []).map((row) => ({
      date: row.dimensionValues[0].value,
      event: row.dimensionValues[1].value,
      count: parseInt(row.metricValues[0].value, 10),
      users: parseInt(row.metricValues[1].value, 10),
    }))

    return { mock: false, rows, rowCount: res.data.rowCount }
  } catch (err) {
    console.error('[GA4] runReport error:', err.message)
    return { mock: true, data: getMockReport(), error: err.message }
  }
  })
}

async function getEventSummary(propertyId) {
  return withCache(`events_${propertyId}`, async () => {
  const auth = await getAuthClient()
  if (!auth) return { mock: true, events: getMockEvents() }

  try {
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth })
    const res = await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        limit: 50,
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      },
    })

    const events = (res.data.rows || []).map((row) => ({
      name: row.dimensionValues[0].value,
      count: parseInt(row.metricValues[0].value, 10),
      status: 'ok',
      source: 'GA4',
      lastSeen: 'recente',
    }))

    return { mock: false, events }
  } catch (err) {
    console.error('[GA4] getEventSummary error:', err.message)
    return { mock: true, events: getMockEvents(), error: err.message }
  }
  })
}

async function getInternalRefReport(propertyId, days = 28) {
  return withCache(`internalref_${propertyId}_${days}`, async () => {
  const auth = await getAuthClient()
  if (!auth) return { mock: true, rows: getMockInternalRef() }

  try {
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth })
    const res = await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: [
          { name: 'customEvent:internal_ref' },
          { name: 'eventName' },
        ],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: { values: ['form_start', 'form_submit', 'generate_lead', 'form_view'] },
          },
        },
        limit: 100,
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      },
    })

    // Agrupa por internal_ref, somando form_start, form_submit, form_view
    const map = {}
    ;(res.data.rows || []).forEach(r => {
      const ref = r.dimensionValues[0].value || '(não definido)'
      const event = r.dimensionValues[1].value
      const count = parseInt(r.metricValues[0].value, 10)
      if (!map[ref]) map[ref] = { ref, form_view: 0, form_start: 0, form_submit: 0, generate_lead: 0 }
      if (map[ref][event] !== undefined) map[ref][event] += count
    })

    const rows = Object.values(map)
      .map(r => ({
        ...r,
        convRate: r.form_start > 0
          ? Math.round((r.form_submit / r.form_start) * 100)
          : 0,
      }))
      .sort((a, b) => b.form_start - a.form_start)

    return { mock: false, rows, days }
  } catch (err) {
    console.error('[GA4] getInternalRefReport error:', err.message)
    return { mock: true, rows: getMockInternalRef(), error: err.message }
  }
  })
}

async function getSourceMediumReport(propertyId, days = 28) {
  return withCache(`sourcemedium_${propertyId}_${days}`, async () => {
  const auth = await getAuthClient()
  if (!auth) return { mock: true, rows: getMockSourceMedium() }

  try {
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth })

    const [sessionRes, convRes] = await Promise.all([
      // Sessões por channel + source + medium separados
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
          dimensions: [
            { name: 'sessionDefaultChannelGroup' },
            { name: 'sessionSource' },
            { name: 'sessionMedium' },
          ],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
          limit: 30,
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        },
      }),
      // Conversões por source+medium
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
          dimensions: [
            { name: 'sessionSource' },
            { name: 'sessionMedium' },
            { name: 'eventName' },
          ],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: {
            filter: {
              fieldName: 'eventName',
              inListFilter: { values: ['purchase', 'generate_lead', 'form_submit'] },
            },
          },
          limit: 200,
        },
      }),
    ])

    // Mapa de conversões por "source||medium"
    const convMap = {}
    ;(convRes.data.rows || []).forEach(r => {
      const key = r.dimensionValues[0].value + '||' + r.dimensionValues[1].value
      const evt = r.dimensionValues[2].value
      const cnt = parseInt(r.metricValues[0].value, 10)
      if (!convMap[key]) convMap[key] = { purchase: 0, generate_lead: 0, form_submit: 0 }
      if (convMap[key][evt] !== undefined) convMap[key][evt] += cnt
    })

    const rows = (sessionRes.data.rows || []).map(r => {
      const channel = r.dimensionValues[0].value
      const source  = r.dimensionValues[1].value
      const medium  = r.dimensionValues[2].value
      const key = source + '||' + medium
      const sessions = parseInt(r.metricValues[0].value, 10)
      const users    = parseInt(r.metricValues[1].value, 10)
      const conv = convMap[key] || {}
      const conversions = (conv.purchase || 0) + (conv.generate_lead || 0) + (conv.form_submit || 0)
      return {
        channel,
        source,
        medium,
        sessions,
        users,
        purchase: conv.purchase || 0,
        leads: (conv.generate_lead || 0) + (conv.form_submit || 0),
        conversions,
        convRate: sessions > 0 ? ((conversions / sessions) * 100).toFixed(1) : '0.0',
      }
    })

    return { mock: false, rows, days }
  } catch (err) {
    console.error('[GA4] getSourceMediumReport error:', err.message)
    return { mock: true, rows: getMockSourceMedium(), error: err.message }
  }
  })
}

function getMockDashboards() {
  return {
    topPages: [
      { path: '/inscricao/g4-programas-presenciais', views: 15979 },
      { path: '/inscricao/g4-summit',                views: 9420  },
      { path: '/inscricao/mentoria-executiva',        views: 6310  },
      { path: '/inscricao/capacitacao-online',        views: 4880  },
      { path: '/blog/liderança-empresarial',          views: 3240  },
    ],
    formFunnel: [
      { step: 'Visualizaram formulário', event: 'form_view',   count: 71020  },
      { step: 'Iniciaram',               event: 'form_start',  count: 135922 },
      { step: 'Enviaram',                event: 'form_submit', count: 18240  },
      { step: 'Lead gerado',             event: 'generate_lead', count: 17980 },
    ],
    checkoutFunnel: [
      { step: 'Checkout iniciado',       event: 'begin_checkout',    count: 4820 },
      { step: 'Forma de pagamento',      event: 'add_payment_info',  count: 2910 },
      { step: 'Compra concluída',        event: 'purchase',          count: 1283 },
    ],
    topItems: [
      { name: 'G4 Programas Presenciais', purchases: 420, revenue: 2940000 },
      { name: 'G4 Summit 2026',           purchases: 318, revenue: 953400  },
      { name: 'Mentoria Executiva',       purchases: 210, revenue: 1575000 },
      { name: 'Capacitação Online',       purchases: 185, revenue: 277500  },
      { name: 'G4 Skills',               purchases: 150, revenue: 450000  },
    ],
  }
}

async function getDashboards(propertyId, days = 28) {
  return withCache(`dashboards_${propertyId}_${days}`, async () => {
  const auth = await getAuthClient()
  if (!auth) return { mock: true, ...getMockDashboards() }

  try {
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth })
    const prop = `properties/${propertyId}`
    const dateRange = { startDate: `${days}daysAgo`, endDate: 'today' }

    const [pagesRes, formsRes, checkoutRes, itemsRes] = await Promise.all([
      // Top páginas
      analyticsData.properties.runReport({
        property: prop,
        requestBody: {
          dateRanges: [dateRange],
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
          limit: 50,
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        },
      }),
      // Funil de formulário: form_view → form_start → form_step_view → form_submit
      analyticsData.properties.runReport({
        property: prop,
        requestBody: {
          dateRanges: [dateRange],
          dimensions: [{ name: 'eventName' }],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: {
            filter: {
              fieldName: 'eventName',
              inListFilter: { values: ['form_view', 'form_start', 'form_step_view', 'form_submit', 'generate_lead', 'qualify_lead'] },
            },
          },
          limit: 20,
        },
      }),
      // Funil de checkout: begin_checkout → add_payment_info → purchase
      analyticsData.properties.runReport({
        property: prop,
        requestBody: {
          dateRanges: [dateRange],
          dimensions: [{ name: 'eventName' }],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: {
            filter: {
              fieldName: 'eventName',
              inListFilter: { values: ['begin_checkout', 'add_payment_info', 'purchase'] },
            },
          },
          limit: 10,
        },
      }),
      // Top items de e-commerce (item_name)
      analyticsData.properties.runReport({
        property: prop,
        requestBody: {
          dateRanges: [dateRange],
          dimensions: [{ name: 'itemName' }],
          metrics: [{ name: 'itemsPurchased' }, { name: 'itemRevenue' }],
          limit: 10,
          orderBys: [{ metric: { metricName: 'itemRevenue' }, desc: true }],
        },
      }).catch(() => ({ data: { rows: [] } })),
    ])

    // Top páginas
    const topPages = (pagesRes.data.rows || []).map(r => ({
      path: r.dimensionValues[0].value,
      views: parseInt(r.metricValues[0].value, 10),
      users: parseInt(r.metricValues[1].value, 10),
    }))

    // Funil de formulário
    const formMap = {}
    ;(formsRes.data.rows || []).forEach(r => {
      formMap[r.dimensionValues[0].value] = parseInt(r.metricValues[0].value, 10)
    })
    const formFunnel = [
      { step: 'Visualizaram', event: 'form_view', count: formMap['form_view'] ?? 0 },
      { step: 'Iniciaram', event: 'form_start', count: formMap['form_start'] ?? 0 },
      { step: 'Avançaram', event: 'form_step_view', count: formMap['form_step_view'] ?? 0 },
      { step: 'Enviaram', event: 'form_submit', count: formMap['form_submit'] ?? 0 },
      { step: 'Lead gerado', event: 'generate_lead', count: formMap['generate_lead'] ?? 0 },
      { step: 'Lead qualificado', event: 'qualify_lead', count: formMap['qualify_lead'] ?? 0 },
    ].filter(s => s.count > 0)

    // Funil de checkout
    const checkMap = {}
    ;(checkoutRes.data.rows || []).forEach(r => {
      checkMap[r.dimensionValues[0].value] = parseInt(r.metricValues[0].value, 10)
    })
    const checkoutFunnel = [
      { step: 'Checkout iniciado', event: 'begin_checkout', count: checkMap['begin_checkout'] ?? 0 },
      { step: 'Pagamento', event: 'add_payment_info', count: checkMap['add_payment_info'] ?? 0 },
      { step: 'Compra concluída', event: 'purchase', count: checkMap['purchase'] ?? 0 },
    ].filter(s => s.count > 0)

    // Top produtos
    const topItems = (itemsRes.data.rows || []).map(r => ({
      name: r.dimensionValues[0].value,
      purchases: parseInt(r.metricValues[0].value, 10),
      revenue: parseFloat(r.metricValues[1].value),
    }))

    return { mock: false, topPages, formFunnel, checkoutFunnel, topItems, days }
  } catch (err) {
    console.error('[GA4] getDashboards error:', err.message)
    return { mock: true, error: err.message, ...getMockDashboards() }
  }
  })
}

function getMockProperties() {
  return [
    { id: '000000000', name: 'G4 Educacao (mock)', createTime: null, updateTime: null },
  ]
}

function getMockReport() {
  return [
    { date: '20260401', event: 'page_view', count: 12000, users: 4200 },
    { date: '20260402', event: 'page_view', count: 13400, users: 4800 },
  ]
}

function getMockInternalRef() {
  return [
    { ref: 'lp-programas-presenciais', form_view: 8200, form_start: 3100, form_submit: 820, generate_lead: 810, convRate: 26 },
    { ref: 'lp-g4-summit',             form_view: 5400, form_start: 1900, form_submit: 540, generate_lead: 535, convRate: 28 },
    { ref: 'lp-mentoria-exec',         form_view: 3200, form_start: 980,  form_submit: 210, generate_lead: 205, convRate: 21 },
    { ref: 'lp-capacitacao-online',    form_view: 2100, form_start: 710,  form_submit: 180, generate_lead: 175, convRate: 25 },
    { ref: '(não definido)',           form_view: 1500, form_start: 420,  form_submit: 80,  generate_lead: 78,  convRate: 19 },
  ]
}

function getMockSourceMedium() {
  return [
    { channel: 'Paid Search',    source: 'google',     medium: 'cpc',        sessions: 48200, users: 39100, purchase: 312, leads: 1820, conversions: 2132, convRate: '4.4' },
    { channel: 'Organic Search', source: 'google',     medium: 'organic',    sessions: 31400, users: 26800, purchase: 98,  leads: 720,  conversions: 818,  convRate: '2.6' },
    { channel: 'Paid Social',    source: 'facebook',   medium: 'cpc',        sessions: 18200, users: 15800, purchase: 175, leads: 820,  conversions: 995,  convRate: '5.5' },
    { channel: 'Paid Social',    source: 'instagram',  medium: 'cpc',        sessions: 9400,  users: 8200,  purchase: 62,  leads: 310,  conversions: 372,  convRate: '4.0' },
    { channel: 'Email',          source: 'email',      medium: 'newsletter', sessions: 9800,  users: 8100,  purchase: 54,  leads: 340,  conversions: 394,  convRate: '4.0' },
    { channel: 'Direct',         source: '(direct)',   medium: '(none)',     sessions: 8400,  users: 7200,  purchase: 42,  leads: 210,  conversions: 252,  convRate: '3.0' },
    { channel: 'Organic Social', source: 'instagram',  medium: 'organic',    sessions: 5100,  users: 4700,  purchase: 12,  leads: 180,  conversions: 192,  convRate: '3.8' },
    { channel: 'Referral',       source: 'linktree',   medium: 'referral',   sessions: 3200,  users: 2900,  purchase: 18,  leads: 95,   conversions: 113,  convRate: '3.5' },
    { channel: 'Organic Social', source: 'youtube',    medium: 'organic',    sessions: 2800,  users: 2600,  purchase: 8,   leads: 72,   conversions: 80,   convRate: '2.9' },
    { channel: 'Paid Search',    source: 'bing',       medium: 'cpc',        sessions: 1200,  users: 1100,  purchase: 9,   leads: 38,   conversions: 47,   convRate: '3.9' },
  ]
}

function getMockEvents() {
  return [
    { name: 'page_view', count: 48200, status: 'ok', source: 'GA4', lastSeen: '2 min' },
    { name: 'purchase', count: 342, status: 'ok', source: 'GA4+Meta', lastSeen: '8 min' },
    { name: 'lead', count: 1820, status: 'ok', source: 'GA4+Meta', lastSeen: '3 min' },
  ]
}

async function getExitPages(propertyId, days = 28) {
  return withCache(`exitpages_${propertyId}_${days}`, async () => {
  const auth = await getAuthClient()
  if (!auth) return { mock: true, pages: getMockExitPages() }

  try {
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth })

    // Páginas com sessões e exits — filtra paths relevantes (páginas de formulário/checkout)
    const res = await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'sessions' },
          { name: 'bounceRate' },
          { name: 'screenPageViews' },
          { name: 'exitRate' },
        ],
        dimensionFilter: {
          orGroup: {
            expressions: [
              { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: '/inscricao' } } },
              { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: '/checkout' } } },
              { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: '/formulario' } } },
              { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: '/form' } } },
              { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: '/lead' } } },
              { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: '/lp' } } },
              { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: '/landing' } } },
            ],
          },
        },
        limit: 20,
        orderBys: [{ metric: { metricName: 'exitRate' }, desc: true }],
      },
    })

    const pages = (res.data.rows || []).map(r => ({
      path:       r.dimensionValues[0].value,
      sessions:   parseInt(r.metricValues[0].value, 10),
      bounceRate: parseFloat(r.metricValues[1].value),
      views:      parseInt(r.metricValues[2].value, 10),
      exitRate:   parseFloat(r.metricValues[3].value),
    }))
    .filter(p => p.sessions >= 10) // Filtra páginas com tráfego mínimo

    return { mock: false, pages, days }
  } catch (err) {
    console.error('[GA4] getExitPages error:', err.message)
    return { mock: true, pages: getMockExitPages(), error: err.message }
  }
  })
}

function getMockExitPages() {
  return [
    { path: '/inscricao/g4-programas-presenciais', sessions: 8420, views: 15979, exitRate: 0.68, bounceRate: 0.44 },
    { path: '/inscricao/g4-summit',                sessions: 4810, views: 9420,  exitRate: 0.61, bounceRate: 0.38 },
    { path: '/inscricao/mentoria-executiva',        sessions: 2940, views: 6310,  exitRate: 0.74, bounceRate: 0.52 },
    { path: '/inscricao/capacitacao-online',        sessions: 2180, views: 4880,  exitRate: 0.57, bounceRate: 0.35 },
    { path: '/checkout/programas',                  sessions: 1820, views: 3240,  exitRate: 0.82, bounceRate: 0.60 },
    { path: '/lp/g4-skills',                        sessions: 1340, views: 2870,  exitRate: 0.48, bounceRate: 0.29 },
    { path: '/lp/mentoria-grupo',                   sessions: 980,  views: 1920,  exitRate: 0.55, bounceRate: 0.33 },
  ]
}

// ─── Realtime Report — últimos 30 minutos ────────────────────────────────────
// Restrições da Realtime API (descobertas empiricamente):
//   - activeUsers NÃO combina com eventName
//   - eventCount NÃO combina com eventName + unifiedScreenName juntos
//   - Dimensões disponíveis: eventName, unifiedScreenName, minutesAgo, country, city, deviceCategory
//   - NÃO existem: sessionSource/Medium/Campaign, defaultChannelGroup, firstUserX
// Solução: 4 calls independentes + merge no processamento
//   1. eventName alone + eventCount       → contagem por evento
//   2. unifiedScreenName + eventCount + activeUsers → topPages + users por página
//   3. minutesAgo + eventName + eventCount → timeline
//   4. deviceCategory + eventName + eventCount → breakdown por dispositivo
async function getRealtimeReport(propertyId, eventFilter = null, channelFilter = null, pageFilter = null) {
  const auth = await getAuthClient()
  if (!auth) return { mock: true, ...getMockRealtime(eventFilter, pageFilter) }

  try {
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth })
    const prop = `properties/${propertyId}`

    function makeFilter(field, value, matchType = 'EXACT') {
      return { filter: { fieldName: field, stringFilter: { matchType, value } } }
    }
    function andFilter(...exprs) {
      return exprs.length === 1 ? exprs[0] : { andGroup: { expressions: exprs } }
    }
    function buildFilter(...parts) {
      const active = parts.filter(Boolean)
      if (!active.length) return undefined
      return active.length === 1 ? active[0] : andFilter(...active)
    }

    const eventF  = eventFilter   ? makeFilter('eventName',      eventFilter,  'EXACT')    : null
    const deviceF = channelFilter ? makeFilter('deviceCategory', channelFilter, 'EXACT')   : null
    // pageF NÃO pode ser usado junto com eventName, minutesAgo ou deviceCategory —
    // limitação da Realtime API. Usado apenas nas calls que aceitam (Call 2 e activeUsers).
    const pageF   = pageFilter    ? makeFilter('unifiedScreenName', pageFilter, 'CONTAINS') : null

    // Calls 1/3/4: sem pageF (incompatível com eventName/minutesAgo/deviceCategory na Realtime API)
    // Call 2 e activeUsers: usam pageF pois só têm unifiedScreenName como dimensão
    const [evCountRes, pageRes, minuteRes, deviceRes] = await Promise.all([
      // Call 1: eventName + eventCount — sem pageF (incompatível)
      analyticsData.properties.runRealtimeReport({
        property: prop,
        requestBody: {
          dimensions: [{ name: 'eventName' }],
          metrics:    [{ name: 'eventCount' }],
          dimensionFilter: buildFilter(eventF, deviceF),
          limit: 50,
        },
      }),

      // Call 2: unifiedScreenName + eventCount + activeUsers — aceita pageF
      analyticsData.properties.runRealtimeReport({
        property: prop,
        requestBody: {
          dimensions: [{ name: 'unifiedScreenName' }],
          metrics:    [{ name: 'eventCount' }, { name: 'activeUsers' }],
          dimensionFilter: buildFilter(deviceF, pageF),
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
          limit: 20,
        },
      }),

      // Call 3: minutesAgo × eventName + eventCount — sem pageF (incompatível)
      analyticsData.properties.runRealtimeReport({
        property: prop,
        requestBody: {
          dimensions: [{ name: 'minutesAgo' }, { name: 'eventName' }],
          metrics:    [{ name: 'eventCount' }],
          dimensionFilter: buildFilter(eventF, deviceF),
          limit: 200,
        },
      }),

      // Call 4: deviceCategory × eventName + eventCount — sem pageF (incompatível)
      analyticsData.properties.runRealtimeReport({
        property: prop,
        requestBody: {
          dimensions: [{ name: 'deviceCategory' }, { name: 'eventName' }],
          metrics:    [{ name: 'eventCount' }],
          dimensionFilter: buildFilter(deviceF),
          limit: 100,
        },
      }),
    ])

    // ── Processa Call 1 — top eventos ──
    const byEvent = {}
    for (const row of (evCountRes.data.rows || [])) {
      const ev    = row.dimensionValues[0].value
      const count = parseInt(row.metricValues[0].value, 10)
      if (!byEvent[ev]) byEvent[ev] = { event: ev, count: 0, users: 0 }
      byEvent[ev].count += count
    }

    // ── Processa Call 2 — páginas + activeUsers totais ──
    let activeUsers = 0
    const byPage = {}
    const rows = []
    for (const row of (pageRes.data.rows || [])) {
      const page  = row.dimensionValues[0].value
      const count = parseInt(row.metricValues[0].value, 10)
      const users = parseInt(row.metricValues[1].value, 10)
      activeUsers = Math.max(activeUsers, users)
      if (!byPage[page]) byPage[page] = { page, views: 0, users: 0 }
      byPage[page].views += count
      byPage[page].users  = Math.max(byPage[page].users, users)
      rows.push({ event: 'page_view', page, count, users })
    }

    // activeUsers total — sem dimensões; usa pageF quando disponível (aceito pela API)
    const activeUsersRes = await analyticsData.properties.runRealtimeReport({
      property: prop,
      requestBody: {
        dimensions: [],
        metrics: [{ name: 'activeUsers' }],
        ...(pageF ? { dimensionFilter: pageF } : {}),
      }
    })
    activeUsers = parseInt(activeUsersRes.data.rows?.[0]?.metricValues?.[0]?.value ?? activeUsers, 10)

    for (const [ev, obj] of Object.entries(byEvent)) {
      obj.users = ev === 'page_view' ? Object.values(byPage).reduce((s, p) => s + p.users, 0) : 0
    }

    const totalEvents = Object.values(byEvent).reduce((s, e) => s + e.count, 0)
    const topEvents   = Object.values(byEvent).sort((a, b) => b.count - a.count).slice(0, 15)
    const topPages    = Object.values(byPage).sort((a, b) => b.views - a.views).slice(0, 8)

    // ── Processa Call 3 — minutesAgo ──
    const byMinute = {}
    for (const row of (minuteRes.data.rows || [])) {
      const minAgo  = parseInt(row.dimensionValues[0].value, 10)
      const event   = row.dimensionValues[1].value
      const count   = parseInt(row.metricValues[0].value, 10)
      const d = new Date(Date.now() - minAgo * 60 * 1000)
      const label = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      if (!byMinute[label]) byMinute[label] = { minute: label, minAgo, total: 0 }
      byMinute[label].total += count
      byMinute[label][event] = (byMinute[label][event] || 0) + count
    }
    const timeline = Object.values(byMinute).sort((a, b) => b.minAgo - a.minAgo)

    // ── Processa Call 4 — dispositivo × evento ──
    const byDevice = {}
    for (const row of (deviceRes.data.rows || [])) {
      const device = row.dimensionValues[0].value || 'unknown'
      const event  = row.dimensionValues[1].value
      const count  = parseInt(row.metricValues[0].value, 10)
      if (!byDevice[device]) byDevice[device] = { channel: device, users: 0, events: {} }
      byDevice[device].events[event] = (byDevice[device].events[event] || 0) + count
    }
    const channels    = Object.values(byDevice).sort((a, b) => (b.events['page_view']||0) - (a.events['page_view']||0))
    const channelList = channels.map(c => c.channel)

    // UTM não disponível na Realtime API
    const utmRows      = []
    const utmSources   = []
    const utmMediums   = []
    const utmCampaigns = []

    // Grava snapshot escopado por pageFilter — histórico separado por LP/Checkout/etc
    recordSnapshot({ propertyId, activeUsers, topEvents, pageFilter: pageFilter || '' })

    // Usa timeline do histórico local se tiver >= 3 pontos (mais precisa que minutesAgo)
    const ev = eventFilter || 'page_view'
    const localTimeline = getTimeline(propertyId, ev, undefined, pageFilter || '')
    const useLocal = localTimeline.length >= 3
    const finalTimeline = useLocal ? localTimeline : timeline

    // Janela real em minutos — usa o snap mais antigo da timeline local
    let timelineWindowMin = 30
    if (useLocal && localTimeline.length > 0) {
      const oldest = localTimeline[localTimeline.length - 1]  // sorted desc por minAgo
      timelineWindowMin = Math.max(1, oldest.minAgo || 1)
    }

    return {
      mock: false,
      propertyId,
      capturedAt: new Date().toISOString(),
      activeUsers,
      totalEvents,
      topEvents,
      topPages,
      channels,
      channelList,
      timeline: finalTimeline,
      timelineSource: useLocal ? 'local' : 'api',
      timelineWindowMin,
      utmRows,
      utmSources,
      utmMediums,
      utmCampaigns,
      pageFilter,
      // Quando pageFilter ativo: activeUsers e topPages estão filtrados pela página
      // topEvents e timeline mostram o site inteiro (limitação da Realtime API)
      pageFilteredFields: pageFilter ? ['activeUsers', 'topPages'] : [],
      rows,
    }
  } catch (err) {
    console.error('[GA4] getRealtimeReport error:', err.message)
    return { mock: true, ...getMockRealtime(eventFilter, pageFilter), error: err.message }
  }
}

function getMockRealtime(eventFilter, pageFilter = null) {
  const ev = eventFilter || 'generate_lead'
  // Timeline: simula 15 min de atividade
  const timeline = Array.from({ length: 15 }, (_, i) => {
    const d = new Date(Date.now() - i * 60 * 1000)
    const label = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const base = Math.max(0, Math.round(8 - i * 0.2 + Math.sin(i * 0.5) * 3))
    return { minute: label, minAgo: i, total: base + Math.round(base * 0.3), [ev]: base, page_view: base + Math.round(base * 0.3) }
  }).sort((a, b) => b.minAgo - a.minAgo)

  return {
    capturedAt: new Date().toISOString(),
    activeUsers: 47,
    totalEvents: 312,
    topEvents: [
      { event: 'page_view',      count: 184, users: 47 },
      { event: 'scroll',         count: 62,  users: 31 },
      { event: 'click',          count: 38,  users: 22 },
      { event: 'generate_lead',  count: 14,  users: 14 },
      { event: 'begin_checkout', count: 8,   users: 8  },
      { event: 'purchase',       count: 6,   users: 6  },
    ],
    topPages: [
      { page: '/programas/presencial',  views: 58, users: 31 },
      { page: '/g4-summit-2026',        views: 41, users: 24 },
      { page: '/',                      views: 35, users: 28 },
      { page: '/mentoria-executiva',    views: 27, users: 18 },
      { page: '/capacitacao-online',    views: 19, users: 13 },
    ],
    channels: [
      { channel: 'Paid Search',    users: 18, events: { generate_lead: 6, page_view: 72, begin_checkout: 3, purchase: 2 } },
      { channel: 'Paid Social',    users: 12, events: { generate_lead: 5, page_view: 48, begin_checkout: 2, purchase: 2 } },
      { channel: 'Organic Search', users: 9,  events: { generate_lead: 2, page_view: 38, begin_checkout: 1, purchase: 1 } },
      { channel: 'Direct',         users: 5,  events: { generate_lead: 1, page_view: 18, begin_checkout: 1, purchase: 1 } },
      { channel: 'Email',          users: 3,  events: { generate_lead: 0, page_view: 8,  begin_checkout: 1, purchase: 0 } },
    ],
    channelList: ['Paid Search', 'Paid Social', 'Organic Search', 'Direct', 'Email'],
    timeline,
    utmRows: [
      { event: 'generate_lead', page: '/inscricao/g4-programas-presenciais', source: 'google',    medium: 'cpc',        campaign: 'g4-presencial-maio26',  count: 6,  users: 6  },
      { event: 'generate_lead', page: '/inscricao/g4-summit',                source: 'facebook',  medium: 'cpc',        campaign: 'summit-retargeting',    count: 4,  users: 4  },
      { event: 'generate_lead', page: '/inscricao/g4-programas-presenciais', source: 'google',    medium: 'organic',    campaign: '',                       count: 2,  users: 2  },
      { event: 'generate_lead', page: '/lp/g4-skills',                       source: 'instagram', medium: 'cpc',        campaign: 'skills-awareness-maio',  count: 2,  users: 2  },
      { event: 'begin_checkout',page: '/checkout/programas',                  source: 'google',    medium: 'cpc',        campaign: 'g4-presencial-maio26',  count: 3,  users: 3  },
      { event: 'purchase',      page: '/checkout/programas',                  source: 'google',    medium: 'cpc',        campaign: 'g4-presencial-maio26',  count: 2,  users: 2  },
      { event: 'purchase',      page: '/checkout/programas',                  source: 'facebook',  medium: 'cpc',        campaign: 'summit-retargeting',    count: 2,  users: 2  },
      { event: 'page_view',     page: '/inscricao/g4-programas-presenciais', source: 'google',    medium: 'cpc',        campaign: 'g4-presencial-maio26',  count: 38, users: 28 },
      { event: 'page_view',     page: '/g4-summit-2026',                     source: 'facebook',  medium: 'cpc',        campaign: 'summit-retargeting',    count: 22, users: 17 },
      { event: 'page_view',     page: '/inscricao/g4-programas-presenciais', source: '(direct)',  medium: '(none)',      campaign: '',                       count: 18, users: 14 },
      { event: 'page_view',     page: '/mentoria-executiva',                 source: 'google',    medium: 'organic',    campaign: '',                       count: 15, users: 12 },
      { event: 'scroll',        page: '/inscricao/g4-programas-presenciais', source: 'google',    medium: 'cpc',        campaign: 'g4-presencial-maio26',  count: 24, users: 18 },
    ],
    utmSources:   ['facebook', 'google', 'instagram'],
    utmMediums:   ['cpc', 'organic'],
    utmCampaigns: ['g4-presencial-maio26', 'skills-awareness-maio', 'summit-retargeting'],
    pageFilter,
    rows: [],
  }
}

// ─── Events by Page ─────────────────────────────────────────────────────────
// Retorna: { mock, propertyId, days, rows: [{ pagePath, event, count, users }] }
async function getEventsByPage(propertyId, days = 28) {
  const cacheKey = `events-by-page-${propertyId}-${days}`
  return withCache(cacheKey, async () => {
    const auth = await getAuthClient()
    if (!auth) return { mock: true, propertyId, days, rows: getMockEventsByPage() }

    const analyticsData = google.analyticsdata({ version: 'v1beta', auth })

    const res = await analyticsData.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }, { name: 'eventName' }],
        metrics:    [{ name: 'eventCount' }, { name: 'activeUsers' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: {
              values: ['generate_lead', 'qualify_lead', 'MQL', 'begin_checkout',
                       'purchase', 'form_start', 'form_submit', 'disqualify_lead',
                       'page_view', 'click', 'scroll'],
            },
          },
        },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 200,
      },
    })

    const rows = (res.data.rows || []).map(r => ({
      pagePath: r.dimensionValues[0].value,
      event:    r.dimensionValues[1].value,
      count:    parseInt(r.metricValues[0].value, 10),
      users:    parseInt(r.metricValues[1].value, 10),
    }))

    return { mock: false, propertyId, days, rows }
  })
}

function getMockEventsByPage() {
  return [
    { pagePath: '/aniversario-g4',              event: 'generate_lead',  count: 23135, users: 18400 },
    { pagePath: '/aniversario-g4',              event: 'qualify_lead',   count: 6092,  users: 5100  },
    { pagePath: '/aniversario-g4',              event: 'page_view',      count: 201927,users: 143901 },
    { pagePath: '/inscricao/g4-programas-presenciais', event: 'generate_lead', count: 1338, users: 1100 },
    { pagePath: '/g4-gestao-empresarial-lp',    event: 'begin_checkout', count: 1107,  users: 950   },
    { pagePath: '/simulador-ote',               event: 'generate_lead',  count: 1296,  users: 1050  },
    { pagePath: '/simulador-ote',               event: 'qualify_lead',   count: 769,   users: 640   },
  ]
}

module.exports = { listProperties, runReport, getEventSummary, getDashboards, getInternalRefReport, getSourceMediumReport, getExitPages, getRealtimeReport, getEventsByPage, clearCache }
