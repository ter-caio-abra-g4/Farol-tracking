/**
 * server/gtm.js
 * Rotas GTM — usa googleapis com OAuth2 do mesmo token do G4 OS.
 * Fallback para mock quando não autenticado.
 */

const { google } = require('googleapis')
const { loadConfig } = require('./config.cjs')

const GTM_ACCOUNTS = {
  'G4 Educacao': '4702993840',
  'G4 Tools': '6341042624',
}

const CONTAINER_ACCOUNT_MAP = {
  'GTM-MJT8CNGM': '4702993840',
  'GTM-PMNN5VZ':  '4702993840',
  'GTM-KWL8CBD':  '4702993840',
  'GTM-WV3RZ85':  '4702993840',
  'GTM-54PR3S2R': '4702993840',
  'GTM-WP8MWKMB': '4702993840',
  'GTM-WFTGXLRD': '4702993840',
  'GTM-M6NWZ5N8': '6341042624',
}

const CONTAINER_ID_MAP = {
  'GTM-MJT8CNGM': '239835208',
  'GTM-PMNN5VZ':  '116947605',
  'GTM-KWL8CBD':  '118119239',
  'GTM-WV3RZ85':  '62728112',
  'GTM-54PR3S2R': '226200501',
  'GTM-WP8MWKMB': '227831176',
  'GTM-WFTGXLRD': '227831876',
  'GTM-M6NWZ5N8': '244532908',
}

function getTagManger(auth) {
  return google.tagmanager({ version: 'v2', auth })
}

async function getAuthClient() {
  const cfg = loadConfig()

  // Tenta usar service account do GA4 (tem permissão GTM também se configurado)
  if (cfg.ga4?.service_account_path) {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: cfg.ga4.service_account_path,
        scopes: ['https://www.googleapis.com/auth/tagmanager.readonly'],
      })
      return await auth.getClient()
    } catch (_) {}
  }

  // Tenta Application Default Credentials (funciona se GOOGLE_APPLICATION_CREDENTIALS estiver set)
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/tagmanager.readonly'],
    })
    return await auth.getClient()
  } catch (_) {}

  return null
}

async function listContainersWithStats() {
  const auth = await getAuthClient()
  if (!auth) return { mock: true, containers: getMockContainers() }

  const gtm = getTagManger(auth)
  const results = []

  try {
    // Descobre contas automaticamente via API
    const accountsRes = await gtm.accounts.list()
    const accounts = accountsRes.data.account || []

    for (const acc of accounts) {
      try {
        const res = await gtm.accounts.containers.list({ parent: acc.path })
        const containers = res.data.container || []
        for (const c of containers) {
          results.push({
            id: c.publicId,
            containerId: c.containerId,
            accountId: acc.accountId,
            name: c.name,
            account: acc.name,
            status: 'ok',
            tags: null,
            triggers: null,
            variables: null,
            lastPublished: null,
          })
        }
      } catch (err) {
        console.error(`[GTM] Erro ao listar containers da conta ${acc.accountId}:`, err.message)
      }
    }
  } catch (err) {
    // Fallback para contas hardcoded se accounts.list() falhar
    console.error('[GTM] accounts.list() falhou, usando fallback:', err.message)
    for (const [accountName, accountId] of Object.entries(GTM_ACCOUNTS)) {
      try {
        const res = await gtm.accounts.containers.list({ parent: `accounts/${accountId}` })
        const containers = res.data.container || []
        for (const c of containers) {
          results.push({
            id: c.publicId,
            containerId: c.containerId,
            accountId,
            name: c.name,
            account: accountName,
            status: 'ok',
            tags: null,
            triggers: null,
            variables: null,
            lastPublished: null,
          })
        }
      } catch (err2) {
        console.error(`[GTM] Fallback erro conta ${accountId}:`, err2.message)
      }
    }
  }

  return { mock: false, containers: results.length > 0 ? results : getMockContainers() }
}

async function getContainerDetails(publicId) {
  const auth = await getAuthClient()
  const accountId = CONTAINER_ACCOUNT_MAP[publicId]
  const containerId = CONTAINER_ID_MAP[publicId]

  if (!auth || !accountId || !containerId) {
    return { mock: true, tags: [], triggers: [], variables: [] }
  }

  const gtm = getTagManger(auth)
  const parent = `accounts/${accountId}/containers/${containerId}`

  try {
    // Buscar workspace padrão (workspace 1)
    const wsRes = await gtm.accounts.containers.workspaces.list({ parent })
    const workspaces = wsRes.data.workspace || []
    const ws = workspaces[0]
    if (!ws) return { mock: true, tags: [], triggers: [], variables: [] }

    const wsPath = ws.path

    const [tagsRes, triggersRes, varsRes] = await Promise.all([
      gtm.accounts.containers.workspaces.tags.list({ parent: wsPath }),
      gtm.accounts.containers.workspaces.triggers.list({ parent: wsPath }),
      gtm.accounts.containers.workspaces.variables.list({ parent: wsPath }),
    ])

    const tags = (tagsRes.data.tag || []).map((t) => ({
      name: t.name,
      type: t.type,
      status: t.paused ? 'warn' : 'ok',
      triggers: t.firingTriggerId || [],
      tagId: t.tagId,
    }))

    const triggers = (triggersRes.data.trigger || []).map((t) => ({
      name: t.name,
      type: t.type,
      triggerId: t.triggerId,
    }))

    const variables = (varsRes.data.variable || []).map((v) => ({
      name: v.name,
      type: v.type,
    }))

    // Enriquecer tags com nomes dos triggers
    const triggerMap = {}
    triggers.forEach((t) => { triggerMap[t.triggerId] = t.name })

    const enrichedTags = tags.map((tag) => ({
      ...tag,
      triggers: tag.triggers.map((tid) => triggerMap[tid] || tid),
      status: tag.triggers.length === 0 ? 'error' : tag.status,
    }))

    return {
      mock: false,
      tags: enrichedTags,
      triggers,
      variables,
      counts: {
        tags: enrichedTags.length,
        triggers: triggers.length,
        variables: variables.length,
      },
    }
  } catch (err) {
    console.error(`[GTM] Erro ao buscar detalhes do container ${publicId}:`, err.message)
    return { mock: true, tags: [], triggers: [], variables: [], error: err.message }
  }
}

// Varre todos os containers acessíveis e retorna tags sem trigger ou pausadas
async function getSilentTags() {
  const auth = await getAuthClient()
  if (!auth) return { mock: true, tags: getMockSilentTags() }

  const gtm = getTagManger(auth)
  const result = []

  try {
    // Descobre containers
    const accountsRes = await gtm.accounts.list()
    const accounts = accountsRes.data.account || []

    for (const acc of accounts) {
      try {
        const containersRes = await gtm.accounts.containers.list({ parent: acc.path })
        const containers = containersRes.data.container || []

        for (const container of containers) {
          try {
            const wsRes = await gtm.accounts.containers.workspaces.list({ parent: container.path })
            const ws = (wsRes.data.workspace || [])[0]
            if (!ws) continue

            const tagsRes = await gtm.accounts.containers.workspaces.tags.list({ parent: ws.path })
            const tags = tagsRes.data.tag || []

            for (const tag of tags) {
              const noTrigger = !tag.firingTriggerId || tag.firingTriggerId.length === 0
              const paused = tag.paused === true

              if (noTrigger || paused) {
                result.push({
                  tagId: tag.tagId,
                  name: tag.name,
                  type: tag.type,
                  container: container.publicId,
                  containerName: container.name,
                  account: acc.name,
                  issue: paused ? 'pausada' : 'sem_trigger',
                  issueLabel: paused ? 'Pausada' : 'Sem trigger',
                })
              }
            }
          } catch (_) {}
        }
      } catch (_) {}
    }

    return { mock: false, tags: result }
  } catch (err) {
    console.error('[GTM] getSilentTags error:', err.message)
    return { mock: true, tags: getMockSilentTags(), error: err.message }
  }
}

function getMockSilentTags() {
  return [
    { tagId: '101', name: 'GA4 video_start',      type: 'gaawe',      container: 'GTM-MJT8CNGM', containerName: 'G4 Educacao - Global',   account: 'G4 Educacao', issue: 'sem_trigger',  issueLabel: 'Sem trigger' },
    { tagId: '102', name: 'GA4 scroll_depth',     type: 'gaawe',      container: 'GTM-MJT8CNGM', containerName: 'G4 Educacao - Global',   account: 'G4 Educacao', issue: 'sem_trigger',  issueLabel: 'Sem trigger' },
    { tagId: '201', name: 'Meta Pixel Lead OLD',  type: 'html',       container: 'GTM-PMNN5VZ',  containerName: 'G4 Educacao [PROD]',     account: 'G4 Educacao', issue: 'pausada',      issueLabel: 'Pausada' },
    { tagId: '301', name: 'Bing Ads',             type: 'html',       container: 'GTM-KWL8CBD',  containerName: 'G4 Educacao [DEV]',      account: 'G4 Educacao', issue: 'sem_trigger',  issueLabel: 'Sem trigger' },
    { tagId: '401', name: 'TikTok Pixel Legacy',  type: 'html',       container: 'GTM-WV3RZ85',  containerName: 'G4 Educacao - SKILLS',   account: 'G4 Educacao', issue: 'pausada',      issueLabel: 'Pausada' },
  ]
}

function getMockContainers() {
  return [
    { id: 'GTM-MJT8CNGM', name: 'G4 Educacao - Global',        account: 'G4 Educacao', status: 'loading', tags: null, triggers: null, variables: null },
    { id: 'GTM-PMNN5VZ',  name: 'G4 Educacao [PROD]',          account: 'G4 Educacao', status: 'loading', tags: null, triggers: null, variables: null },
    { id: 'GTM-KWL8CBD',  name: 'G4 Educacao [DEV]',           account: 'G4 Educacao', status: 'loading', tags: null, triggers: null, variables: null },
    { id: 'GTM-WV3RZ85',  name: 'G4 Educacao - SKILLS [PROD]', account: 'G4 Educacao', status: 'loading', tags: null, triggers: null, variables: null },
    { id: 'GTM-54PR3S2R', name: 'G4 Educacao - Selfcheckout',  account: 'G4 Educacao', status: 'loading', tags: null, triggers: null, variables: null },
    { id: 'GTM-WP8MWKMB', name: 'G4 Educacao - GTM',           account: 'G4 Educacao', status: 'loading', tags: null, triggers: null, variables: null },
    { id: 'GTM-WFTGXLRD', name: 'G4 Educacao - Lead Gen',      account: 'G4 Educacao', status: 'loading', tags: null, triggers: null, variables: null },
    { id: 'GTM-M6NWZ5N8', name: 'tools.g4educacao.com',        account: 'G4 Tools',    status: 'loading', tags: null, triggers: null, variables: null },
  ]
}

// Detecta se uma tag é Meta Pixel (pageview ativa)
function isMetaPageView(tag) {
  if (tag.paused) return false
  const name = (tag.name || '').toLowerCase()
  const type = (tag.type || '').toLowerCase()
  // Tag customhtml com "fbq" ou "fbevents" ou nome contendo "meta" + "pageview"/"page view"
  if (type === 'html') {
    const params = tag.parameter || []
    const html = params.find(p => p.key === 'html')?.value || ''
    if (html.includes('fbq') || html.includes('fbevents')) {
      if (name.includes('pageview') || name.includes('page view') || name.includes('page_view')) return true
    }
  }
  // Tag do tipo fblpixel ou customPixel
  if (type === 'fblpixel') return true
  // Nome contém pixel + pageview
  if ((name.includes('meta') || name.includes('pixel') || name.includes('fb')) &&
      (name.includes('pageview') || name.includes('page view'))) return true
  return false
}

// Detecta se uma tag é GA4 Config (ativa)
function isGA4Config(tag) {
  if (tag.paused) return false
  const type = (tag.type || '').toLowerCase()
  return type === 'googl' || type === 'gaawc' || type === 'gaawe' && (tag.name || '').toLowerCase().includes('config')
}

// Detecta Conversion Linker ativo
function isConvLinker(tag) {
  if (tag.paused) return false
  const type = (tag.type || '').toLowerCase()
  return type === 'cl' || type === 'awcl' || (tag.name || '').toLowerCase().includes('conversion linker')
}

// Detecta Advanced Matching (script geo_fetch ou campo em tag Meta)
function hasAdvancedMatching(tags) {
  return tags.some(tag => {
    if (tag.paused) return false
    const name = (tag.name || '').toLowerCase()
    const params = tag.parameter || []
    // Geo fetch script
    if (name.includes('geo_fetch') || name.includes('geo fetch')) return true
    // Tag Meta com campos de AM (em, ph, fn)
    const hasAMFields = params.some(p =>
      ['em', 'ph', 'fn', 'ln'].includes(p.key) && p.value
    )
    return hasAMFields
  })
}

/**
 * Agrega saúde das conexões GTM → Meta Pixel e GTM → GA4
 * em todos os containers principais (G4 Educação).
 * Lógica: se QUALQUER container tiver a conexão ativa → ok.
 */
async function getConnectionHealth() {
  const auth = await getAuthClient()
  if (!auth) return getMockConnectionHealth()

  const gtm = getTagManger(auth)
  const MAIN_CONTAINERS = ['GTM-MJT8CNGM', 'GTM-PMNN5VZ', 'GTM-WFTGXLRD']

  const containerResults = []

  for (const publicId of MAIN_CONTAINERS) {
    const accountId = CONTAINER_ACCOUNT_MAP[publicId]
    const containerId = CONTAINER_ID_MAP[publicId]
    if (!accountId || !containerId) continue

    try {
      const parent = `accounts/${accountId}/containers/${containerId}`
      const wsRes = await gtm.accounts.containers.workspaces.list({ parent })
      const ws = (wsRes.data.workspace || [])[0]
      if (!ws) continue

      const tagsRes = await gtm.accounts.containers.workspaces.tags.list({ parent: ws.path })
      const tags = tagsRes.data.tag || []

      const activeTags = tags.filter(t => !t.paused)
      const pausedCount = tags.filter(t => t.paused).length

      containerResults.push({
        publicId,
        totalTags: tags.length,
        activeTags: activeTags.length,
        pausedCount,
        hasMetaPageView: tags.some(isMetaPageView),
        hasGA4Config: tags.some(isGA4Config),
        hasConvLinker: tags.some(isConvLinker),
        hasAdvancedMatching: hasAdvancedMatching(tags),
      })
    } catch (err) {
      console.error(`[GTM health] Erro container ${publicId}:`, err.message)
    }
  }

  if (!containerResults.length) return getMockConnectionHealth()

  // Agrega: ok se pelo menos um container tiver a conexão ativa
  const metaOk    = containerResults.some(c => c.hasMetaPageView)
  const ga4Ok     = containerResults.some(c => c.hasGA4Config)
  const linkerOk  = containerResults.some(c => c.hasConvLinker)
  const amOk      = containerResults.some(c => c.hasAdvancedMatching)
  const totalPaused = containerResults.reduce((s, c) => s + c.pausedCount, 0)

  return {
    mock: false,
    connections: [
      {
        key: 'gtm_meta',
        label: 'GTM → Meta Pixel',
        ok: metaOk,
        detail: metaOk ? 'PageView ativo' : 'Nenhum PageView ativo encontrado',
      },
      {
        key: 'gtm_ga4',
        label: 'GTM → GA4',
        ok: ga4Ok,
        detail: ga4Ok ? 'Config tag ativa' : 'Nenhuma Config tag ativa encontrada',
      },
      {
        key: 'gtm_linker',
        label: 'GTM → Conversion Linker',
        ok: linkerOk,
        detail: linkerOk ? 'Linker ativo' : 'Conversion Linker não encontrado',
      },
      {
        key: 'gtm_am',
        label: 'Advanced Matching',
        ok: amOk,
        detail: amOk ? 'Configurado (Global)' : 'Não configurado em nenhum container',
      },
    ],
    summary: {
      containersChecked: containerResults.length,
      totalPaused,
    },
  }
}

function getMockConnectionHealth() {
  return {
    mock: true,
    connections: [
      { key: 'gtm_meta',   label: 'GTM → Meta Pixel',        ok: true,  detail: 'PageView ativo' },
      { key: 'gtm_ga4',    label: 'GTM → GA4',               ok: true,  detail: 'Config tag ativa' },
      { key: 'gtm_linker', label: 'GTM → Conversion Linker', ok: true,  detail: 'Linker ativo' },
      { key: 'gtm_am',     label: 'Advanced Matching',        ok: false, detail: 'Não configurado em nenhum container' },
    ],
    summary: { containersChecked: 3, totalPaused: 4 },
  }
}

module.exports = { listContainersWithStats, getContainerDetails, getSilentTags, getConnectionHealth }
