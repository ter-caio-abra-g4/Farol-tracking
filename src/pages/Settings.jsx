import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import { Key, CheckCircle, AlertTriangle, Zap, Loader, XCircle, Database, Save, RefreshCw, Eye, EyeOff, Server, Search, Shield } from 'lucide-react'
import { CredentialsModal } from './Setup'
import { api } from '../services/api'

const SOURCES = [
  { id: 'gtm',           name: 'Google Tag Manager',        desc: 'Containers, tags e triggers via API',         route: '/gtm' },
  { id: 'ga4',           name: 'Google Analytics 4',         desc: 'Dados de eventos e propriedades GA4',        route: '/ga4' },
  { id: 'searchconsole', name: 'Google Search Console',      desc: 'Cliques, impressões, CTR e posição orgânica', route: '/seo' },
  { id: 'meta',          name: 'Meta Ads — Conversions API', desc: 'Pixel e eventos via CAPI',                   route: '/meta' },
  { id: 'databricks',    name: 'Databricks SQL',             desc: 'Tabelas e queries via SQL Warehouse',        route: '/databricks' },
]

const TEST_FNS = {
  gtm: async () => {
    const res = await api.gtmContainers()
    const containers = res?.containers || []
    return {
      live: !res?.mock,
      detail: !res?.mock
        ? `${containers.length} container${containers.length !== 1 ? 's' : ''} encontrado${containers.length !== 1 ? 's' : ''}`
        : 'Sem autenticação — verifique service-account',
      items: !res?.mock
        ? containers.map(c => ({
            label: c.name || c.id,
            sub: c.id,
            account: c.account,
          }))
        : null,
    }
  },
  ga4: async () => {
    const cfg = await api.ga4Properties()
    const propId = cfg?.activePropertyId || '521780491'
    const res = await api.ga4Report(propId, 7)
    // Tenta listar propriedades para mostrar lista (pode ser mock)
    const propsRes = cfg?.properties?.length > 0 ? cfg : null
    const knownProps = propsRes?.properties || [{ id: propId, name: 'G4 Educacao - Principal' }]
    return {
      live: !res?.mock,
      detail: !res?.mock
        ? `${res?.rows?.length ?? 0} linhas de eventos (7 dias) — property ${propId}`
        : 'Sem acesso — adicione o service account no GA4 Admin ou verifique permissões',
      items: !res?.mock
        ? knownProps.map(p => ({
            label: p.name || p.id,
            sub: `ID: ${p.id}`,
            active: p.id === propId,
          }))
        : null,
    }
  },
  meta: async () => {
    const res = await api.metaStats()
    return {
      live: !res?.mock,
      detail: !res?.mock
        ? `Match rate: ${res?.matchRate ?? '—'}%`
        : 'Sem token — configure o Meta Access Token em farol.config.json',
      items: null,
    }
  },
  databricks: async () => {
    const res = await api.databricksStatus()
    return {
      live: !res?.mock,
      detail: !res?.mock
        ? `Conectado — ${res.tables ?? 0} tabela(s) em ${res.catalog ?? 'hive_metastore'}${res.schema ? '.' + res.schema : ''}`
        : 'Sem conexão — configure o Personal Access Token e HTTP Path',
      items: null,
    }
  },
  searchconsole: async () => {
    const res = await api.scSites()
    return {
      live: !res?.mock,
      detail: !res?.mock
        ? `${res.sites?.length ?? 0} propriedade${(res.sites?.length ?? 0) !== 1 ? 's' : ''} acessível${(res.sites?.length ?? 0) !== 1 ? 'is' : ''}`
        : 'Sem acesso — adicione o service account como usuário no Search Console',
      items: !res?.mock
        ? (res.sites || []).map(s => ({ label: s.url, sub: s.permissionLevel }))
        : null,
    }
  },
}

// Propriedades GA4 conhecidas (base estática + o que a API retornar)
const KNOWN_PROPERTIES = [
  { id: '521780491', name: 'G4 Educacao - Principal' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const [refreshInterval, setRefreshInterval] = useState(5)
  // testState: { [id]: 'idle' | 'testing' | { live, detail } }
  const [testState, setTestState] = useState({ gtm: 'idle', ga4: 'idle', meta: 'idle', databricks: 'idle', searchconsole: 'idle' })
  const [testingAll, setTestingAll] = useState(false)

  // GA4 property selector
  const [ga4Properties, setGa4Properties] = useState(KNOWN_PROPERTIES)
  const [activePropertyId, setActivePropertyId] = useState('521780491')
  const [savingProperty, setSavingProperty] = useState(false)
  const [propertySaved, setPropertySaved] = useState(false)

  // Databricks config
  const [dbHost, setDbHost] = useState('')
  const [dbHttpPath, setDbHttpPath] = useState('')
  const [dbToken, setDbToken] = useState('')
  const [dbTokenVisible, setDbTokenVisible] = useState(false)
  const [dbCatalog, setDbCatalog] = useState('production')
  const [dbSchema, setDbSchema] = useState('silver')
  const [savingDb, setSavingDb] = useState(false)
  const [dbSaved, setDbSaved] = useState(false)

  // Databricks — tabelas configuráveis
  const [dbTableFunilComercial, setDbTableFunilComercial] = useState('')
  const [dbTableFunilMarketing, setDbTableFunilMarketing] = useState('')
  const [dbTableCustomerSales, setDbTableCustomerSales] = useState('')
  const [savingDbTables, setSavingDbTables] = useState(false)
  const [dbTablesSaved, setDbTablesSaved] = useState(false)

  // Search Console config
  const [scSiteUrl, setScSiteUrl] = useState('')
  const [savingSc, setSavingSc] = useState(false)
  const [scSaved, setScSaved] = useState(false)

  // Meta — Ad Accounts
  const [adAccountsInput, setAdAccountsInput] = useState('')
  const [savingAdAccounts, setSavingAdAccounts] = useState(false)
  const [adAccountsSaved, setAdAccountsSaved] = useState(false)

  // Meta config
  const [metaToken, setMetaToken] = useState('')
  const [metaTokenVisible, setMetaTokenVisible] = useState(false)
  const [metaTokenSaved, setMetaTokenSaved] = useState(false)
  const [savingMetaToken, setSavingMetaToken] = useState(false)
  const [metaPixels, setMetaPixels] = useState([])
  const [loadingPixels, setLoadingPixels] = useState(false)
  const [activePixelId, setActivePixelId] = useState('')
  const [selectedPixelIds, setSelectedPixelIds] = useState([]) // multi-select
  const [savingPixel, setSavingPixel] = useState(false)
  const [pixelSaved, setPixelSaved] = useState(false)
  const [metaPixelMode, setMetaPixelMode] = useState('single') // 'single' | 'unified'
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)

  useEffect(() => {
    api.ga4Properties().then((res) => {
      if (res?.activePropertyId) setActivePropertyId(res.activePropertyId)
      if (res?.properties?.length > 0) {
        // Merge API results with known list (deduplicate by id)
        const apiProps = res.properties.map(p => ({ id: p.id, name: p.name }))
        const merged = [...KNOWN_PROPERTIES]
        apiProps.forEach(p => {
          if (!merged.find(k => k.id === p.id)) merged.push(p)
        })
        setGa4Properties(merged)
      }
    })
    // Carrega config atual do Meta + Databricks
    api.getConfig().then((cfg) => {
      if (cfg?.meta?.ad_accounts?.length > 0) setAdAccountsInput(cfg.meta.ad_accounts.join('\n'))
      if (cfg?.meta?.pixel_id) setActivePixelId(cfg.meta.pixel_id)
      if (cfg?.meta?.pixel_ids?.length > 0) setSelectedPixelIds(cfg.meta.pixel_ids)
      if (cfg?.meta?.pixel_ids?.length > 1) setMetaPixelMode('unified')
      if (cfg?.databricks?.host) setDbHost(cfg.databricks.host)
      if (cfg?.databricks?.http_path) setDbHttpPath(cfg.databricks.http_path)
      if (cfg?.databricks?.catalog) setDbCatalog(cfg.databricks.catalog)
      if (cfg?.databricks?.schema) setDbSchema(cfg.databricks.schema)
      if (cfg?.databricks?.tables?.funil_comercial) setDbTableFunilComercial(cfg.databricks.tables.funil_comercial)
      if (cfg?.databricks?.tables?.funil_marketing) setDbTableFunilMarketing(cfg.databricks.tables.funil_marketing)
      if (cfg?.databricks?.tables?.customer_sales) setDbTableCustomerSales(cfg.databricks.tables.customer_sales)
      if (cfg?.searchconsole?.site_url) setScSiteUrl(cfg.searchconsole.site_url)
    })
  }, [])

  async function handleFetchPixels() {
    setLoadingPixels(true)
    const res = await api.metaPixels()
    setLoadingPixels(false)
    if (res?.pixels?.length > 0) {
      setMetaPixels(res.pixels)
      if (!activePixelId && res.pixels[0]) setActivePixelId(res.pixels[0].id)
    }
  }

  async function handleSaveAdAccounts() {
    const accounts = adAccountsInput
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(s => s.startsWith('act_'))
    if (accounts.length === 0) return
    setSavingAdAccounts(true)
    setAdAccountsSaved(false)
    await api.saveConfig({ meta: { ad_accounts: accounts } })
    setSavingAdAccounts(false)
    setAdAccountsSaved(true)
    setTimeout(() => setAdAccountsSaved(false), 3000)
  }

  async function handleSaveMetaToken() {
    if (!metaToken.trim()) return
    setSavingMetaToken(true)
    await api.metaSetToken(metaToken.trim())
    setSavingMetaToken(false)
    setMetaTokenSaved(true)
    setMetaToken('')
    setTimeout(() => setMetaTokenSaved(false), 3000)
  }

  async function handleSavePixel() {
    setSavingPixel(true)
    setPixelSaved(false)
    const ids = metaPixelMode === 'unified' ? selectedPixelIds : [activePixelId]
    const primary = metaPixelMode === 'unified' ? selectedPixelIds[0] : activePixelId
    await api.metaSetPixel(primary, ids)
    setSavingPixel(false)
    setPixelSaved(true)
    setTimeout(() => setPixelSaved(false), 3000)
  }

  function togglePixelSelection(id) {
    setSelectedPixelIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleSaveProperty() {
    setSavingProperty(true)
    setPropertySaved(false)
    await api.ga4SetProperty(activePropertyId)
    setSavingProperty(false)
    setPropertySaved(true)
    setTimeout(() => setPropertySaved(false), 3000)
  }

  async function handleSaveDbTables() {
    setSavingDbTables(true)
    setDbTablesSaved(false)
    const tables = {}
    if (dbTableFunilComercial.trim()) tables.funil_comercial = dbTableFunilComercial.trim()
    if (dbTableFunilMarketing.trim()) tables.funil_marketing = dbTableFunilMarketing.trim()
    if (dbTableCustomerSales.trim())  tables.customer_sales  = dbTableCustomerSales.trim()
    await api.saveConfig({ databricks: { tables } })
    setSavingDbTables(false)
    setDbTablesSaved(true)
    setTimeout(() => setDbTablesSaved(false), 3000)
  }

  async function handleSaveDatabricks() {
    if (!dbHost.trim() || !dbHttpPath.trim() || !dbToken.trim()) return
    setSavingDb(true)
    setDbSaved(false)
    await api.databricksSetConfig({
      host: dbHost.trim(),
      http_path: dbHttpPath.trim(),
      token: dbToken.trim(),
      catalog: dbCatalog.trim() || 'production',
      schema: dbSchema.trim() || 'silver',
    })
    setSavingDb(false)
    setDbToken('') // limpa token após salvar por segurança
    setDbSaved(true)
    setTimeout(() => setDbSaved(false), 3000)
  }

  async function testOne(id) {
    setTestState((prev) => ({ ...prev, [id]: 'testing' }))
    try {
      const result = await TEST_FNS[id]()
      setTestState((prev) => ({ ...prev, [id]: result }))
    } catch (err) {
      setTestState((prev) => ({ ...prev, [id]: { live: false, detail: 'Erro: ' + err.message } }))
    }
  }

  async function handleSaveScSite() {
    if (!scSiteUrl.trim()) return
    setSavingSc(true)
    setScSaved(false)
    await api.scSetSite(scSiteUrl.trim())
    setSavingSc(false)
    setScSaved(true)
    setTimeout(() => setScSaved(false), 3000)
  }

  async function testAll() {
    setTestingAll(true)
    setTestState({ gtm: 'testing', ga4: 'testing', meta: 'testing', databricks: 'testing', searchconsole: 'testing' })
    try {
      const [gtm, ga4, meta, databricks, searchconsole] = await Promise.all([
        TEST_FNS.gtm(),
        TEST_FNS.ga4(),
        TEST_FNS.meta(),
        TEST_FNS.databricks(),
        TEST_FNS.searchconsole(),
      ])
      setTestState({ gtm, ga4, meta, databricks, searchconsole })
    } catch (err) {
      setTestState({ gtm: 'idle', ga4: 'idle', meta: 'idle', databricks: 'idle', searchconsole: 'idle' })
    } finally {
      setTestingAll(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Configurações"
        subtitle="Conexões e preferências do Farol"
        action={
          <button
            onClick={() => setShowCredentialsModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 6,
              border: '1px solid rgba(185,145,91,0.4)',
              background: 'rgba(185,145,91,0.08)',
              color: '#B9915B', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
            }}
          >
            <Shield size={13} /> Credenciais portáteis
          </button>
        }
      />
      {showCredentialsModal && (
        <CredentialsModal
          onClose={() => setShowCredentialsModal(false)}
          onImported={() => setShowCredentialsModal(false)}
        />
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: 'clamp(12px, 2vw, 24px)', minWidth: 0 }}>

        {/* Fontes de dados */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader
            title="Fontes de dados"
            action={
              <button
                onClick={testAll}
                disabled={testingAll}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(185,145,91,0.4)',
                  borderRadius: 6,
                  padding: '5px 12px',
                  color: '#B9915B',
                  cursor: testingAll ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'Manrope, sans-serif',
                }}
              >
                {testingAll
                  ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Testando...</>
                  : <><Zap size={12} /> Testar todas</>
                }
              </button>
            }
          />
          <CardBody style={{ padding: '12px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SOURCES.map((s) => {
                const state = testState[s.id]
                const isTesting = state === 'testing'
                const hasResult = state && typeof state === 'object'

                return (
                  <div key={s.id}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        background: '#031A26',
                        borderRadius: hasResult ? '8px 8px 0 0' : 8,
                        border: '1px solid rgba(185,145,91,0.15)',
                        borderBottom: hasResult ? 'none' : '1px solid rgba(185,145,91,0.15)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            background: 'rgba(185,145,91,0.1)',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Key size={16} color="#B9915B" />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F4F3' }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 2 }}>{s.desc}</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Status badge from test result */}
                        {hasResult && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 12,
                            color: state.live ? '#22C55E' : '#F59E0B',
                          }}>
                            {state.live
                              ? <CheckCircle size={13} />
                              : <AlertTriangle size={13} />
                            }
                            {state.live ? 'Live' : 'Mock'}
                          </div>
                        )}

                        {/* Testar button */}
                        <button
                          onClick={() => testOne(s.id)}
                          disabled={isTesting}
                          style={{
                            background: 'rgba(185,145,91,0.08)',
                            border: '1px solid rgba(185,145,91,0.3)',
                            borderRadius: 6,
                            padding: '5px 12px',
                            color: '#B9915B',
                            cursor: isTesting ? 'not-allowed' : 'pointer',
                            fontSize: 12,
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            fontFamily: 'Manrope, sans-serif',
                          }}
                        >
                          {isTesting
                            ? <><Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> Testando</>
                            : <><Zap size={11} /> Testar</>
                          }
                        </button>

                        <button
                          onClick={() => navigate(s.route)}
                          style={{
                            background: 'rgba(185,145,91,0.1)',
                            border: '1px solid rgba(185,145,91,0.3)',
                            borderRadius: 6,
                            padding: '5px 12px',
                            color: '#B9915B',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 500,
                            fontFamily: 'Manrope, sans-serif',
                          }}
                        >
                          Configurar
                        </button>
                      </div>
                    </div>

                    {/* Result row */}
                    {hasResult && (
                      <div
                        style={{
                          background: state.live ? 'rgba(34,197,94,0.05)' : 'rgba(245,158,11,0.05)',
                          border: `1px solid ${state.live ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
                          borderTop: 'none',
                          borderRadius: '0 0 8px 8px',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Summary line */}
                        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {state.live
                            ? <CheckCircle size={12} color="#22C55E" />
                            : <XCircle size={12} color="#F59E0B" />
                          }
                          <span style={{ fontSize: 11, color: '#8A9BAA' }}>{state.detail}</span>
                        </div>

                        {/* Items list */}
                        {state.live && state.items?.length > 0 && (
                          <div style={{
                            borderTop: `1px solid ${state.live ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)'}`,
                            padding: '8px 16px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}>
                            {state.items.map((item, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: '50%',
                                  background: item.active ? '#B9915B' : '#22C55E',
                                  flexShrink: 0,
                                }} />
                                <span style={{ fontSize: 11, color: '#F5F4F3', fontWeight: item.active ? 600 : 400 }}>
                                  {item.label}
                                </span>
                                {item.account && (
                                  <span style={{ fontSize: 10, color: '#8A9BAA' }}>· {item.account}</span>
                                )}
                                {item.sub && (
                                  <span style={{ fontSize: 10, color: '#8A9BAA', marginLeft: 'auto', fontFamily: 'monospace' }}>
                                    {item.sub}
                                  </span>
                                )}
                                {item.active && (
                                  <span style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: '#B9915B',
                                    background: 'rgba(185,145,91,0.12)',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                  }}>
                                    ativo
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>

        {/* GA4 Property ativa */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="Propriedade GA4 ativa" />
          <CardBody>
            <div style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 10 }}>
              Define qual propriedade GA4 é usada nos relatórios do Farol. Altere para comparar dados entre propriedades.
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Database size={14} color="#B9915B" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <select
                  value={activePropertyId}
                  onChange={(e) => { setActivePropertyId(e.target.value); setPropertySaved(false) }}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 32px',
                    background: '#031A26',
                    border: '1px solid rgba(185,145,91,0.35)',
                    borderRadius: 6,
                    color: '#F5F4F3',
                    fontSize: 13,
                    cursor: 'pointer',
                    outline: 'none',
                    fontFamily: 'Manrope, sans-serif',
                    appearance: 'none',
                  }}
                >
                  {ga4Properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                  {/* Opção manual caso ID não esteja na lista */}
                  {!ga4Properties.find(p => p.id === activePropertyId) && activePropertyId && (
                    <option value={activePropertyId}>{activePropertyId} (manual)</option>
                  )}
                </select>
              </div>
              <button
                onClick={handleSaveProperty}
                disabled={savingProperty}
                style={{
                  padding: '9px 16px',
                  background: propertySaved ? 'rgba(34,197,94,0.15)' : 'rgba(185,145,91,0.12)',
                  border: `1px solid ${propertySaved ? 'rgba(34,197,94,0.4)' : 'rgba(185,145,91,0.35)'}`,
                  borderRadius: 6,
                  color: propertySaved ? '#22C55E' : '#B9915B',
                  cursor: savingProperty ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontFamily: 'Manrope, sans-serif',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >
                {savingProperty
                  ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Salvando</>
                  : propertySaved
                    ? <><CheckCircle size={12} /> Salvo</>
                    : <><Save size={12} /> Salvar</>
                }
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 8 }}>
              ID ativo: <span style={{ color: '#B9915B', fontFamily: 'monospace' }}>{activePropertyId || '—'}</span>
            </div>
          </CardBody>
        </Card>

        {/* Search Console — URL da propriedade */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="Google Search Console — Propriedade" />
          <CardBody>
            <div style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 12 }}>
              Informe a URL exata da propriedade no Search Console. Use o formato <code style={{ color: '#B9915B', fontSize: 11 }}>https://g4educacao.com/</code> (URL prefix) ou <code style={{ color: '#B9915B', fontSize: 11 }}>sc-domain:g4educacao.com</code> (domain property).
              Depois adicione o service account <code style={{ color: '#22C55E', fontSize: 11 }}>g4analyticsca@security-logs-438613.iam.gserviceaccount.com</code> como usuário com permissão Restrita no GSC.
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={13} color="#B9915B" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="https://g4educacao.com/ ou sc-domain:g4educacao.com"
                  value={scSiteUrl}
                  onChange={e => setScSiteUrl(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px 9px 30px',
                    background: '#031A26', border: '1px solid rgba(185,145,91,0.35)',
                    borderRadius: 6, color: '#F5F4F3', fontSize: 13,
                    outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                onClick={handleSaveScSite}
                disabled={savingSc || !scSiteUrl.trim()}
                style={{
                  padding: '9px 16px',
                  background: scSaved ? 'rgba(34,197,94,0.15)' : 'rgba(185,145,91,0.12)',
                  border: `1px solid ${scSaved ? 'rgba(34,197,94,0.4)' : 'rgba(185,145,91,0.35)'}`,
                  borderRadius: 6,
                  color: scSaved ? '#22C55E' : '#B9915B',
                  cursor: (savingSc || !scSiteUrl.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: 'Manrope, sans-serif',
                  whiteSpace: 'nowrap', transition: 'all 0.2s',
                  opacity: !scSiteUrl.trim() ? 0.5 : 1,
                }}
              >
                {savingSc
                  ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Salvando</>
                  : scSaved
                    ? <><CheckCircle size={12} /> Salvo</>
                    : <><Save size={12} /> Salvar</>
                }
              </button>
            </div>
            {scSiteUrl && (
              <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 8 }}>
                Propriedade ativa: <span style={{ color: '#B9915B', fontFamily: 'monospace' }}>{scSiteUrl}</span>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Meta Ads — Token + Pixel */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="Meta Ads — Access Token & Pixel" />
          <CardBody>

            {/* Token */}
            <div style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 10 }}>
              Token de acesso da Graph API. Use um <strong style={{ color: '#F5F4F3' }}>token de sistema</strong> (não expira) do Business Manager para uso contínuo.
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Key size={14} color="#B9915B" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type={metaTokenVisible ? 'text' : 'password'}
                  placeholder="EAAxxxxx... (cole o novo token)"
                  value={metaToken}
                  onChange={e => setMetaToken(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 36px 9px 32px',
                    background: '#031A26',
                    border: '1px solid rgba(185,145,91,0.35)',
                    borderRadius: 6,
                    color: '#F5F4F3',
                    fontSize: 13,
                    outline: 'none',
                    fontFamily: 'Manrope, sans-serif',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={() => setMetaTokenVisible(v => !v)}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8A9BAA', padding: 2 }}
                >
                  {metaTokenVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={handleSaveMetaToken}
                disabled={savingMetaToken || !metaToken.trim()}
                style={{
                  padding: '9px 16px',
                  background: metaTokenSaved ? 'rgba(34,197,94,0.15)' : 'rgba(185,145,91,0.12)',
                  border: `1px solid ${metaTokenSaved ? 'rgba(34,197,94,0.4)' : 'rgba(185,145,91,0.35)'}`,
                  borderRadius: 6,
                  color: metaTokenSaved ? '#22C55E' : '#B9915B',
                  cursor: (savingMetaToken || !metaToken.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontFamily: 'Manrope, sans-serif',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  opacity: !metaToken.trim() ? 0.5 : 1,
                }}
              >
                {savingMetaToken
                  ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Salvando</>
                  : metaTokenSaved
                    ? <><CheckCircle size={12} /> Salvo</>
                    : <><Save size={12} /> Salvar Token</>
                }
              </button>
            </div>

            {/* Separador */}
            <div style={{ borderTop: '1px solid rgba(185,145,91,0.1)', marginBottom: 16 }} />

            {/* Pixel selector */}
            <div style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 10 }}>
              Selecione qual pixel (ou conjunto) usar nos relatórios. Clique em <strong style={{ color: '#F5F4F3' }}>Buscar Pixels</strong> para listar todos da sua conta.
            </div>

            {/* Modo: único vs unificado */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { value: 'single',   label: 'Pixel único'   },
                { value: 'unified',  label: 'Visão unificada (múltiplos)' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setMetaPixelMode(opt.value)}
                  style={{
                    padding: '5px 14px',
                    background: metaPixelMode === opt.value ? 'rgba(185,145,91,0.18)' : 'transparent',
                    border: `1px solid ${metaPixelMode === opt.value ? 'rgba(185,145,91,0.6)' : 'rgba(185,145,91,0.2)'}`,
                    borderRadius: 20,
                    color: metaPixelMode === opt.value ? '#B9915B' : '#8A9BAA',
                    fontSize: 11,
                    fontWeight: metaPixelMode === opt.value ? 700 : 400,
                    cursor: 'pointer',
                    fontFamily: 'Manrope, sans-serif',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                {metaPixels.length === 0 ? (
                  <div style={{ padding: '12px 14px', background: '#031A26', border: '1px solid rgba(185,145,91,0.2)', borderRadius: 6, fontSize: 12, color: '#8A9BAA' }}>
                    {activePixelId
                      ? <>Pixel ativo: <span style={{ color: '#B9915B', fontFamily: 'monospace' }}>{activePixelId}</span> · Busque para ver todos os disponíveis</>
                      : 'Nenhum pixel carregado. Clique em "Buscar Pixels".'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {metaPixels.map(px => {
                      const isActive = activePixelId === px.id
                      const isSelected = selectedPixelIds.includes(px.id)
                      return (
                        <div
                          key={px.id}
                          onClick={() => {
                            if (metaPixelMode === 'single') {
                              setActivePixelId(px.id)
                            } else {
                              togglePixelSelection(px.id)
                              if (!selectedPixelIds.includes(px.id) && selectedPixelIds.length === 0) {
                                setActivePixelId(px.id)
                              }
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 14px',
                            background: (metaPixelMode === 'single' ? isActive : isSelected)
                              ? 'rgba(185,145,91,0.1)' : '#031A26',
                            border: `1px solid ${(metaPixelMode === 'single' ? isActive : isSelected)
                              ? 'rgba(185,145,91,0.5)' : 'rgba(185,145,91,0.15)'}`,
                            borderRadius: 8,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {/* Checkbox/radio visual */}
                          <div style={{
                            width: 16,
                            height: 16,
                            borderRadius: metaPixelMode === 'single' ? '50%' : 4,
                            border: `2px solid ${(metaPixelMode === 'single' ? isActive : isSelected) ? '#B9915B' : 'rgba(185,145,91,0.3)'}`,
                            background: (metaPixelMode === 'single' ? isActive : isSelected) ? '#B9915B' : 'transparent',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {(metaPixelMode === 'single' ? isActive : isSelected) && (
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0D2233' }} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F4F3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {px.name}
                            </div>
                            <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2 }}>
                              ID: <span style={{ fontFamily: 'monospace', color: '#B9915B' }}>{px.id}</span>
                              {px.adAccountName && <> · {px.adAccountName}</>}
                            </div>
                          </div>
                          {px.lastFired && (
                            <div style={{ fontSize: 10, color: '#8A9BAA', whiteSpace: 'nowrap' }}>
                              último disparo {new Date(px.lastFired * 1000).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                          {px.unavailable && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: 4 }}>
                              INDISPONÍVEL
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Botões coluna */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={handleFetchPixels}
                  disabled={loadingPixels}
                  style={{
                    padding: '9px 14px',
                    background: 'rgba(185,145,91,0.08)',
                    border: '1px solid rgba(185,145,91,0.3)',
                    borderRadius: 6,
                    color: '#B9915B',
                    cursor: loadingPixels ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontFamily: 'Manrope, sans-serif',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {loadingPixels
                    ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Buscando</>
                    : <><RefreshCw size={12} /> Buscar Pixels</>
                  }
                </button>

                <button
                  onClick={handleSavePixel}
                  disabled={savingPixel || (!activePixelId && selectedPixelIds.length === 0)}
                  style={{
                    padding: '9px 14px',
                    background: pixelSaved ? 'rgba(34,197,94,0.15)' : 'rgba(185,145,91,0.12)',
                    border: `1px solid ${pixelSaved ? 'rgba(34,197,94,0.4)' : 'rgba(185,145,91,0.35)'}`,
                    borderRadius: 6,
                    color: pixelSaved ? '#22C55E' : '#B9915B',
                    cursor: (savingPixel || (!activePixelId && selectedPixelIds.length === 0)) ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontFamily: 'Manrope, sans-serif',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                  }}
                >
                  {savingPixel
                    ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Salvando</>
                    : pixelSaved
                      ? <><CheckCircle size={12} /> Salvo</>
                      : <><Save size={12} /> Salvar</>
                  }
                </button>
              </div>
            </div>

            {/* Resumo da seleção em modo unificado */}
            {metaPixelMode === 'unified' && selectedPixelIds.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#8A9BAA' }}>
                {selectedPixelIds.length} pixel{selectedPixelIds.length > 1 ? 's' : ''} selecionado{selectedPixelIds.length > 1 ? 's' : ''} · dados serão somados nas visualizações
              </div>
            )}

          </CardBody>
        </Card>

        {/* Meta — Ad Accounts */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="Meta Ads — Ad Accounts" />
          <CardBody>
            <div style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 10 }}>
              IDs das contas de anúncios usadas nos relatórios de Audiência e Criativos.
              Um por linha ou separados por vírgula. Formato: <code style={{ color: '#B9915B', fontSize: 11 }}>act_XXXXXXXXXXXXXXXXX</code>
            </div>
            <textarea
              rows={4}
              value={adAccountsInput}
              onChange={e => setAdAccountsInput(e.target.value)}
              placeholder={'act_942577509469439\nact_584341142722462\nact_324663872349737'}
              style={{
                width: '100%', padding: '9px 12px',
                background: '#031A26', border: '1px solid rgba(185,145,91,0.35)',
                borderRadius: 6, color: '#F5F4F3', fontSize: 12,
                outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box',
                resize: 'vertical', lineHeight: 1.6,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <div style={{ fontSize: 11, color: '#6B7280' }}>
                {adAccountsInput.split(/[\n,]+/).filter(s => s.trim().startsWith('act_')).length} conta(s) configurada(s)
              </div>
              <button
                onClick={handleSaveAdAccounts}
                disabled={savingAdAccounts}
                style={{
                  padding: '8px 18px',
                  background: adAccountsSaved ? 'rgba(34,197,94,0.15)' : 'rgba(185,145,91,0.12)',
                  border: `1px solid ${adAccountsSaved ? 'rgba(34,197,94,0.4)' : 'rgba(185,145,91,0.35)'}`,
                  borderRadius: 6,
                  color: adAccountsSaved ? '#22C55E' : '#B9915B',
                  cursor: savingAdAccounts ? 'not-allowed' : 'pointer',
                  fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: 'Manrope, sans-serif', transition: 'all 0.2s',
                }}
              >
                {savingAdAccounts
                  ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Salvando</>
                  : adAccountsSaved
                    ? <><CheckCircle size={12} /> Salvo</>
                    : <><Save size={12} /> Salvar</>
                }
              </button>
            </div>
          </CardBody>
        </Card>

        {/* Databricks — credenciais */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="Databricks SQL — Credenciais" />
          <CardBody>
            <div style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 14 }}>
              Configure o acesso ao SQL Warehouse. O token é salvo no <code style={{ color: '#B9915B', fontSize: 11 }}>farol.config.json</code> e não é exibido após salvar.
            </div>

            {/* Host */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#8A9BAA', marginBottom: 4 }}>Host</label>
              <div style={{ position: 'relative' }}>
                <Server size={13} color="#B9915B" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="https://dbc-xxxxxx.cloud.databricks.com"
                  value={dbHost}
                  onChange={e => setDbHost(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px 8px 30px',
                    background: '#031A26', border: '1px solid rgba(185,145,91,0.35)',
                    borderRadius: 6, color: '#F5F4F3', fontSize: 12,
                    outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* HTTP Path */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#8A9BAA', marginBottom: 4 }}>HTTP Path</label>
              <input
                type="text"
                placeholder="/sql/1.0/warehouses/xxxxxxxxxxxxxxxx"
                value={dbHttpPath}
                onChange={e => setDbHttpPath(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px',
                  background: '#031A26', border: '1px solid rgba(185,145,91,0.35)',
                  borderRadius: 6, color: '#F5F4F3', fontSize: 12,
                  outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Token */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#8A9BAA', marginBottom: 4 }}>Personal Access Token</label>
              <div style={{ position: 'relative' }}>
                <Key size={13} color="#B9915B" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type={dbTokenVisible ? 'text' : 'password'}
                  placeholder="dapi... (cole o novo token)"
                  value={dbToken}
                  onChange={e => setDbToken(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 36px 8px 30px',
                    background: '#031A26', border: '1px solid rgba(185,145,91,0.35)',
                    borderRadius: 6, color: '#F5F4F3', fontSize: 12,
                    outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={() => setDbTokenVisible(v => !v)}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8A9BAA', padding: 2 }}
                >
                  {dbTokenVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>

            {/* Catalog + Schema */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#8A9BAA', marginBottom: 4 }}>Catalog</label>
                <input
                  type="text"
                  placeholder="production"
                  value={dbCatalog}
                  onChange={e => setDbCatalog(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px',
                    background: '#031A26', border: '1px solid rgba(185,145,91,0.35)',
                    borderRadius: 6, color: '#F5F4F3', fontSize: 12,
                    outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#8A9BAA', marginBottom: 4 }}>Schema</label>
                <input
                  type="text"
                  placeholder="silver"
                  value={dbSchema}
                  onChange={e => setDbSchema(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px',
                    background: '#031A26', border: '1px solid rgba(185,145,91,0.35)',
                    borderRadius: 6, color: '#F5F4F3', fontSize: 12,
                    outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleSaveDatabricks}
              disabled={savingDb || !dbHost.trim() || !dbHttpPath.trim() || !dbToken.trim()}
              style={{
                padding: '9px 20px',
                background: dbSaved ? 'rgba(34,197,94,0.15)' : 'rgba(185,145,91,0.12)',
                border: `1px solid ${dbSaved ? 'rgba(34,197,94,0.4)' : 'rgba(185,145,91,0.35)'}`,
                borderRadius: 6,
                color: dbSaved ? '#22C55E' : '#B9915B',
                cursor: (savingDb || !dbHost.trim() || !dbHttpPath.trim() || !dbToken.trim()) ? 'not-allowed' : 'pointer',
                fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: 'Manrope, sans-serif',
                transition: 'all 0.2s',
                opacity: (!dbHost.trim() || !dbHttpPath.trim() || !dbToken.trim()) ? 0.5 : 1,
              }}
            >
              {savingDb
                ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Salvando</>
                : dbSaved
                  ? <><CheckCircle size={12} /> Salvo</>
                  : <><Save size={12} /> Salvar Databricks</>
              }
            </button>

          </CardBody>
        </Card>

        {/* Databricks — tabelas configuráveis */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title="Databricks — Tabelas" />
          <CardBody>
            <div style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 14 }}>
              Nomes completos das tabelas usadas nas análises. Deixe em branco para usar os padrões baseados em Catalog.Schema configurados acima.
            </div>
            {[
              { label: 'Funil Comercial', placeholder: 'production.diamond.funil_comercial', value: dbTableFunilComercial, set: setDbTableFunilComercial },
              { label: 'Funil Marketing', placeholder: 'production.diamond.funil_marketing', value: dbTableFunilMarketing, set: setDbTableFunilMarketing },
              { label: 'Customer Sales', placeholder: 'production.diamond.customer_360_sales_table', value: dbTableCustomerSales, set: setDbTableCustomerSales },
            ].map(({ label, placeholder, value, set }) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#8A9BAA', marginBottom: 4 }}>{label}</label>
                <input
                  type="text"
                  placeholder={placeholder}
                  value={value}
                  onChange={e => set(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 12px',
                    background: '#031A26', border: '1px solid rgba(185,145,91,0.35)',
                    borderRadius: 6, color: '#F5F4F3', fontSize: 12,
                    outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={handleSaveDbTables}
                disabled={savingDbTables}
                style={{
                  padding: '8px 18px',
                  background: dbTablesSaved ? 'rgba(34,197,94,0.15)' : 'rgba(185,145,91,0.12)',
                  border: `1px solid ${dbTablesSaved ? 'rgba(34,197,94,0.4)' : 'rgba(185,145,91,0.35)'}`,
                  borderRadius: 6,
                  color: dbTablesSaved ? '#22C55E' : '#B9915B',
                  cursor: savingDbTables ? 'not-allowed' : 'pointer',
                  fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: 'Manrope, sans-serif', transition: 'all 0.2s',
                }}
              >
                {savingDbTables
                  ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Salvando</>
                  : dbTablesSaved
                    ? <><CheckCircle size={12} /> Salvo</>
                    : <><Save size={12} /> Salvar Tabelas</>
                }
              </button>
            </div>
          </CardBody>
        </Card>

        {/* Preferências */}
        <Card>
          <CardHeader title="Preferências" />
          <CardBody>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(185,145,91,0.1)' }}>
              <div>
                <div style={{ fontSize: 13, color: '#F5F4F3', fontWeight: 500 }}>Auto-refresh</div>
                <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 2 }}>Intervalo de atualização automática</div>
              </div>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                style={{
                  background: '#031A26',
                  border: '1px solid rgba(185,145,91,0.3)',
                  borderRadius: 6,
                  color: '#F5F4F3',
                  padding: '6px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {[1, 2, 5, 10, 15, 30].map((v) => (
                  <option key={v} value={v}>{v} min</option>
                ))}
              </select>
            </div>

            <div style={{ paddingTop: 16 }}>
              <div style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 10 }}>Sobre</div>
              <div style={{ fontSize: 12, color: '#8A9BAA', lineHeight: 1.8 }}>
                <div><span style={{ color: '#F5F4F3' }}>Farol Tracking</span> — Tracking Intelligence</div>
                <div>Versão 0.6.0 · G4 Education MarTech</div>
                <div>Caio Matheus dos Santos Abra</div>
              </div>
            </div>
          </CardBody>
        </Card>

      </div>
    </div>
  )
}
