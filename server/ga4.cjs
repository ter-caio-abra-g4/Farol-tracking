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

async function getDashboards(propertyId, days = 28) {
  const auth = await getAuthClient()
  if (!auth) return { mock: true }

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
    return { mock: true, error: err.message }
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

function getMockEvents() {
  return [
    { name: 'page_view', count: 48200, status: 'ok', source: 'GA4', lastSeen: '2 min' },
    { name: 'purchase', count: 342, status: 'ok', source: 'GA4+Meta', lastSeen: '8 min' },
    { name: 'lead', count: 1820, status: 'ok', source: 'GA4+Meta', lastSeen: '3 min' },
  ]
}

module.exports = { listProperties, runReport, getEventSummary, getDashboards }
