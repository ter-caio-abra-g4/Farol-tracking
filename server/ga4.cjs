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
    const res = await analyticsAdmin.properties.list({
      filter: 'parent:accounts/-',
      pageSize: 50,
    })
    const props = (res.data.properties || []).map((p) => ({
      id: p.name.replace('properties/', ''),
      name: p.displayName,
      createTime: p.createTime,
      updateTime: p.updateTime,
    }))
    return { mock: false, properties: props }
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

module.exports = { listProperties, runReport, getEventSummary }
