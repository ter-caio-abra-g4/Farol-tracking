/**
 * server/databricks.cjs
 * Integração com Databricks SQL REST API.
 * Usa Personal Access Token + SQL Warehouse HTTP Path.
 */

const fetch = require('node-fetch')
const { loadConfig } = require('./config.cjs')

function getCredentials() {
  const cfg = loadConfig()
  const db = cfg.databricks ?? {}
  return {
    host: db.host || null,          // ex: https://dbc-XXXX.cloud.databricks.com
    token: db.token || null,        // dapi...
    httpPath: db.http_path || null, // /sql/1.0/warehouses/XXXX
    catalog: db.catalog || 'hive_metastore',
    schema: db.schema || null,
  }
}

// Executa uma query SQL via Databricks SQL REST API (Statement Execution)
async function executeStatement(sql, timeoutSecs = 30) {
  const { host, token, httpPath, catalog, schema } = getCredentials()
  if (!host || !token || !httpPath) throw new Error('Databricks não configurado')

  // Extrai o warehouse ID do httpPath: /sql/1.0/warehouses/XXXX
  const warehouseId = httpPath.split('/warehouses/')[1]
  if (!warehouseId) throw new Error('HTTP Path inválido — formato esperado: /sql/1.0/warehouses/XXXX')

  const url = `${host}/api/2.0/sql/statements`
  const body = {
    warehouse_id: warehouseId,
    statement: sql,
    wait_timeout: `${timeoutSecs}s`,
    on_wait_timeout: 'CANCEL',
    catalog: catalog || 'production',
    schema: schema || undefined,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (data.error_code) throw new Error(`${data.error_code}: ${data.message}`)
  if (data.status?.state === 'FAILED') throw new Error(data.status.error?.message ?? 'Query falhou')

  return data
}

// Converte resultado da API para formato { columns, rows }
function parseResult(data) {
  const schema = data.manifest?.schema?.columns ?? []
  const columns = schema.map(c => ({ name: c.name, type: c.type_name }))
  const chunks = data.result?.data_array ?? []
  const rows = chunks.map(r => {
    const obj = {}
    columns.forEach((col, i) => { obj[col.name] = r[i] ?? null })
    return obj
  })
  return { columns, rows }
}

// ─── Status / health check ────────────────────────────────────────────────────
async function getStatus() {
  const { host, token, httpPath, catalog, schema } = getCredentials()
  if (!host || !token || !httpPath) {
    return { mock: true, ...getMockStatus() }
  }

  try {
    const data = await executeStatement('SELECT 1 AS ok', 10)
    const warehouseId = httpPath.split('/warehouses/')[1]

    // Conta tabelas e lista schemas disponíveis
    let tableCount = 0
    let schemas = []
    try {
      if (schema) {
        const tablesData = await executeStatement(`SHOW TABLES IN SCHEMA ${catalog}.${schema}`, 15)
        const { rows } = parseResult(tablesData)
        tableCount = rows.length
      }
      const schemasData = await executeStatement(`SHOW SCHEMAS IN ${catalog}`, 15)
      const { rows: schemaRows } = parseResult(schemasData)
      schemas = schemaRows.map(r => r.databaseName ?? r.namespace ?? Object.values(r)[0])
    } catch (_) {}

    return {
      mock: false,
      connected: true,
      warehouseId,
      host,
      catalog,
      schema,
      tables: tableCount,
      availableSchemas: schemas,
    }
  } catch (err) {
    console.error('[Databricks] getStatus error:', err.message)
    return { mock: true, error: err.message, ...getMockStatus() }
  }
}

// ─── Lista de tabelas ─────────────────────────────────────────────────────────
async function listTables() {
  const { host, token, catalog, schema } = getCredentials()
  if (!host || !token) return { mock: true, tables: getMockTables() }

  try {
    const schemaFilter = schema ? `IN SCHEMA ${catalog}.${schema}` : `IN CATALOG ${catalog}`
    const data = await executeStatement(`SHOW TABLES ${schemaFilter}`, 20)
    const { rows } = parseResult(data)

    const tables = rows.map(r => ({
      name: r.tableName ?? r.table_name ?? r.name ?? Object.values(r)[1],
      schema: r.namespace ?? r.schema_name ?? r.database ?? schema,
      fullName: [catalog, r.namespace ?? schema, r.tableName ?? r.table_name].filter(Boolean).join('.'),
    }))

    return { mock: false, tables }
  } catch (err) {
    console.error('[Databricks] listTables error:', err.message)
    return { mock: true, tables: getMockTables(), error: err.message }
  }
}

// ─── Preview de tabela (10 linhas) ────────────────────────────────────────────
async function previewTable(tableName) {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, ...getMockPreview(tableName) }

  try {
    // Sanitiza o nome para evitar injection
    const safe = tableName.replace(/[^a-zA-Z0-9_.`\-]/g, '')
    const data = await executeStatement(`SELECT * FROM ${safe} LIMIT 10`, 30)
    const { columns, rows } = parseResult(data)
    return { mock: false, tableName, columns, rows }
  } catch (err) {
    console.error('[Databricks] previewTable error:', err.message)
    return { mock: true, error: err.message, ...getMockPreview(tableName) }
  }
}

// ─── Mock data ────────────────────────────────────────────────────────────────
function getMockStatus() {
  return {
    connected: false,
    warehouseId: null,
    host: null,
    catalog: 'hive_metastore',
    schema: null,
    tables: 0,
  }
}

function getMockTables() {
  return [
    { name: 'ga4_events_raw',        schema: 'tracking', fullName: 'hive_metastore.tracking.ga4_events_raw' },
    { name: 'ga4_events_cleaned',    schema: 'tracking', fullName: 'hive_metastore.tracking.ga4_events_cleaned' },
    { name: 'meta_pixel_events',     schema: 'tracking', fullName: 'hive_metastore.tracking.meta_pixel_events' },
    { name: 'gtm_tag_audit',         schema: 'tracking', fullName: 'hive_metastore.tracking.gtm_tag_audit' },
    { name: 'form_submissions',      schema: 'tracking', fullName: 'hive_metastore.tracking.form_submissions' },
    { name: 'session_attribution',   schema: 'tracking', fullName: 'hive_metastore.tracking.session_attribution' },
  ]
}

function getMockPreview(tableName) {
  const name = tableName?.split('.').pop() ?? 'table'
  const columns = [
    { name: 'event_date',      type: 'DATE' },
    { name: 'event_name',      type: 'STRING' },
    { name: 'user_pseudo_id',  type: 'STRING' },
    { name: 'session_id',      type: 'STRING' },
    { name: 'page_location',   type: 'STRING' },
    { name: 'source',          type: 'STRING' },
    { name: 'medium',          type: 'STRING' },
  ]
  const rows = Array.from({ length: 5 }, (_, i) => ({
    event_date: '2026-04-08',
    event_name: ['page_view', 'form_start', 'purchase', 'scroll', 'session_start'][i],
    user_pseudo_id: `mock_user_${i + 1}`,
    session_id: `mock_session_${i + 1}`,
    page_location: 'https://g4educacao.com/mock',
    source: ['google', 'facebook', '(direct)', 'instagram', 'email'][i],
    medium: ['cpc', 'paid_social', '(none)', 'social', 'email'][i],
  }))
  return { tableName: name, columns, rows }
}

// ─── Funil Comercial ──────────────────────────────────────────────────────────
// Retorna contagem de leads por etapa do funil nos últimos N dias
async function getFunnelStages(days = 30) {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, stages: getMockFunnelStages() }

  try {
    const data = await executeStatement(
      `SELECT event, COUNT(*) as total
       FROM production.diamond.funil_comercial
       WHERE event_timestamp >= CURRENT_DATE - INTERVAL ${days} DAYS
         AND event IN ('MQL','SAL','Oportunidade','Conectado','Agendado','Negociação','Ganho','Perdido')
       GROUP BY event`,
      30
    )
    const { rows } = parseResult(data)

    // Ordena pelas etapas do funil
    const ORDER = ['MQL','SAL','Oportunidade','Conectado','Agendado','Negociação','Ganho','Perdido']
    const map = {}
    rows.forEach(r => { map[r.event] = parseInt(r.total) || 0 })
    const stages = ORDER.map(name => ({ name, total: map[name] || 0 }))

    return { mock: false, days, stages }
  } catch (err) {
    console.error('[Databricks] getFunnelStages error:', err.message)
    return { mock: true, error: err.message, stages: getMockFunnelStages() }
  }
}

// Motivos de perda agregados nos últimos N dias
async function getLostReasons(days = 30) {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, reasons: getMockLostReasons() }

  try {
    const data = await executeStatement(
      `SELECT motivo_lost, COUNT(*) as total
       FROM production.diamond.funil_comercial
       WHERE event = 'Perdido'
         AND event_timestamp >= CURRENT_DATE - INTERVAL ${days} DAYS
         AND motivo_lost IS NOT NULL AND motivo_lost != ''
       GROUP BY motivo_lost
       ORDER BY total DESC
       LIMIT 10`,
      30
    )
    const { rows } = parseResult(data)
    const reasons = rows.map(r => ({ reason: r.motivo_lost, total: parseInt(r.total) || 0 }))
    return { mock: false, days, reasons }
  } catch (err) {
    console.error('[Databricks] getLostReasons error:', err.message)
    return { mock: true, error: err.message, reasons: getMockLostReasons() }
  }
}

// Top produtos vendidos (Ganho) nos últimos N dias
async function getTopProducts(days = 30) {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, products: getMockProducts() }

  try {
    const data = await executeStatement(
      `SELECT produto, bu, COUNT(*) as deals, SUM(valor) as receita
       FROM production.diamond.customer_360_sales_table
       WHERE event = 'Ganho'
         AND event_at >= CAST(CURRENT_DATE - INTERVAL ${days} DAYS AS STRING)
         AND produto IS NOT NULL AND produto != ''
       GROUP BY produto, bu
       ORDER BY deals DESC
       LIMIT 15`,
      30
    )
    const { rows } = parseResult(data)
    const products = rows.map(r => ({
      produto: r.produto,
      bu: r.bu,
      deals: parseInt(r.deals) || 0,
      receita: parseFloat(r.receita) || 0,
    }))
    return { mock: false, days, products }
  } catch (err) {
    console.error('[Databricks] getTopProducts error:', err.message)
    return { mock: true, error: err.message, products: getMockProducts() }
  }
}

// Funil de marketing: leads por camada + UTM sources
async function getMarketingFunnel(days = 30) {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, layers: getMockMarketingLayers() }

  try {
    const data = await executeStatement(
      `SELECT camada_funil, event, COUNT(*) as total
       FROM production.diamond.funil_marketing
       WHERE event_at >= CURRENT_DATE - INTERVAL ${days} DAYS
         AND camada_funil IN ('negociacao_deal','paid_media')
         AND event IN ('mql','sal','opp','won','lost',
                       'facebook_clicks','facebook_spend','facebook_reach',
                       'google_clicks','google_spend','google_impressions')
       GROUP BY camada_funil, event
       ORDER BY camada_funil, total DESC`,
      30
    )
    const { rows } = parseResult(data)
    return { mock: false, days, rows }
  } catch (err) {
    console.error('[Databricks] getMarketingFunnel error:', err.message)
    return { mock: true, error: err.message, rows: [] }
  }
}

// Tendência diária de Ganhos e Perdidos nos últimos N dias
async function getFunnelTrend(days = 30) {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, trend: getMockTrend() }

  try {
    const data = await executeStatement(
      `SELECT DATE(event_timestamp) as dia,
              SUM(CASE WHEN event = 'Ganho' THEN 1 ELSE 0 END) as ganhos,
              SUM(CASE WHEN event = 'Perdido' THEN 1 ELSE 0 END) as perdidos,
              SUM(CASE WHEN event = 'MQL' THEN 1 ELSE 0 END) as mqls
       FROM production.diamond.funil_comercial
       WHERE event_timestamp >= CURRENT_DATE - INTERVAL ${days} DAYS
         AND event IN ('Ganho','Perdido','MQL')
       GROUP BY DATE(event_timestamp)
       ORDER BY dia`,
      30
    )
    const { rows } = parseResult(data)
    const trend = rows.map(r => ({
      dia: r.dia,
      ganhos: parseInt(r.ganhos) || 0,
      perdidos: parseInt(r.perdidos) || 0,
      mqls: parseInt(r.mqls) || 0,
    }))
    return { mock: false, days, trend }
  } catch (err) {
    console.error('[Databricks] getFunnelTrend error:', err.message)
    return { mock: true, error: err.message, trend: getMockTrend() }
  }
}

// ─── Mock data para funil ─────────────────────────────────────────────────────
function getMockFunnelStages() {
  return [
    { name: 'MQL',        total: 2400 },
    { name: 'SAL',        total: 1200 },
    { name: 'Oportunidade', total: 800 },
    { name: 'Conectado',  total: 620 },
    { name: 'Agendado',   total: 450 },
    { name: 'Negociação', total: 290 },
    { name: 'Ganho',      total: 185 },
    { name: 'Perdido',    total: 1100 },
  ]
}

function getMockLostReasons() {
  return [
    { reason: '[Validação] Fora do SLA de SAL', total: 380 },
    { reason: '[SDR] Falta de Conexão', total: 310 },
    { reason: '[FS] Não demonstrou interesse', total: 90 },
    { reason: '[Negociação] Falta de budget', total: 75 },
    { reason: '[Qualquer etapa] Ghosting', total: 60 },
  ]
}

function getMockProducts() {
  return [
    { produto: 'G4 Implementação de IA', bu: 'Sprints', deals: 24, receita: 1070000 },
    { produto: 'G4 Traction', bu: 'Imersões', deals: 20, receita: 458000 },
    { produto: 'G4 Gestão e Estratégia', bu: 'Imersões', deals: 18, receita: 456000 },
    { produto: 'G4 Club', bu: 'Club', deals: 12, receita: 1159000 },
    { produto: 'Skills', bu: 'Skills', deals: 45, receita: 52000 },
  ]
}

function getMockMarketingLayers() {
  return []
}

function getMockTrend() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return {
      dia: d.toISOString().slice(0, 10),
      ganhos: Math.floor(Math.random() * 20) + 5,
      perdidos: Math.floor(Math.random() * 40) + 20,
      mqls: Math.floor(Math.random() * 100) + 60,
    }
  })
}

module.exports = {
  getStatus, listTables, previewTable,
  getFunnelStages, getLostReasons, getTopProducts, getMarketingFunnel, getFunnelTrend,
}
