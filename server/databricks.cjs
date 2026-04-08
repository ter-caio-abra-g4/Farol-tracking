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

module.exports = {
  getStatus, listTables, previewTable,
  getFunnelStages, getLostReasons, getTopProducts, getMarketingFunnel, getFunnelTrend,
  getCompareByChannel, getMediaROI, getRevenueByChannel, getConversionByProfile, getTopCampaigns,
  getFormAttribution,
}
