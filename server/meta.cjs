/**
 * server/meta.js
 * Rotas Meta — usa access_token do farol.config.json (Graph API REST).
 */

const fetch = require('node-fetch')
const { loadConfig, saveConfig } = require('./config.cjs')

const BASE_URL = 'https://graph.facebook.com/v19.0'

// ─── Cache em memória ────────────────────────────────────────────────────────
const CACHE_TTL_MS      = 5 * 60 * 1000   // 5 min
const CACHE_TTL_QUAL_MS = 30 * 60 * 1000  // 30 min — qualidade muda pouco
const MAX_STALE_MS      = 60 * 60 * 1000  // 1 hora — máx para uso como stale fallback
const _cache = new Map()
const _stale = new Map()

function cacheGet(key) {
  const entry = _cache.get(key)
  if (!entry) return null
  const ttl = key === 'quality' ? CACHE_TTL_QUAL_MS : CACHE_TTL_MS
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
  return /403|401|invalid.*token|unauthorized|access.*denied|OAuthException/i.test(String(msg))
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

function getToken() {
  const cfg = loadConfig()
  return cfg.meta?.access_token || null
}

function getPixelId() {
  const cfg = loadConfig()
  return cfg.meta?.pixel_id || null
}

async function metaGet(path, params = {}) {
  const token = getToken()
  if (!token) throw new Error('Meta access_token não configurado')

  const qs = new URLSearchParams({ ...params, access_token: token }).toString()
  const url = `${BASE_URL}/${path}?${qs}`
  const res = await fetch(url, { timeout: 12000 })
  const data = await res.json()

  if (data.error) throw new Error(data.error.message)
  return data
}

// ─── Pixels disponíveis na conta ──────────────────────────────────────────────
async function listPixels() {
  try {
    // Busca via /me/adaccounts para descobrir contas com pixels
    const meData = await metaGet('me', { fields: 'id,name' })
    const adAccountsData = await metaGet('me/adaccounts', {
      fields: 'id,name,business',
      limit: '25',
    })

    const accounts = adAccountsData.data || []
    const pixels = []

    // Para cada ad account, busca pixels vinculados
    await Promise.all(
      accounts.slice(0, 10).map(async (acc) => {
        try {
          const pixelRes = await metaGet(`${acc.id}/adspixels`, {
            fields: 'id,name,last_fired_time,is_unavailable',
          })
          for (const px of pixelRes.data || []) {
            pixels.push({
              id: px.id,
              name: px.name || `Pixel ${px.id}`,
              lastFired: px.last_fired_time || null,
              unavailable: px.is_unavailable || false,
              adAccountId: acc.id,
              adAccountName: acc.name,
            })
          }
        } catch (_) {}
      })
    )

    if (pixels.length === 0) {
      // Fallback: tenta buscar direto pelo pixel_id configurado
      const pixelId = getPixelId()
      if (pixelId) {
        try {
          const px = await metaGet(pixelId, { fields: 'id,name,last_fired_time' })
          pixels.push({
            id: px.id,
            name: px.name || `Pixel ${px.id}`,
            lastFired: px.last_fired_time || null,
            unavailable: false,
          })
        } catch (_) {}
      }
    }

    return { mock: false, pixels }
  } catch (err) {
    console.error('[Meta] listPixels error:', err.message)
    const pixelId = getPixelId() || '702432142505333'
    return {
      mock: true,
      error: err.message,
      pixels: [{ id: pixelId, name: `Pixel ${pixelId}`, lastFired: null, unavailable: false }],
    }
  }
}

// ─── Stats do pixel — funil + volume horário + tabela de eventos ──────────────
async function getPixelStats() {
  return withCache('pixelstats', async () => {
  const pixelId = getPixelId()
  if (!pixelId) return { mock: true, ...getMockMeta() }

  try {
    const since24h = Math.floor((Date.now() - 86400000) / 1000).toString()
    const since48h = Math.floor((Date.now() - 172800000) / 1000).toString()
    const until    = Math.floor(Date.now() / 1000).toString()

    // Busca 24h atuais e 24h anteriores em paralelo (para tendência)
    const [data, dataPrev] = await Promise.all([
      metaGet(`${pixelId}/stats`, { aggregation: 'event', since: since24h, until }),
      metaGet(`${pixelId}/stats`, { aggregation: 'event', since: since48h, until: since24h }),
    ])

    // Agrega por evento — período atual
    const totals = {}
    const byHour = {} // { "HH": { EventName: count } }
    for (const block of (data.data || [])) {
      const h = new Date(block.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', timeZone: 'America/Sao_Paulo' })
      if (!byHour[h]) byHour[h] = {}
      for (const item of (block.data || [])) {
        const name = item.value || item.event
        if (!name) continue
        totals[name] = (totals[name] || 0) + (item.count || 0)
        byHour[h][name] = (byHour[h][name] || 0) + (item.count || 0)
      }
    }

    // Agrega por evento — período anterior (tendência)
    const totalsPrev = {}
    for (const block of (dataPrev.data || [])) {
      for (const item of (block.data || [])) {
        const name = item.value || item.event
        if (!name) continue
        totalsPrev[name] = (totalsPrev[name] || 0) + (item.count || 0)
      }
    }

    // Série horária para gráfico de volume (soma todos os eventos por hora)
    const hourSeries = Object.entries(byHour)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([hour, evMap]) => ({
        hour,
        total: Object.values(evMap).reduce((s, v) => s + v, 0),
        leads: (evMap['Lead'] || 0) + (evMap['lead'] || 0) + (evMap['initial_lead'] || 0),
        checkouts: evMap['InitiateCheckout'] || 0,
        purchases: evMap['Purchase'] || 0,
      }))

    // Tabela de eventos ordenada por volume
    const FUNNEL_ORDER = ['PageView', 'ViewContent', 'Lead', 'initial_lead', 'lead', 'Contact', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase', 'CompleteRegistration']
    const totalAll = Object.values(totals).reduce((s, v) => s + v, 0)
    const events = Object.entries(totals)
      .sort(([a, va], [b, vb]) => {
        const ia = FUNNEL_ORDER.indexOf(a), ib = FUNNEL_ORDER.indexOf(b)
        if (ia !== -1 && ib !== -1) return ia - ib
        if (ia !== -1) return -1
        if (ib !== -1) return 1
        return vb - va
      })
      .map(([name, count]) => {
        const prev = totalsPrev[name] || 0
        const delta = prev > 0 ? Math.round(((count - prev) / prev) * 100) : null
        return { name, count, pct: totalAll > 0 ? Math.round((count / totalAll) * 100) : 0, prev, delta }
      })

    // Funil de conversão
    const pv  = totals['PageView'] || 0
    const vc  = totals['ViewContent'] || 0
    const ld  = (totals['Lead'] || 0) + (totals['lead'] || 0) + (totals['initial_lead'] || 0)
    const co  = totals['InitiateCheckout'] || 0
    const pu  = totals['Purchase'] || 0
    const funnel = [
      { stage: 'PageView',        count: pv, rate: 100 },
      { stage: 'ViewContent',     count: vc, rate: pv  > 0 ? +(vc / pv * 100).toFixed(1)  : 0 },
      { stage: 'Lead',            count: ld, rate: pv  > 0 ? +(ld / pv * 100).toFixed(1)  : 0 },
      { stage: 'Checkout',        count: co, rate: ld  > 0 ? +(co / ld * 100).toFixed(1)  : 0 },
      { stage: 'Purchase',        count: pu, rate: co  > 0 ? +(pu / co * 100).toFixed(1)  : 0 },
    ]

    return {
      mock: false,
      pixelId,
      totalEvents: totalAll,
      events,
      funnel,
      hourSeries,
    }
  } catch (err) {
    console.error('[Meta] getPixelStats error:', err.message)
    return { mock: true, ...getMockMeta(), error: err.message }
  }
  })
}

// ─── Volume diário (CAPI vs Pixel, últimos N dias) ───────────────────────────
async function getEventVolume(days = 7) {
  return withCache(`volume_${days}`, async () => {
  const pixelId = getPixelId()
  if (!pixelId) return { mock: true, rows: getMockVolume(days) }

  try {
    const since = Math.floor((Date.now() - days * 86400000) / 1000)
    const until = Math.floor(Date.now() / 1000)

    // A API retorna dados por hora — agrega por dia
    const data = await metaGet(`${pixelId}/stats`, {
      aggregation: 'event',
      since: since.toString(),
      until: until.toString(),
    })

    const byDay = {}
    for (const hourBlock of (data.data || [])) {
      const d = new Date(hourBlock.start_time)
      const label = d.toLocaleDateString('pt-BR', { month: '2-digit', day: '2-digit' })
      if (!byDay[label]) byDay[label] = { date: label, total: 0, capi: 0, pixel: 0 }
      for (const item of (hourBlock.data || [])) {
        byDay[label].total += item.count || 0
      }
    }

    // G4 não usa CAPI — todos os eventos chegam via browser pixel
    const rows = Object.values(byDay).map(r => ({
      ...r,
      browserPixelOnly: true,
    }))

    return { mock: false, rows }
  } catch (err) {
    console.error('[Meta] getEventVolume error:', err.message)
    return { mock: true, rows: getMockVolume(days), error: err.message }
  }
  })
}

// ─── Qualidade por evento ─────────────────────────────────────────────────────
// Usa match_rate_approx do pixel (geral) + event_stats se disponível.
// event_stats só existe em pixels com acesso Business Manager avançado.
async function getEventQuality() {
  return withCache('quality', async () => {
  const pixelId = getPixelId()
  if (!pixelId) return { mock: true, unavailable: false, events: [] }

  try {
    // Tenta event_stats (por evento) — disponível apenas em BM avançado
    const data = await metaGet(`${pixelId}/event_stats`, {
      fields: 'event_name,match_rate_approx,count_deduplicated',
    })
    const events = (data.data || []).map((e) => {
      const matchRate = e.match_rate_approx ? Math.round(e.match_rate_approx * 100) : 0
      return {
        name: e.event_name,
        received: e.count_deduplicated || 0,
        matched: Math.round((e.count_deduplicated || 0) * (e.match_rate_approx || 0)),
        matchRate,
        status: matchRate >= 80 ? 'ok' : 'warn',
        quality: matchRate >= 90 ? 'Excelente' : matchRate >= 80 ? 'Alto' : matchRate >= 70 ? 'Médio' : 'Baixo',
      }
    })
    if (events.length === 0) {
      // Fallback: usa match_rate_approx geral do pixel
      return await getPixelMatchRate(pixelId)
    }
    return { mock: false, unavailable: false, events }
  } catch (err) {
    // event_stats não suportado — tenta match_rate_approx geral
    return await getPixelMatchRate(pixelId)
  }
  })
}

async function getPixelMatchRate(pixelId) {
  try {
    const px = await metaGet(pixelId, { fields: 'match_rate_approx,name' })
    const rate = px.match_rate_approx
    // -1 = sem dados suficientes
    if (!rate || rate < 0) return { mock: false, unavailable: true, events: [] }
    const matchRate = Math.round(rate * 100)
    const quality = matchRate >= 90 ? 'Excelente' : matchRate >= 80 ? 'Alto' : matchRate >= 70 ? 'Médio' : 'Baixo'
    return {
      mock: false,
      unavailable: false,
      overallOnly: true, // indica que só temos dado agregado, não por evento
      events: [{
        name: px.name || 'Pixel Global',
        received: null,
        matched: null,
        matchRate,
        status: matchRate >= 80 ? 'ok' : 'warn',
        quality,
      }],
    }
  } catch {
    return { mock: false, unavailable: true, events: [] }
  }
}

// ─── Mock data ────────────────────────────────────────────────────────────────
function getMockMeta() {
  const pv = 48200, vc = 12300, ld = 1820, co = 510, pu = 42
  const total = pv + vc + ld + co + pu + 890
  const hourSeries = Array.from({ length: 24 }, (_, i) => {
    const base = i >= 8 && i <= 22 ? 800 + Math.random() * 1200 : 100 + Math.random() * 200
    return { hour: `${String(i).padStart(2,'0')}h`, total: Math.round(base), leads: Math.round(base * 0.04), checkouts: Math.round(base * 0.01), purchases: Math.round(base * 0.001) }
  })
  return {
    pixelId: '702432142505333',
    totalEvents: total,
    events: [
      { name: 'PageView',          count: pv,   pct: Math.round(pv/total*100),   prev: 46000, delta: 5  },
      { name: 'ViewContent',       count: vc,   pct: Math.round(vc/total*100),   prev: 11800, delta: 4  },
      { name: 'Lead',              count: ld,   pct: Math.round(ld/total*100),   prev: 1750,  delta: 4  },
      { name: 'InitiateCheckout',  count: co,   pct: Math.round(co/total*100),   prev: 490,   delta: 4  },
      { name: 'Purchase',          count: pu,   pct: Math.round(pu/total*100),   prev: 38,    delta: 10 },
      { name: 'AddPaymentInfo',    count: 890,  pct: Math.round(890/total*100),  prev: 860,   delta: 3  },
    ],
    funnel: [
      { stage: 'PageView',   count: pv, rate: 100 },
      { stage: 'ViewContent',count: vc, rate: +(vc/pv*100).toFixed(1) },
      { stage: 'Lead',       count: ld, rate: +(ld/pv*100).toFixed(1) },
      { stage: 'Checkout',   count: co, rate: +(co/ld*100).toFixed(1) },
      { stage: 'Purchase',   count: pu, rate: +(pu/co*100).toFixed(1) },
    ],
    hourSeries,
  }
}

function getMockVolume(days = 7) {
  const rows = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const label = d.toLocaleDateString('pt-BR', { month: '2-digit', day: '2-digit' })
    const base = 900 + Math.round(Math.random() * 400)
    rows.push({
      date: label,
      total: base,
      browserPixelOnly: true,
    })
  }
  return rows
}

// ─── Ad Accounts configuráveis ────────────────────────────────────────────────
// Lê de cfg.meta.ad_accounts; fallback para contas G4 hardcoded.
// Edite em Configurações → Meta Ads — Ad Accounts.
const DEFAULT_AD_ACCOUNTS = [
  'act_942577509469439', // G4 Educação - LGEN
  'act_584341142722462', // G4 Educação - SOCIAL
  'act_324663872349737', // G4 Educação - SELFCHECKOUT
]

function getAdAccounts() {
  const cfg = loadConfig()
  const fromConfig = cfg.meta?.ad_accounts
  if (Array.isArray(fromConfig) && fromConfig.length > 0) return fromConfig
  return DEFAULT_AD_ACCOUNTS
}

// Action types de lead/conversão que queremos contabilizar
const LEAD_ACTIONS = new Set([
  'lead',
  'offsite_complete_registration_add_meta_leads',
  'complete_registration',
  'offsite_conversion.fb_pixel_lead',
])

function extractLeads(actions = []) {
  // Pega o maior valor dentre os action types de lead (evita dupla contagem)
  let max = 0
  for (const a of actions) {
    if (LEAD_ACTIONS.has(a.action_type)) {
      const v = parseInt(a.value) || 0
      if (v > max) max = v
    }
  }
  return max
}

// ─── Audience Insights: age × gender e publisher_platform ────────────────────
async function getAudienceInsights(days = 30) {
  return withCache(`audience_${days}`, async () => {
  const token = getToken()
  if (!token) return { mock: true, ...getMockAudience() }

  const datePreset = days <= 7 ? 'last_7d' : days <= 14 ? 'last_14d' : days <= 30 ? 'last_30d' : 'last_90d'

  try {
    // Roda em paralelo: age/gender + publisher_platform — para todas as contas
    const adAccounts = getAdAccounts()
    const ageGenderResults = await Promise.all(
      adAccounts.map(acc =>
        metaGet(`${acc}/insights`, {
          fields: 'spend,impressions,clicks,reach,cpm,cpc,ctr,actions',
          breakdowns: 'age,gender',
          date_preset: datePreset,
          limit: '100',
        }).catch(() => ({ data: [] }))
      )
    )
    const platformResults = await Promise.all(
      adAccounts.map(acc =>
        metaGet(`${acc}/insights`, {
          fields: 'spend,impressions,clicks,reach,cpm,cpc,ctr,actions',
          breakdowns: 'publisher_platform',
          date_preset: datePreset,
          limit: '20',
        }).catch(() => ({ data: [] }))
      )
    )

    // Agrega age/gender — soma por (age, gender)
    const ageMap = {}
    for (const res of ageGenderResults) {
      for (const r of (res.data || [])) {
        const key = `${r.age}|${r.gender}`
        if (!ageMap[key]) ageMap[key] = { age: r.age, gender: r.gender, spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 }
        ageMap[key].spend      += parseFloat(r.spend)      || 0
        ageMap[key].impressions += parseInt(r.impressions)  || 0
        ageMap[key].clicks     += parseInt(r.clicks)       || 0
        ageMap[key].reach      += parseInt(r.reach)        || 0
        ageMap[key].leads      += extractLeads(r.actions || [])
      }
    }
    const ageRows = Object.values(ageMap)
      .filter(r => r.gender !== 'unknown' && r.spend > 0)
      .map(r => ({
        ...r,
        cpl:  r.leads  > 0 ? Math.round(r.spend / r.leads)  : null,
        cpm:  r.impressions > 0 ? parseFloat((r.spend / r.impressions * 1000).toFixed(2)) : 0,
        ctr:  r.impressions > 0 ? parseFloat((r.clicks / r.impressions * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.spend - a.spend)

    // Agrega publisher_platform
    const platMap = {}
    for (const res of platformResults) {
      for (const r of (res.data || [])) {
        const p = r.publisher_platform
        if (!platMap[p]) platMap[p] = { platform: p, spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 }
        platMap[p].spend       += parseFloat(r.spend)      || 0
        platMap[p].impressions += parseInt(r.impressions)  || 0
        platMap[p].clicks      += parseInt(r.clicks)       || 0
        platMap[p].reach       += parseInt(r.reach)        || 0
        platMap[p].leads       += extractLeads(r.actions || [])
      }
    }
    const platforms = Object.values(platMap)
      .filter(p => p.spend > 0)
      .map(p => ({
        ...p,
        cpl:  p.leads  > 0 ? Math.round(p.spend / p.leads)  : null,
        cpm:  p.impressions > 0 ? parseFloat((p.spend / p.impressions * 1000).toFixed(2)) : 0,
        ctr:  p.impressions > 0 ? parseFloat((p.clicks / p.impressions * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.leads - a.leads)

    return { mock: false, days, ageRows, platforms }
  } catch (err) {
    console.error('[Meta] getAudienceInsights error:', err.message)
    return { mock: true, ...getMockAudience(), error: err.message }
  }
  })
}

// ─── Creative Insights: top anúncios por spend ───────────────────────────────
async function getAdCreativeInsights(days = 30) {
  return withCache(`creatives_${days}`, async () => {
  const token = getToken()
  if (!token) return { mock: true, ads: getMockCreatives() }

  const datePreset = days <= 7 ? 'last_7d' : days <= 14 ? 'last_14d' : days <= 30 ? 'last_30d' : 'last_90d'

  try {
    const results = await Promise.all(
      getAdAccounts().map(acc =>
        metaGet(`${acc}/insights`, {
          fields: 'ad_id,ad_name,adset_name,campaign_name,spend,impressions,clicks,ctr,cpm,cpc,reach,frequency,actions',
          level: 'ad',
          date_preset: datePreset,
          limit: '25',
          sort: 'spend_descending',
        }).catch(() => ({ data: [] }))
      )
    )

    const allAds = []
    for (const res of results) {
      for (const r of (res.data || [])) {
        const spend = parseFloat(r.spend) || 0
        if (spend < 100) continue // ignora micro-gastos
        const leads = extractLeads(r.actions || [])
        allAds.push({
          id:       r.ad_id,
          name:     r.ad_name,
          adset:    r.adset_name,
          campaign: r.campaign_name,
          spend,
          impressions: parseInt(r.impressions) || 0,
          clicks:   parseInt(r.clicks)       || 0,
          reach:    parseInt(r.reach)        || 0,
          frequency: parseFloat(r.frequency) || 0,
          ctr:      parseFloat(r.ctr)        || 0,
          cpm:      parseFloat(r.cpm)        || 0,
          cpc:      parseFloat(r.cpc)        || 0,
          leads,
          cpl: leads > 0 ? Math.round(spend / leads) : null,
        })
      }
    }

    // Ordena por spend, pega top 20
    const ads = allAds.sort((a, b) => b.spend - a.spend).slice(0, 20)

    return { mock: false, days, ads }
  } catch (err) {
    console.error('[Meta] getAdCreativeInsights error:', err.message)
    return { mock: true, ads: getMockCreatives(), error: err.message }
  }
  })
}

// ─── Mock Audience ─────────────────────────────────────────────────────────────
function getMockAudience() {
  const AGE_BANDS = ['18-24','25-34','35-44','45-54','55-64','65+']
  const GENDERS = ['male','female']
  const ageRows = []
  AGE_BANDS.forEach(age => {
    GENDERS.forEach(gender => {
      const spend = (age === '35-44' ? 220000 : age === '25-34' ? 180000 : age === '45-54' ? 150000 : 80000) * (gender === 'male' ? 1.4 : 1) + Math.random()*20000
      const leads = Math.round(spend / (gender === 'male' ? 165 : 200) + Math.random()*50)
      const impressions = Math.round(spend / 0.04 + Math.random()*100000)
      const clicks = Math.round(impressions * 0.008)
      ageRows.push({ age, gender, spend: Math.round(spend), impressions, clicks, reach: Math.round(impressions*0.7), leads, cpl: leads > 0 ? Math.round(spend/leads) : null, cpm: parseFloat((spend/impressions*1000).toFixed(2)), ctr: parseFloat((clicks/impressions*100).toFixed(2)) })
    })
  })
  const platforms = [
    { platform: 'instagram', spend: 1016993, impressions: 21186952, clicks: 137604, reach: 5438372, leads: 4820, cpl: 211, cpm: 48.0, ctr: 0.65 },
    { platform: 'facebook',  spend: 395048,  impressions: 17136218, clicks: 177329, reach: 4041342, leads: 2340, cpl: 169, cpm: 23.1, ctr: 1.03 },
  ]
  return { ageRows, platforms }
}

function getMockCreatives() {
  return [
    { id: '1', name: 'AD_02794_traction-100_estatico_png_chamada_faceless', campaign: 'always-on', adset: 'conversao_35-54', spend: 199611, impressions: 10643000, clicks: 70100, reach: 4800000, frequency: 2.2, ctr: 0.66, cpm: 18.8, cpc: 2.85, leads: 2803, cpl: 71 },
    { id: '2', name: 'AD_01794_isca-report_video_30s_chamada_maria-candi', campaign: 'isca-report', adset: 'lookalike_leads', spend: 150488, impressions: 1988000, clicks: 31100, reach: 1400000, frequency: 1.4, ctr: 1.56, cpm: 75.7, cpc: 4.84, leads: 85, cpl: 1770 },
    { id: '3', name: 'AD_01779_g4-club_video_120s_aftermovie_class-13', campaign: 'g4-club', adset: 'engajamento_35+', spend: 129029, impressions: 2808000, clicks: 14100, reach: 2100000, frequency: 1.3, ctr: 0.50, cpm: 45.9, cpc: 9.15, leads: 503, cpl: 257 },
    { id: '4', name: 'AD_02758_gestao-e-estrategia_estatico_png_design', campaign: 'gestao', adset: 'broad_25-54', spend: 74876, impressions: 2890000, clicks: 27500, reach: 2100000, frequency: 1.4, ctr: 0.95, cpm: 25.9, cpc: 2.72, leads: 652, cpl: 115 },
  ]
}

// ─── Leads por dia — específico para triangulação GA4 × Meta × CRM ──────────
// Filtra apenas eventos Lead/lead/initial_lead do pixel e agrega por dia.
async function getLeadsByDay(days = 30) {
  return withCache(`leads_by_day_${days}`, async () => {
    const pixelId = getPixelId()
    if (!pixelId) return { mock: true, rows: getMockLeadsByDay(days) }

    try {
      const since = Math.floor((Date.now() - days * 86400000) / 1000)
      const until = Math.floor(Date.now() / 1000)

      const data = await metaGet(`${pixelId}/stats`, {
        aggregation: 'event',
        since: since.toString(),
        until: until.toString(),
      })

      const LEAD_EVENTS = new Set(['Lead', 'lead', 'initial_lead'])
      const byDay = {}

      for (const hourBlock of (data.data || [])) {
        const d = new Date(hourBlock.start_time)
        const label = d.toLocaleDateString('pt-BR', { month: '2-digit', day: '2-digit' })
        if (!byDay[label]) byDay[label] = { date: label, leads: 0 }
        for (const item of (hourBlock.data || [])) {
          const name = item.value || item.event
          if (LEAD_EVENTS.has(name)) byDay[label].leads += item.count || 0
        }
      }

      const rows = Object.values(byDay).sort((a, b) => {
        const [da, ma] = a.date.split('/')
        const [db, mb] = b.date.split('/')
        return new Date(new Date().getFullYear(), parseInt(ma)-1, parseInt(da))
          - new Date(new Date().getFullYear(), parseInt(mb)-1, parseInt(db))
      })

      return { mock: false, rows }
    } catch (err) {
      console.error('[Meta] getLeadsByDay error:', err.message)
      return { mock: true, rows: getMockLeadsByDay(days), error: err.message }
    }
  })
}

function getMockLeadsByDay(days = 30) {
  const rows = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const label = d.toLocaleDateString('pt-BR', { month: '2-digit', day: '2-digit' })
    rows.push({ date: label, leads: 40 + Math.round(Math.random() * 80) })
  }
  return rows
}

module.exports = { getPixelStats, getEventQuality, getEventVolume, listPixels, getMockMeta, getAudienceInsights, getAdCreativeInsights, getLeadsByDay, clearCache }
