/**
 * server/databricks.cjs
 * Integração com Databricks SQL REST API.
 * Usa Personal Access Token + SQL Warehouse HTTP Path.
 */

const fetch = require('node-fetch')
const { loadConfig } = require('./config.cjs')

// ─── Cache em memória — TTL 5 minutos ────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000   // 5 min
const _cache = new Map()

function cacheGet(key) {
  const entry = _cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null }
  return entry.value
}
function cacheSet(key, value) { _cache.set(key, { value, ts: Date.now() }) }
function cacheClear(key) {
  if (key) { _cache.delete(key) } else { _cache.clear() }
}
// Wrapper: se há cache válido retorna direto; senão executa fn() e armazena
async function withCache(key, fn) {
  const hit = cacheGet(key)
  if (hit !== null) return hit
  const result = await fn()
  cacheSet(key, result)
  return result
}

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

// ─── Tela de Comparação (GA4 × Meta × CRM) ───────────────────────────────────

// Funil por canal de marketing (Paid/Social/CRM/Orgânico)
async function getCompareByChannel(days = 30) {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, channels: getMockChannels() }
  try {
    const data = await executeStatement(
      `SELECT
         COALESCE(area_geracao_demanda, CASE
           WHEN utm_source IN ('facebook','instagram') THEN 'Paid'
           WHEN utm_source = 'google' THEN 'Paid'
           WHEN utm_source = 'prospeccao' THEN 'CRM'
           ELSE 'Outros'
         END, 'Outros') as canal,
         SUM(CASE WHEN event = 'mql'  THEN 1 ELSE 0 END) as mqls,
         SUM(CASE WHEN event = 'sal'  THEN 1 ELSE 0 END) as sals,
         SUM(CASE WHEN event = 'opp'  THEN 1 ELSE 0 END) as opps,
         SUM(CASE WHEN event = 'won'  THEN 1 ELSE 0 END) as ganhos,
         SUM(CASE WHEN event = 'lost' THEN 1 ELSE 0 END) as perdidos
       FROM production.diamond.funil_marketing
       WHERE camada_funil = 'negociacao_deal'
         AND event_at >= CURRENT_DATE - INTERVAL ${days} DAYS
         AND event IN ('mql','sal','opp','won','lost')
       GROUP BY 1
       ORDER BY mqls DESC`, 35
    )
    const { rows } = parseResult(data)
    const channels = rows.map(r => ({
      canal: r.canal,
      mqls: parseInt(r.mqls) || 0,
      sals: parseInt(r.sals) || 0,
      opps: parseInt(r.opps) || 0,
      ganhos: parseInt(r.ganhos) || 0,
      perdidos: parseInt(r.perdidos) || 0,
    }))
    return { mock: false, days, channels }
  } catch (err) {
    console.error('[Databricks] getCompareByChannel error:', err.message)
    return { mock: true, error: err.message, channels: getMockChannels() }
  }
}

// Investimento mídia paga × resultado no funil (Meta + Google)
async function getMediaROI(days = 30) {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, media: getMockMediaROI() }
  try {
    const [spendData, resultData] = await Promise.all([
      executeStatement(
        `SELECT
           CASE WHEN event LIKE 'facebook%' THEN 'Meta' ELSE 'Google' END as plataforma,
           SUM(CASE WHEN event IN ('facebook_spend','google_spend') THEN event_value ELSE 0 END) as gasto,
           SUM(CASE WHEN event IN ('facebook_clicks','google_clicks') THEN event_value ELSE 0 END) as cliques,
           SUM(CASE WHEN event IN ('facebook_impressions','google_impressions') THEN event_value ELSE 0 END) as impressoes
         FROM production.diamond.funil_marketing
         WHERE camada_funil = 'paid_media'
           AND event_at >= CURRENT_DATE - INTERVAL ${days} DAYS
         GROUP BY 1`, 30
      ),
      executeStatement(
        `SELECT
           CASE
             WHEN utm_source IN ('facebook','instagram') THEN 'Meta'
             WHEN utm_source = 'google' THEN 'Google'
           END as plataforma,
           SUM(CASE WHEN event = 'mql'  THEN 1 ELSE 0 END) as mqls,
           SUM(CASE WHEN event = 'won'  THEN 1 ELSE 0 END) as ganhos
         FROM production.diamond.funil_marketing
         WHERE camada_funil = 'negociacao_deal'
           AND event_at >= CURRENT_DATE - INTERVAL ${days} DAYS
           AND utm_source IN ('facebook','instagram','google')
           AND event IN ('mql','won')
         GROUP BY 1`, 30
      ),
    ])
    const spendRows = parseResult(spendData).rows
    const resultRows = parseResult(resultData).rows

    // Merge por plataforma
    const map = {}
    spendRows.forEach(r => {
      map[r.plataforma] = {
        plataforma: r.plataforma,
        gasto: parseFloat(r.gasto) || 0,
        cliques: parseFloat(r.cliques) || 0,
        impressoes: parseFloat(r.impressoes) || 0,
        mqls: 0, ganhos: 0,
      }
    })
    resultRows.forEach(r => {
      if (!r.plataforma) return
      if (!map[r.plataforma]) map[r.plataforma] = { plataforma: r.plataforma, gasto: 0, cliques: 0, impressoes: 0 }
      map[r.plataforma].mqls   = parseInt(r.mqls) || 0
      map[r.plataforma].ganhos = parseInt(r.ganhos) || 0
    })

    const media = Object.values(map).map(m => ({
      ...m,
      cpl: m.mqls > 0 ? m.gasto / m.mqls : 0,        // custo por lead
      cpv: m.ganhos > 0 ? m.gasto / m.ganhos : 0,     // custo por venda
    }))
    return { mock: false, days, media }
  } catch (err) {
    console.error('[Databricks] getMediaROI error:', err.message)
    return { mock: true, error: err.message, media: getMockMediaROI() }
  }
}

// Receita real por canal (customer_360 × funil_marketing)
async function getRevenueByChannel(days = 30) {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, channels: getMockRevenueChannels() }
  try {
    const data = await executeStatement(
      `SELECT
         COALESCE(s.area_geracao_demanda,
           CASE WHEN s.utm_source IN ('facebook','instagram') THEN 'Paid'
                WHEN s.utm_source = 'google' THEN 'Paid'
                WHEN s.utm_source = 'prospeccao' THEN 'CRM'
                ELSE 'Outros' END, 'Outros') as canal,
         s.utm_source,
         COUNT(DISTINCT c.deal_id) as deals,
         ROUND(SUM(c.valor), 0) as receita
       FROM production.diamond.customer_360_sales_table c
       LEFT JOIN production.diamond.funil_marketing s
         ON c.deal_id = s.deal_id AND s.event = 'mql'
       WHERE c.event = 'Ganho'
         AND c.event_at >= CAST(CURRENT_DATE - INTERVAL ${days} DAYS AS STRING)
       GROUP BY 1, 2
       ORDER BY receita DESC
       LIMIT 15`, 35
    )
    const { rows } = parseResult(data)
    const channels = rows.map(r => ({
      canal: r.canal,
      utm_source: r.utm_source,
      deals: parseInt(r.deals) || 0,
      receita: parseFloat(r.receita) || 0,
    }))
    return { mock: false, days, channels }
  } catch (err) {
    console.error('[Databricks] getRevenueByChannel error:', err.message)
    return { mock: true, error: err.message, channels: getMockRevenueChannels() }
  }
}

// Conversão por perfil ICP
async function getConversionByProfile(days = 30) {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, profiles: getMockProfiles() }
  try {
    const data = await executeStatement(
      `SELECT
         CASE
           WHEN perfil IS NOT NULL THEN perfil
           WHEN pipeline_name LIKE '%Selfcheckout%' THEN 'Compra Direta'
           WHEN pipeline_name LIKE '%Inside Sales%' THEN 'Inside Sales'
           WHEN pipeline_name LIKE '%Field Sales%'  THEN 'Field Sales'
           WHEN pipeline_name LIKE '%Expansão%' OR pipeline_name LIKE '%Retenção%' THEN 'CS / Base'
           WHEN pipeline_name LIKE '%Skills%'   THEN 'G4 Skills'
           WHEN pipeline_name LIKE '%Scale%' OR pipeline_name LIKE '%Renovação%'  THEN 'Renovação'
           WHEN pipeline_name = 'Comercial'    THEN 'Comercial'
           ELSE COALESCE(pipeline_name, 'Outros')
         END AS perfil,
         SUM(CASE WHEN event = 'mql'  THEN 1 ELSE 0 END) as mqls,
         SUM(CASE WHEN event = 'won'  THEN 1 ELSE 0 END) as ganhos,
         SUM(CASE WHEN event = 'lost' THEN 1 ELSE 0 END) as perdidos,
         ROUND(100.0 * SUM(CASE WHEN event = 'won' THEN 1 ELSE 0 END) /
           NULLIF(SUM(CASE WHEN event = 'mql' THEN 1 ELSE 0 END), 0), 1) as conv_pct
       FROM production.diamond.funil_marketing
       WHERE event_at >= CURRENT_DATE - INTERVAL ${days} DAYS
         AND event IN ('mql','won','lost')
       GROUP BY
         CASE
           WHEN perfil IS NOT NULL THEN perfil
           WHEN pipeline_name LIKE '%Selfcheckout%' THEN 'Compra Direta'
           WHEN pipeline_name LIKE '%Inside Sales%' THEN 'Inside Sales'
           WHEN pipeline_name LIKE '%Field Sales%'  THEN 'Field Sales'
           WHEN pipeline_name LIKE '%Expansão%' OR pipeline_name LIKE '%Retenção%' THEN 'CS / Base'
           WHEN pipeline_name LIKE '%Skills%'   THEN 'G4 Skills'
           WHEN pipeline_name LIKE '%Scale%' OR pipeline_name LIKE '%Renovação%'  THEN 'Renovação'
           WHEN pipeline_name = 'Comercial'    THEN 'Comercial'
           ELSE COALESCE(pipeline_name, 'Outros')
         END
       ORDER BY mqls DESC`, 30
    )
    const { rows } = parseResult(data)
    const profiles = rows.map(r => ({
      perfil: r.perfil,
      mqls: parseInt(r.mqls) || 0,
      ganhos: parseInt(r.ganhos) || 0,
      perdidos: parseInt(r.perdidos) || 0,
      conv_pct: parseFloat(r.conv_pct) || 0,
    }))
    return { mock: false, days, profiles }
  } catch (err) {
    console.error('[Databricks] getConversionByProfile error:', err.message)
    return { mock: true, error: err.message, profiles: getMockProfiles() }
  }
}

// Top campanhas Meta: MQL → Ganho
async function getTopCampaigns(days = 30) {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, campaigns: getMockCampaigns() }
  try {
    const data = await executeStatement(
      `SELECT
         COALESCE(utm_campaign, '(sem campanha)') as campanha,
         utm_source as plataforma,
         COUNT(DISTINCT deal_id) as deals_atingidos,
         SUM(CASE WHEN event = 'mql'  THEN 1 ELSE 0 END) as mqls,
         SUM(CASE WHEN event = 'won'  THEN 1 ELSE 0 END) as ganhos,
         ROUND(100.0 * SUM(CASE WHEN event = 'won' THEN 1 ELSE 0 END) /
           NULLIF(SUM(CASE WHEN event = 'mql' THEN 1 ELSE 0 END), 0), 1) as conv_pct
       FROM production.diamond.funil_marketing
       WHERE camada_funil = 'negociacao_deal'
         AND event_at >= CURRENT_DATE - INTERVAL ${days} DAYS
         AND utm_source IN ('facebook','instagram','google')
         AND event IN ('mql','won','lost')
         AND utm_campaign IS NOT NULL AND utm_campaign != ''
       GROUP BY utm_campaign, utm_source
       ORDER BY mqls DESC
       LIMIT 12`, 30
    )
    const { rows } = parseResult(data)
    const campaigns = rows.map(r => ({
      campanha: r.campanha,
      plataforma: r.plataforma,
      deals: parseInt(r.deals_atingidos) || 0,
      mqls: parseInt(r.mqls) || 0,
      ganhos: parseInt(r.ganhos) || 0,
      conv_pct: parseFloat(r.conv_pct) || 0,
    }))
    return { mock: false, days, campaigns }
  } catch (err) {
    console.error('[Databricks] getTopCampaigns error:', err.message)
    return { mock: true, error: err.message, campaigns: getMockCampaigns() }
  }
}

// ─── Resumo Executivo: KPIs do dia para o Dashboard ──────────────────────────
async function getExecutiveSummary() {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, ...getMockExecutiveSummary() }
  try {
    const data = await executeStatement(
      `SELECT
         -- Hoje
         SUM(CASE WHEN DATE(event_at) = CURRENT_DATE AND event = 'mql'  THEN 1 ELSE 0 END) AS mqls_hoje,
         SUM(CASE WHEN DATE(event_at) = CURRENT_DATE AND event = 'won'  THEN 1 ELSE 0 END) AS ganhos_hoje,
         SUM(CASE WHEN DATE(event_at) = CURRENT_DATE AND event = 'lost' THEN 1 ELSE 0 END) AS perdidos_hoje,
         -- Ontem
         SUM(CASE WHEN DATE(event_at) = CURRENT_DATE - INTERVAL 1 DAY AND event = 'mql'  THEN 1 ELSE 0 END) AS mqls_ontem,
         SUM(CASE WHEN DATE(event_at) = CURRENT_DATE - INTERVAL 1 DAY AND event = 'won'  THEN 1 ELSE 0 END) AS ganhos_ontem,
         -- Semana (7d)
         SUM(CASE WHEN event_at >= CAST(CURRENT_DATE - INTERVAL 7 DAYS AS STRING) AND event = 'mql'  THEN 1 ELSE 0 END) AS mqls_7d,
         SUM(CASE WHEN event_at >= CAST(CURRENT_DATE - INTERVAL 7 DAYS AS STRING) AND event = 'won'  THEN 1 ELSE 0 END) AS ganhos_7d,
         -- Semana anterior (7d-14d para comparar)
         SUM(CASE WHEN event_at >= CAST(CURRENT_DATE - INTERVAL 14 DAYS AS STRING)
                   AND event_at <  CAST(CURRENT_DATE - INTERVAL 7  DAYS AS STRING)
                   AND event = 'mql'  THEN 1 ELSE 0 END) AS mqls_semana_ant,
         SUM(CASE WHEN event_at >= CAST(CURRENT_DATE - INTERVAL 14 DAYS AS STRING)
                   AND event_at <  CAST(CURRENT_DATE - INTERVAL 7  DAYS AS STRING)
                   AND event = 'won'  THEN 1 ELSE 0 END) AS ganhos_semana_ant,
         -- Receita 7d
         ROUND(SUM(CASE WHEN event_at >= CAST(CURRENT_DATE - INTERVAL 7 DAYS AS STRING)
                         AND event = 'won' THEN COALESCE(revenue, 0) ELSE 0 END), 0) AS receita_7d,
         ROUND(SUM(CASE WHEN event_at >= CAST(CURRENT_DATE - INTERVAL 14 DAYS AS STRING)
                         AND event_at <  CAST(CURRENT_DATE - INTERVAL 7  DAYS AS STRING)
                         AND event = 'won' THEN COALESCE(revenue, 0) ELSE 0 END), 0) AS receita_semana_ant
       FROM production.diamond.funil_marketing
       WHERE event_at >= CAST(CURRENT_DATE - INTERVAL 14 DAYS AS STRING)
         AND event IN ('mql','won','lost')`, 35
    )
    const { rows } = parseResult(data)
    const r = rows[0] || {}
    const mqls_hoje       = parseInt(r.mqls_hoje)       || 0
    const ganhos_hoje     = parseInt(r.ganhos_hoje)     || 0
    const mqls_ontem      = parseInt(r.mqls_ontem)      || 0
    const ganhos_ontem    = parseInt(r.ganhos_ontem)    || 0
    const mqls_7d         = parseInt(r.mqls_7d)         || 0
    const ganhos_7d       = parseInt(r.ganhos_7d)       || 0
    const mqls_ant        = parseInt(r.mqls_semana_ant) || 0
    const ganhos_ant      = parseInt(r.ganhos_semana_ant) || 0
    const receita_7d      = parseFloat(r.receita_7d)    || 0
    const receita_ant     = parseFloat(r.receita_semana_ant) || 0

    const conv_7d  = mqls_7d  > 0 ? parseFloat(((ganhos_7d  / mqls_7d)  * 100).toFixed(1)) : 0
    const conv_ant = mqls_ant > 0 ? parseFloat(((ganhos_ant / mqls_ant) * 100).toFixed(1)) : 0

    // Deltas (absoluto)
    const delta_mqls    = mqls_hoje - mqls_ontem
    const delta_ganhos  = ganhos_hoje - ganhos_ontem
    const delta_conv    = parseFloat((conv_7d - conv_ant).toFixed(1))
    const delta_receita = receita_7d - receita_ant

    return {
      mock: false,
      mqls_hoje, mqls_ontem, delta_mqls,
      ganhos_hoje, ganhos_ontem, delta_ganhos,
      conv_7d, conv_ant, delta_conv,
      receita_7d, receita_ant, delta_receita,
      mqls_7d, ganhos_7d,
    }
  } catch (err) {
    console.error('[Databricks] getExecutiveSummary error:', err.message)
    return { mock: true, error: err.message, ...getMockExecutiveSummary() }
  }
}

function getMockExecutiveSummary() {
  return {
    mqls_hoje: 146, mqls_ontem: 741, delta_mqls: -595,
    ganhos_hoje: 15, ganhos_ontem: 79, delta_ganhos: -64,
    conv_7d: 7.0, conv_ant: 6.2, delta_conv: 0.8,
    receita_7d: 4744621, receita_ant: 3980000, delta_receita: 764621,
    mqls_7d: 5768, ganhos_7d: 402,
  }
}

// ─── Orgânico vs Pago: funil completo por fonte ──────────────────────────────
async function getOrganicVsPaid(days = 30) {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, sources: getMockOrganicVsPaid() }
  try {
    const data = await executeStatement(
      `SELECT
         CASE
           WHEN utm_medium = 'cpc'                        THEN 'Pago'
           WHEN utm_source IS NULL
             OR utm_source IN ('null','','(direct)')      THEN 'Direto/Sem UTM'
           ELSE 'Orgânico'
         END AS canal,
         COALESCE(utm_source, '(direto)') AS fonte,
         SUM(CASE WHEN event = 'mql'  THEN 1 ELSE 0 END) AS mqls,
         SUM(CASE WHEN event = 'won'  THEN 1 ELSE 0 END) AS ganhos,
         SUM(CASE WHEN event = 'lost' THEN 1 ELSE 0 END) AS perdidos,
         ROUND(SUM(CASE WHEN event = 'won' THEN COALESCE(revenue, 0) ELSE 0 END), 0) AS receita,
         ROUND(100.0 * SUM(CASE WHEN event = 'won' THEN 1 ELSE 0 END) /
           NULLIF(SUM(CASE WHEN event = 'mql' THEN 1 ELSE 0 END), 0), 1) AS conv_pct
       FROM production.diamond.funil_marketing
       WHERE event_at >= CAST(CURRENT_DATE - INTERVAL ${days} DAYS AS STRING)
         AND event IN ('mql','won','lost')
       GROUP BY 1, 2
       ORDER BY mqls DESC
       LIMIT 35`, 35
    )
    const { rows } = parseResult(data)
    const sources = rows.map(r => ({
      canal:    r.canal,
      fonte:    r.fonte,
      mqls:     parseInt(r.mqls)      || 0,
      ganhos:   parseInt(r.ganhos)    || 0,
      perdidos: parseInt(r.perdidos)  || 0,
      receita:  parseFloat(r.receita) || 0,
      conv_pct: parseFloat(r.conv_pct) || 0,
    }))

    // Totais agregados por canal (3 buckets)
    const totals = {
      'Pago':          { mqls: 0, ganhos: 0, receita: 0 },
      'Orgânico':      { mqls: 0, ganhos: 0, receita: 0 },
      'Direto/Sem UTM':{ mqls: 0, ganhos: 0, receita: 0 },
    }
    sources.forEach(s => {
      const t = totals[s.canal]
      if (t) { t.mqls += s.mqls; t.ganhos += s.ganhos; t.receita += s.receita }
    })
    Object.keys(totals).forEach(k => {
      totals[k].conv_pct = totals[k].mqls > 0
        ? parseFloat(((totals[k].ganhos / totals[k].mqls) * 100).toFixed(1)) : 0
    })

    return { mock: false, days, sources, totals }
  } catch (err) {
    console.error('[Databricks] getOrganicVsPaid error:', err.message)
    return { mock: true, error: err.message, sources: getMockOrganicVsPaid(), totals: {} }
  }
}

function getMockOrganicVsPaid() {
  return [
    { canal: 'Pago',           fonte: 'facebook',   mqls: 9941, ganhos: 995, perdidos: 6890, receita: 4011332, conv_pct: 10.0 },
    { canal: 'Pago',           fonte: 'google',     mqls: 2038, ganhos: 150, perdidos: 2427, receita: 848092,  conv_pct: 7.4  },
    { canal: 'Orgânico',       fonte: 'instagram',  mqls: 3262, ganhos: 146, perdidos: 4008, receita: 3670210, conv_pct: 4.5  },
    { canal: 'Orgânico',       fonte: 'hubspot',    mqls: 2835, ganhos: 283, perdidos: 2427, receita: 2446839, conv_pct: 10.0 },
    { canal: 'Orgânico',       fonte: 'produto',    mqls: 940,  ganhos: 73,  perdidos: 1109, receita: 8558089, conv_pct: 7.8  },
    { canal: 'Orgânico',       fonte: 'prospeccao', mqls: 563,  ganhos: 125, perdidos: 447,  receita: 3851799, conv_pct: 22.2 },
    { canal: 'Direto/Sem UTM', fonte: '(direto)',   mqls: 1705, ganhos: 120, perdidos: 980,  receita: 890000,  conv_pct: 7.0  },
  ]
}

// ─── Atribuição: Form → Lead → MQL → Venda ────────────────────────────────────
// Funil completo de formulário até venda, com internal_ref quando disponível
async function getFormAttribution(days = 30) {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, rows: getMockFormAttribution(), summary: getMockFormSummary() }
  try {
    // Query principal: funil form→lead→mql→venda por produto + fonte
    const [funnelData, internalRefData] = await Promise.all([
      executeStatement(
        `SELECT
           COALESCE(fe.product_slug, 'sem_produto') as produto,
           COALESCE(fe.utm_source, 'desconhecido') as utm_source,
           COALESCE(fe.utm_medium, '') as utm_medium,
           COUNT(DISTINCT CASE WHEN fe.event = 'form_started'   THEN fe.lead_id END) as form_iniciados,
           COUNT(DISTINCT CASE WHEN fe.event = 'form_completed' THEN fe.lead_id END) as form_completados,
           COUNT(DISTINCT CASE WHEN fm.event = 'mql' THEN fm.deal_id END) as mqls,
           COUNT(DISTINCT CASE WHEN c.event = 'Ganho' THEN c.deal_id END) as vendas,
           ROUND(SUM(CASE WHEN c.event = 'Ganho' THEN COALESCE(c.valor, 0) ELSE 0 END), 0) as receita
         FROM production.gold.forms_g4_events fe
         LEFT JOIN production.diamond.funil_marketing fm
           ON fe.lead_id = fm.lead_id AND fm.event = 'mql'
         LEFT JOIN production.diamond.customer_360_sales_table c
           ON COALESCE(fe.deal_id, fm.deal_id) = c.deal_id
         WHERE fe.event_at >= CURRENT_DATE - INTERVAL ${days} DAYS
           AND fe.product_slug IS NOT NULL AND fe.product_slug != ''
         GROUP BY 1, 2, 3
         ORDER BY form_completados DESC
         LIMIT 20`, 35
      ),
      // GA4: internal_ref mais usados no período
      executeStatement(
        `SELECT
           REGEXP_EXTRACT(ep.value.string_value, '[?&]internal_ref=([^&]+)', 1) as internal_ref,
           traffic_source.source as utm_source,
           traffic_source.medium as utm_medium,
           COUNT(*) as form_submits_ga4
         FROM production.silver.google_analytics_events
         LATERAL VIEW EXPLODE(event_params) t AS ep
         WHERE event_name = 'form_submit'
           AND ep.key = 'page_location'
           AND event_date >= CAST(CURRENT_DATE - INTERVAL ${days} DAYS AS STRING)
           AND ep.value.string_value LIKE '%internal_ref%'
         GROUP BY 1, 2, 3
         ORDER BY form_submits_ga4 DESC
         LIMIT 15`, 35
      ),
    ])

    const { rows: funnelRows } = parseResult(funnelData)
    const { rows: refRows }    = parseResult(internalRefData)

    const rows = funnelRows.map(r => ({
      produto:           r.produto,
      utm_source:        r.utm_source,
      utm_medium:        r.utm_medium,
      form_iniciados:    parseInt(r.form_iniciados)   || 0,
      form_completados:  parseInt(r.form_completados) || 0,
      mqls:              parseInt(r.mqls)              || 0,
      vendas:            parseInt(r.vendas)            || 0,
      receita:           parseFloat(r.receita)         || 0,
      // taxas calculadas
      taxa_conclusao: r.form_iniciados > 0
        ? parseFloat(((r.form_completados / r.form_iniciados) * 100).toFixed(1)) : 0,
      taxa_mql: r.form_completados > 0
        ? parseFloat(((r.mqls / r.form_completados) * 100).toFixed(1)) : 0,
      taxa_venda: r.mqls > 0
        ? parseFloat(((r.vendas / r.mqls) * 100).toFixed(1)) : 0,
    }))

    const internalRefs = refRows.map(r => ({
      internal_ref:      r.internal_ref,
      utm_source:        r.utm_source,
      utm_medium:        r.utm_medium,
      form_submits_ga4:  parseInt(r.form_submits_ga4) || 0,
    }))

    // Summary agregado
    const summary = {
      total_form_iniciados:   rows.reduce((a, r) => a + r.form_iniciados, 0),
      total_form_completados: rows.reduce((a, r) => a + r.form_completados, 0),
      total_mqls:             rows.reduce((a, r) => a + r.mqls, 0),
      total_vendas:           rows.reduce((a, r) => a + r.vendas, 0),
      total_receita:          rows.reduce((a, r) => a + r.receita, 0),
    }

    return { mock: false, days, rows, internalRefs, summary }
  } catch (err) {
    console.error('[Databricks] getFormAttribution error:', err.message)
    return { mock: true, error: err.message, rows: getMockFormAttribution(), summary: getMockFormSummary() }
  }
}

function getMockFormAttribution() {
  return [
    { produto: 'g4-skills',      utm_source: 'hubspot',   utm_medium: 'whatsapp', form_iniciados: 1239, form_completados: 1051, mqls: 556, vendas: 4,  receita: 452673, taxa_conclusao: 84.8, taxa_mql: 52.9, taxa_venda: 0.7 },
    { produto: 'g4-club',        utm_source: 'instagram', utm_medium: 'g4club',   form_iniciados: 352,  form_completados: 110,  mqls: 62,  vendas: 0,  receita: 0,      taxa_conclusao: 31.3, taxa_mql: 56.4, taxa_venda: 0   },
    { produto: 'g4-scale',       utm_source: 'instagram', utm_medium: 'g4scale',  form_iniciados: 129,  form_completados: 52,   mqls: 31,  vendas: 1,  receita: 674100, taxa_conclusao: 40.3, taxa_mql: 59.6, taxa_venda: 3.2 },
    { produto: 'g4-traction',    utm_source: 'google',    utm_medium: 'cpc',      form_iniciados: 88,   form_completados: 44,   mqls: 30,  vendas: 2,  receita: 180000, taxa_conclusao: 50.0, taxa_mql: 68.2, taxa_venda: 6.7 },
  ]
}
function getMockFormSummary() {
  return { total_form_iniciados: 1808, total_form_completados: 1257, total_mqls: 679, total_vendas: 7, total_receita: 1306773 }
}

// ─── Mock data para comparação ────────────────────────────────────────────────
function getMockChannels() {
  return [
    { canal: 'Paid',    mqls: 9925, sals: 5444, opps: 1120, ganhos: 748, perdidos: 7061 },
    { canal: 'Social',  mqls: 2899, sals: 2317, opps: 741,  ganhos: 135, perdidos: 3615 },
    { canal: 'CRM',     mqls: 2308, sals: 1778, opps: 502,  ganhos: 95,  perdidos: 2729 },
    { canal: 'Orgânico',mqls: 496,  sals: 255,  opps: 87,   ganhos: 12,  perdidos: 608  },
    { canal: 'Outros',  mqls: 2300, sals: 800,  opps: 200,  ganhos: 120, perdidos: 1500 },
  ]
}
function getMockMediaROI() {
  return [
    { plataforma: 'Meta',   gasto: 6663430, cliques: 1933684, impressoes: 149151437, mqls: 9925, ganhos: 748, cpl: 671, cpv: 8908 },
    { plataforma: 'Google', gasto: 561189,  cliques: 151013,  impressoes: 3002336,   mqls: 1690, ganhos: 105, cpl: 332, cpv: 5345 },
  ]
}
function getMockRevenueChannels() {
  return [
    { canal: 'Paid', utm_source: 'facebook', deals: 628, receita: 2876233 },
    { canal: 'CRM',  utm_source: 'prospeccao', deals: 122, receita: 3765374 },
    { canal: 'Social', utm_source: 'instagram', deals: 77, receita: 2047234 },
  ]
}
function getMockProfiles() {
  return [
    { perfil: 'C', mqls: 6277, ganhos: 463, perdidos: 6179, conv_pct: 7.4 },
    { perfil: 'J', mqls: 3978, ganhos: 182, perdidos: 3679, conv_pct: 4.6 },
    { perfil: 'A', mqls: 2859, ganhos: 287, perdidos: 3017, conv_pct: 10.0 },
    { perfil: 'K', mqls: 2283, ganhos: 309, perdidos: 1837, conv_pct: 13.5 },
    { perfil: 'I', mqls: 3687, ganhos: 197, perdidos: 3646, conv_pct: 5.3 },
  ]
}
function getMockCampaigns() {
  return [
    { campanha: 'always-on', plataforma: 'instagram', deals: 3688, mqls: 2674, ganhos: 118, conv_pct: 4.4 },
    { campanha: 'adsfb_g4_bau457_lgen_isca-ote_bofu', plataforma: 'facebook', deals: 2316, mqls: 2316, ganhos: 4, conv_pct: 0.2 },
  ]
}

// ─── Analytics: série histórica longa + projeção linear ──────────────────────
// Retorna MQL/Ganho/Perdido diário por N dias + projeção para os próximos 14
async function getAnalyticsTrend(days = 90) {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, trend: getMockAnalyticsTrend(days), projection: getMockProjection() }
  try {
    const data = await executeStatement(
      `SELECT DATE(event_at) as dia,
              SUM(CASE WHEN event = 'mql'  THEN 1 ELSE 0 END) as mqls,
              SUM(CASE WHEN event = 'won'  THEN 1 ELSE 0 END) as ganhos,
              SUM(CASE WHEN event = 'lost' THEN 1 ELSE 0 END) as perdidos
       FROM production.diamond.funil_marketing
       WHERE event_at >= CAST(CURRENT_DATE - INTERVAL ${days} DAYS AS STRING)
         AND event IN ('mql','won','lost')
       GROUP BY DATE(event_at)
       ORDER BY dia`, 35
    )
    const { rows } = parseResult(data)
    const trend = rows.map(r => ({
      dia:      r.dia,
      mqls:     parseInt(r.mqls)     || 0,
      ganhos:   parseInt(r.ganhos)   || 0,
      perdidos: parseInt(r.perdidos) || 0,
    }))
    const projection = buildLinearProjection(trend, 14)
    return { mock: false, days, trend, projection }
  } catch (err) {
    console.error('[Databricks] getAnalyticsTrend error:', err.message)
    return { mock: true, error: err.message, trend: getMockAnalyticsTrend(days), projection: getMockProjection() }
  }
}

// Regressão linear simples (mínimos quadrados) sobre série de MQLs
function buildLinearProjection(trend, forecastDays = 14) {
  if (trend.length < 7) return []
  const n = trend.length
  const xMean = (n - 1) / 2
  const yMean = trend.reduce((s, r) => s + r.mqls, 0) / n
  let num = 0, den = 0
  trend.forEach((r, i) => { num += (i - xMean) * (r.mqls - yMean); den += (i - xMean) ** 2 })
  const slope = den !== 0 ? num / den : 0
  const intercept = yMean - slope * xMean

  const lastDate = new Date(trend[trend.length - 1].dia)
  return Array.from({ length: forecastDays }, (_, i) => {
    const d = new Date(lastDate)
    d.setDate(d.getDate() + i + 1)
    const projected = Math.max(0, Math.round(intercept + slope * (n + i)))
    return { dia: d.toISOString().slice(0, 10), mqls_proj: projected }
  })
}

function getMockAnalyticsTrend(days) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i))
    const base = 180 + Math.sin(i / 7) * 30
    return {
      dia:      d.toISOString().slice(0, 10),
      mqls:     Math.round(base + Math.random() * 40),
      ganhos:   Math.round(base * 0.07 + Math.random() * 5),
      perdidos: Math.round(base * 0.45 + Math.random() * 20),
    }
  })
}
function getMockProjection() {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i + 1)
    return { dia: d.toISOString().slice(0, 10), mqls_proj: 190 + i * 2 }
  })
}

// ─── Analytics: Mídia Paga — ROAS, ROI, série semanal + projeção ─────────────
async function getMediaPerformance(days = 90) {
  const { host, token } = getCredentials()
  if (!host || !token) {
    const mockWeekly = getMockMediaWeekly(days)
    const weeklyAgg = {}
    mockWeekly.forEach(r => {
      if (!weeklyAgg[r.semana]) weeklyAgg[r.semana] = { semana: r.semana, gasto: 0, receita: 0 }
      weeklyAgg[r.semana].gasto   += r.gasto
      weeklyAgg[r.semana].receita += r.receita
    })
    const weekSeries = Object.values(weeklyAgg).sort((a, b) => a.semana > b.semana ? 1 : -1)
    return {
      mock: true,
      weekly:     mockWeekly,
      totals:     getMockMediaTotals(),
      campaigns:  getMockMediaCampaigns(),
      projection: buildWeeklyProjection(weekSeries, 4),
    }
  }
  try {
    const [weeklyData, totalsData, campaignData] = await Promise.all([
      // Série semanal: investimento × receita (para projeção)
      executeStatement(
        `SELECT
           DATE_TRUNC('week', CAST(event_at AS DATE)) AS semana,
           CASE WHEN event LIKE 'facebook%' OR utm_source IN ('facebook','instagram') THEN 'Meta'
                ELSE 'Google' END AS plataforma,
           SUM(CASE WHEN event IN ('facebook_spend','google_spend') THEN event_value ELSE 0 END) AS gasto,
           SUM(CASE WHEN event = 'won' THEN COALESCE(revenue, 0) ELSE 0 END) AS receita,
           SUM(CASE WHEN event = 'mql'  THEN 1 ELSE 0 END) AS mqls,
           SUM(CASE WHEN event = 'won'  THEN 1 ELSE 0 END) AS ganhos
         FROM production.diamond.funil_marketing
         WHERE event_at >= CAST(CURRENT_DATE - INTERVAL ${days} DAYS AS STRING)
           AND (camada_funil = 'paid_media'
             OR (camada_funil = 'negociacao_deal' AND utm_source IN ('facebook','instagram','google')))
         GROUP BY 1, 2
         ORDER BY 1`, 35
      ),
      // Totais consolidados por plataforma — duas sub-queries independentes (gasto + leads/receita)
      executeStatement(
        `WITH gasto_plat AS (
           SELECT
             CASE WHEN event LIKE 'facebook%' OR event LIKE 'instagram%' THEN 'Meta' ELSE 'Google' END AS plataforma,
             SUM(CASE WHEN event IN ('facebook_spend','google_spend') THEN COALESCE(event_value,0) ELSE 0 END) AS gasto,
             SUM(CASE WHEN event IN ('facebook_clicks','google_clicks') THEN COALESCE(event_value,0) ELSE 0 END) AS cliques,
             SUM(CASE WHEN event IN ('facebook_impressions','google_impressions') THEN COALESCE(event_value,0) ELSE 0 END) AS impressoes
           FROM production.diamond.funil_marketing
           WHERE camada_funil = 'paid_media'
             AND event_at >= CAST(CURRENT_DATE - INTERVAL ${days} DAYS AS STRING)
           GROUP BY 1
         ),
         leads_plat AS (
           SELECT
             CASE
               WHEN utm_source IN ('facebook','instagram') THEN 'Meta'
               WHEN utm_source IN ('google') THEN 'Google'
               ELSE NULL
             END AS plataforma,
             SUM(CASE WHEN event = 'mql' THEN 1 ELSE 0 END) AS mqls,
             SUM(CASE WHEN event = 'won' THEN 1 ELSE 0 END) AS ganhos,
             SUM(CASE WHEN event = 'won' THEN COALESCE(revenue,0) ELSE 0 END) AS receita
           FROM production.diamond.funil_marketing
           WHERE utm_source IN ('facebook','instagram','google')
             AND event IN ('mql','won')
             AND event_at >= CAST(CURRENT_DATE - INTERVAL ${days} DAYS AS STRING)
           GROUP BY 1
         )
         SELECT
           g.plataforma,
           COALESCE(g.gasto,0)      AS gasto,
           COALESCE(g.cliques,0)    AS cliques,
           COALESCE(g.impressoes,0) AS impressoes,
           COALESCE(l.mqls,0)       AS mqls,
           COALESCE(l.ganhos,0)     AS ganhos,
           COALESCE(l.receita,0)    AS receita
         FROM gasto_plat g
         LEFT JOIN leads_plat l ON g.plataforma = l.plataforma`, 35
      ),
      // Top campanhas com ROAS
      executeStatement(
        `SELECT
           COALESCE(utm_campaign, '(sem campanha)') AS campanha,
           utm_source AS plataforma,
           SUM(CASE WHEN event = 'mql'  THEN 1 ELSE 0 END) AS mqls,
           SUM(CASE WHEN event = 'won'  THEN 1 ELSE 0 END) AS ganhos,
           SUM(CASE WHEN event = 'won'  THEN COALESCE(revenue, 0) ELSE 0 END) AS receita,
           ROUND(100.0 * SUM(CASE WHEN event = 'won' THEN 1 ELSE 0 END) /
             NULLIF(SUM(CASE WHEN event = 'mql' THEN 1 ELSE 0 END), 0), 1) AS conv_pct
         FROM production.diamond.funil_marketing
         WHERE camada_funil = 'negociacao_deal'
           AND event_at >= CAST(CURRENT_DATE - INTERVAL ${days} DAYS AS STRING)
           AND utm_source IN ('facebook','instagram','google')
           AND event IN ('mql','won')
         GROUP BY utm_campaign, utm_source
         ORDER BY receita DESC
         LIMIT 12`, 30
      ),
    ])

    const weekly = parseResult(weeklyData).rows.map(r => ({
      semana:    r.semana?.slice(0, 10),
      plataforma: r.plataforma,
      gasto:    parseFloat(r.gasto)   || 0,
      receita:  parseFloat(r.receita) || 0,
      mqls:     parseInt(r.mqls)      || 0,
      ganhos:   parseInt(r.ganhos)    || 0,
      roas:     parseFloat(r.gasto) > 0
        ? parseFloat((parseFloat(r.receita) / parseFloat(r.gasto)).toFixed(2)) : 0,
    }))

    const totals = parseResult(totalsData).rows.map(r => {
      const gasto   = parseFloat(r.gasto)   || 0
      const receita = parseFloat(r.receita) || 0
      const mqls    = parseInt(r.mqls)      || 0
      const ganhos  = parseInt(r.ganhos)    || 0
      return {
        plataforma:  r.plataforma,
        gasto, receita, mqls, ganhos,
        cliques:     parseFloat(r.cliques)    || 0,
        impressoes:  parseFloat(r.impressoes) || 0,
        roas:    gasto > 0 ? parseFloat((receita / gasto).toFixed(2))     : 0,
        roi_pct: gasto > 0 ? parseFloat(((receita - gasto) / gasto * 100).toFixed(1)) : 0,
        cpl:     mqls   > 0 ? parseFloat((gasto / mqls).toFixed(0))   : 0,
        cpv:     ganhos > 0 ? parseFloat((gasto / ganhos).toFixed(0)) : 0,
      }
    })

    const campaigns = parseResult(campaignData).rows.map(r => {
      const gasto = 0  // gasto por campanha não está disponível nesta query — ROAS estimado
      return {
        campanha:   r.campanha,
        plataforma: r.plataforma,
        mqls:    parseInt(r.mqls)      || 0,
        ganhos:  parseInt(r.ganhos)    || 0,
        receita: parseFloat(r.receita) || 0,
        conv_pct: parseFloat(r.conv_pct) || 0,
      }
    })

    // Projeção semanal de receita (regressão sobre série Meta + Google somados)
    const weeklyAgg = {}
    weekly.forEach(r => {
      if (!weeklyAgg[r.semana]) weeklyAgg[r.semana] = { semana: r.semana, gasto: 0, receita: 0 }
      weeklyAgg[r.semana].gasto   += r.gasto
      weeklyAgg[r.semana].receita += r.receita
    })
    const weekSeries = Object.values(weeklyAgg).sort((a, b) => a.semana > b.semana ? 1 : -1)
    const projection = buildWeeklyProjection(weekSeries, 4)

    return { mock: false, days, weekly, totals, campaigns, projection }
  } catch (err) {
    console.error('[Databricks] getMediaPerformance error:', err.message)
    return { mock: true, error: err.message, weekly: getMockMediaWeekly(days), totals: getMockMediaTotals(), campaigns: getMockMediaCampaigns(), projection: [] }
  }
}

// Regressão linear semanal sobre receita
function buildWeeklyProjection(series, weeks = 4) {
  if (series.length < 4) return []
  const n = series.length
  const xMean = (n - 1) / 2
  const yMean = series.reduce((s, r) => s + r.receita, 0) / n
  let num = 0, den = 0
  series.forEach((r, i) => { num += (i - xMean) * (r.receita - yMean); den += (i - xMean) ** 2 })
  const slope = den !== 0 ? num / den : 0
  const intercept = yMean - slope * xMean

  const lastDate = new Date(series[series.length - 1].semana)
  return Array.from({ length: weeks }, (_, i) => {
    const d = new Date(lastDate)
    d.setDate(d.getDate() + (i + 1) * 7)
    return {
      semana: d.toISOString().slice(0, 10),
      receita_proj: Math.max(0, Math.round(intercept + slope * (n + i))),
    }
  })
}

function getMockMediaWeekly(days) {
  const weeks = Math.ceil(days / 7)
  return Array.from({ length: weeks * 2 }, (_, i) => {
    const plat = i % 2 === 0 ? 'Meta' : 'Google'
    const week = Math.floor(i / 2)
    const d = new Date(); d.setDate(d.getDate() - (weeks - 1 - week) * 7)
    const gasto = plat === 'Meta' ? 220000 + Math.random() * 30000 : 18000 + Math.random() * 5000
    const roas  = plat === 'Meta' ? 0.55 + Math.random() * 0.3    : 1.4 + Math.random() * 0.4
    return { semana: d.toISOString().slice(0, 10), plataforma: plat, gasto, receita: gasto * roas, mqls: Math.round(300 + Math.random() * 80), ganhos: Math.round(24 + Math.random() * 8), roas: parseFloat(roas.toFixed(2)) }
  })
}
function getMockMediaTotals() {
  return [
    { plataforma: 'Meta',   gasto: 6663430, receita: 3664600, mqls: 9925, ganhos: 748, cliques: 1933684, impressoes: 149151437, roas: 0.55, roi_pct: -45.0, cpl: 671, cpv: 8908 },
    { plataforma: 'Google', gasto: 561189,  receita: 848092,  mqls: 1690, ganhos: 105, cliques: 151013,  impressoes: 3002336,   roas: 1.51, roi_pct: 51.1,  cpl: 332, cpv: 5345 },
  ]
}
function getMockMediaCampaigns() {
  return [
    { campanha: 'always-on',           plataforma: 'instagram', mqls: 2674, ganhos: 118, receita: 3670210, conv_pct: 4.4 },
    { campanha: 'g4_bau_lgen_bofu',    plataforma: 'facebook',  mqls: 2316, ganhos: 4,   receita: 92000,   conv_pct: 0.2 },
    { campanha: 'g4_traction_remarketing', plataforma: 'google', mqls: 680, ganhos: 55,  receita: 495000,  conv_pct: 8.1 },
  ]
}

// ─── Analytics: atribuição de jornada (primeiro toque × último toque) ────────
async function getJourneyAttribution(days = 30) {
  const { host, token } = getCredentials()
  if (!host || !token) return { mock: true, journeys: getMockJourneys(), totals: getMockJourneyTotals() }
  try {
    // Agrega jornadas por canal de entrada e canal de fechamento
    const data = await executeStatement(
      `WITH first_touch AS (
         SELECT deal_id,
           CASE
             WHEN utm_medium = 'cpc' THEN 'Pago'
             WHEN utm_source IS NULL OR utm_source IN ('null','','(direct)') THEN 'Direto'
             ELSE 'Orgânico'
           END AS canal_entrada,
           utm_source AS fonte_entrada
         FROM production.diamond.funil_marketing
         WHERE event = 'mql'
           AND event_at >= CAST(CURRENT_DATE - INTERVAL ${days} DAYS AS STRING)
       ),
       last_touch AS (
         SELECT deal_id,
           CASE
             WHEN utm_medium = 'cpc' THEN 'Pago'
             WHEN utm_source IS NULL OR utm_source IN ('null','','(direct)') THEN 'Direto'
             ELSE 'Orgânico'
           END AS canal_fechamento,
           utm_source AS fonte_fechamento
         FROM production.diamond.funil_marketing
         WHERE event = 'won'
           AND event_at >= CAST(CURRENT_DATE - INTERVAL ${days} DAYS AS STRING)
       )
       SELECT
         f.canal_entrada,
         l.canal_fechamento,
         f.fonte_entrada,
         COUNT(DISTINCT f.deal_id) AS total_leads,
         COUNT(DISTINCT l.deal_id) AS convertidos,
         ROUND(100.0 * COUNT(DISTINCT l.deal_id) /
           NULLIF(COUNT(DISTINCT f.deal_id), 0), 1) AS conv_pct
       FROM first_touch f
       LEFT JOIN last_touch l ON f.deal_id = l.deal_id
       GROUP BY 1, 2, 3
       ORDER BY total_leads DESC
       LIMIT 20`, 35
    )
    const { rows } = parseResult(data)
    const journeys = rows.map(r => ({
      canal_entrada:    r.canal_entrada,
      canal_fechamento: r.canal_fechamento || '—',
      fonte_entrada:    r.fonte_entrada,
      total_leads:      parseInt(r.total_leads)  || 0,
      convertidos:      parseInt(r.convertidos)  || 0,
      conv_pct:         parseFloat(r.conv_pct)   || 0,
    }))

    // Totais por combinação entrada→fechamento
    const totals = { 'Pago→Pago': 0, 'Pago→Orgânico': 0, 'Orgânico→Orgânico': 0, 'Orgânico→Pago': 0, 'Direto→*': 0 }
    journeys.forEach(j => {
      const key = `${j.canal_entrada}→${j.canal_fechamento}`
      if (key.startsWith('Direto')) totals['Direto→*'] += j.convertidos
      else if (totals[key] !== undefined) totals[key] += j.convertidos
      else totals['Outros'] = (totals['Outros'] || 0) + j.convertidos
    })

    return { mock: false, days, journeys, totals }
  } catch (err) {
    console.error('[Databricks] getJourneyAttribution error:', err.message)
    return { mock: true, error: err.message, journeys: getMockJourneys(), totals: getMockJourneyTotals() }
  }
}

function getMockJourneys() {
  return [
    { canal_entrada: 'Pago',     canal_fechamento: 'Pago',     fonte_entrada: 'facebook',   total_leads: 4821, convertidos: 482, conv_pct: 10.0 },
    { canal_entrada: 'Pago',     canal_fechamento: 'Orgânico', fonte_entrada: 'facebook',   total_leads: 2310, convertidos: 185, conv_pct: 8.0  },
    { canal_entrada: 'Orgânico', canal_fechamento: 'Orgânico', fonte_entrada: 'instagram',  total_leads: 1870, convertidos: 210, conv_pct: 11.2 },
    { canal_entrada: 'Orgânico', canal_fechamento: 'Pago',     fonte_entrada: 'prospeccao', total_leads: 940,  convertidos: 131, conv_pct: 13.9 },
    { canal_entrada: 'Direto',   canal_fechamento: '—',        fonte_entrada: '(direct)',   total_leads: 820,  convertidos: 57,  conv_pct: 7.0  },
    { canal_entrada: 'Pago',     canal_fechamento: 'Pago',     fonte_entrada: 'google',     total_leads: 730,  convertidos: 88,  conv_pct: 12.1 },
  ]
}
function getMockJourneyTotals() {
  return { 'Pago→Pago': 570, 'Pago→Orgânico': 185, 'Orgânico→Orgânico': 210, 'Orgânico→Pago': 131, 'Direto→*': 57 }
}

// ─── Wrappers cacheados ───────────────────────────────────────────────────────
// Chaves determinísticas por função + parâmetros relevantes
const cached = {
  getStatus:              ()       => withCache('status',              getStatus),
  getAnalyticsTrend:      (d)      => withCache(`analytics-trend:${d}`,  () => getAnalyticsTrend(d)),
  getJourneyAttribution:  (d)      => withCache(`journey-attr:${d}`,     () => getJourneyAttribution(d)),
  getMediaPerformance:    (d)      => withCache(`media-performance:${d}`, () => getMediaPerformance(d)),
  getExecutiveSummary:    ()       => withCache('executive-summary',   getExecutiveSummary),
  getFunnelStages:        (d)      => withCache(`funnel-stages:${d}`,  () => getFunnelStages(d)),
  getLostReasons:         (d)      => withCache(`lost-reasons:${d}`,   () => getLostReasons(d)),
  getTopProducts:         (d)      => withCache(`top-products:${d}`,   () => getTopProducts(d)),
  getMarketingFunnel:     (d)      => withCache(`mkt-funnel:${d}`,     () => getMarketingFunnel(d)),
  getFunnelTrend:         (d)      => withCache(`funnel-trend:${d}`,   () => getFunnelTrend(d)),
  getOrganicVsPaid:       (d)      => withCache(`organic-paid:${d}`,   () => getOrganicVsPaid(d)),
  getCompareByChannel:    (d)      => withCache(`cmp-channel:${d}`,    () => getCompareByChannel(d)),
  getMediaROI:            (d)      => withCache(`media-roi:${d}`,      () => getMediaROI(d)),
  getRevenueByChannel:    (d)      => withCache(`rev-channel:${d}`,    () => getRevenueByChannel(d)),
  getConversionByProfile: (d)      => withCache(`conv-profile:${d}`,   () => getConversionByProfile(d)),
  getTopCampaigns:        (d)      => withCache(`top-campaigns:${d}`,  () => getTopCampaigns(d)),
  getFormAttribution:     (d)      => withCache(`form-attr:${d}`,      () => getFormAttribution(d)),
}

module.exports = {
  // Versões cacheadas (uso normal)
  getStatus:              cached.getStatus,
  getAnalyticsTrend:      cached.getAnalyticsTrend,
  getJourneyAttribution:  cached.getJourneyAttribution,
  getMediaPerformance:    cached.getMediaPerformance,
  getExecutiveSummary:    cached.getExecutiveSummary,
  getFunnelStages:        cached.getFunnelStages,
  getLostReasons:         cached.getLostReasons,
  getTopProducts:         cached.getTopProducts,
  getMarketingFunnel:     cached.getMarketingFunnel,
  getFunnelTrend:         cached.getFunnelTrend,
  getOrganicVsPaid:       cached.getOrganicVsPaid,
  getCompareByChannel:    cached.getCompareByChannel,
  getMediaROI:            cached.getMediaROI,
  getRevenueByChannel:    cached.getRevenueByChannel,
  getConversionByProfile: cached.getConversionByProfile,
  getTopCampaigns:        cached.getTopCampaigns,
  getFormAttribution:     cached.getFormAttribution,
  // Sem cache (listagem/preview sempre frescos)
  listTables, previewTable,
  // Utilitário para invalidação forçada
  clearCache: (key) => cacheClear(key),
}
