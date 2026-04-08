import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import { Key, CheckCircle, AlertTriangle, Zap, Loader, XCircle, Database, Save } from 'lucide-react'
import { api } from '../services/api'

const SOURCES = [
  { id: 'gtm', name: 'Google Tag Manager', desc: 'Containers, tags e triggers via API' },
  { id: 'ga4', name: 'Google Analytics 4', desc: 'Dados de eventos e propriedades GA4' },
  { id: 'meta', name: 'Meta Ads — Conversions API', desc: 'Pixel e eventos via CAPI' },
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
}

// Propriedades GA4 conhecidas (base estática + o que a API retornar)
const KNOWN_PROPERTIES = [
  { id: '521780491', name: 'G4 Educacao - Principal' },
]

export default function SettingsPage() {
  const [refreshInterval, setRefreshInterval] = useState(5)
  // testState: { [id]: 'idle' | 'testing' | { live, detail } }
  const [testState, setTestState] = useState({ gtm: 'idle', ga4: 'idle', meta: 'idle' })
  const [testingAll, setTestingAll] = useState(false)

  // GA4 property selector
  const [ga4Properties, setGa4Properties] = useState(KNOWN_PROPERTIES)
  const [activePropertyId, setActivePropertyId] = useState('521780491')
  const [savingProperty, setSavingProperty] = useState(false)
  const [propertySaved, setPropertySaved] = useState(false)

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
  }, [])

  async function handleSaveProperty() {
    setSavingProperty(true)
    setPropertySaved(false)
    await api.ga4SetProperty(activePropertyId)
    setSavingProperty(false)
    setPropertySaved(true)
    setTimeout(() => setPropertySaved(false), 3000)
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

  async function testAll() {
    setTestingAll(true)
    setTestState({ gtm: 'testing', ga4: 'testing', meta: 'testing' })
    try {
      const [gtm, ga4, meta] = await Promise.all([
        TEST_FNS.gtm(),
        TEST_FNS.ga4(),
        TEST_FNS.meta(),
      ])
      setTestState({ gtm, ga4, meta })
    } catch (err) {
      setTestState({ gtm: 'idle', ga4: 'idle', meta: 'idle' })
    } finally {
      setTestingAll(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header title="Configurações" subtitle="Conexões e preferências do Farol" />

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

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
                          Editar
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
                <div>Versão 1.0.0 · G4 Education MarTech</div>
                <div>Caio Matheus dos Santos Abra</div>
              </div>
            </div>
          </CardBody>
        </Card>

      </div>
    </div>
  )
}
