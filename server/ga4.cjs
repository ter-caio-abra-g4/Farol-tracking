/**
 * server/ga4.js
 * Rotas GA4 — usa service-account.json do G4 OS (somente leitura).
 */

const { google } = require('googleapis')
const { loadConfig } = require('./config.cjs')

async function getAuthClient() {
  const cfg = loadConfig()
  const keyFile = cfg.ga4?.service_account_path

  if (!keyFile) return null

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    })
    return await auth.getClient()
  } catch (err) {
    console.error('[GA4] Auth error:', err.message)
    return null
  }
}

async function listProperties() {
  const auth = await getAuthClient()
  if (!auth) return { mock: true, properties: getMockProperties() }

  try {
    const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth })

    // Lista contas e depois propriedades de cada uma
    const accountsRes = await analyticsAdmin.accounts.list()
    const accounts = accountsRes.data.accounts || []

    const allProps = []
    for (const acc of accounts) {
      const accId = acc.name.replace('accounts/', '')
      try {
        const propsRes = await analyticsAdmin.properties.list({
          filter: `parent:accounts/${accId}`,
          pageSize: 50,
        })
        const props = (propsRes.data.properties || []).map((p) => ({
          id: p.name.replace('properties/', ''),
          name: p.displayName,
          account: acc.displayName,
        }))
        allProps.push(...props)
      } catch (_) {}
    }

    return { mock: false, properties: allProps }
  } catch (err) {
    console.error('[GA4] listProperties error:', err.message)
    return { mock: true, properties: getMockProperties(), error: err.message }
  }
}

async function runReport(propertyId, days = 7) {
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
}

async function getEventSummary(propertyId) {
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
}

async function getInternalRefReport(propertyId, days = 28) {
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
}

async function getSourceMediumReport(propertyId, days = 28) {
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

module.exports = { listProperties, runReport, getEventSummary, getDashboards, getInternalRefReport, getSourceMediumReport }
