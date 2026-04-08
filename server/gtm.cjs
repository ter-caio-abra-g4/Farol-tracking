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

module.exports = { listContainersWithStats, getContainerDetails }
