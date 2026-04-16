import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import Spinner from '../components/ui/Spinner'
import { Tag, Zap, Variable, ChevronDown, ChevronRight, AlertTriangle, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react'
import { api } from '../services/api'
import { useTracking } from '../context/TrackingContext'
import DataBadge from '../components/ui/DataBadge'

// Eventos esperados em um container de tracking saudável
const EXPECTED_EVENTS = [
  { key: 'page_view',       label: 'Page View',        group: 'GA4',       critical: true  },
  { key: 'generate_lead',   label: 'Generate Lead',    group: 'GA4',       critical: true  },
  { key: 'purchase',        label: 'Purchase',         group: 'GA4',       critical: true  },
  { key: 'begin_checkout',  label: 'Begin Checkout',   group: 'GA4',       critical: false },
  { key: 'view_item',       label: 'View Item',        group: 'GA4',       critical: false },
  { key: 'pageview_meta',   label: 'PageView (Meta)',  group: 'Meta Pixel', critical: true  },
  { key: 'lead_meta',       label: 'Lead (Meta)',      group: 'Meta Pixel', critical: true  },
  { key: 'purchase_meta',   label: 'Purchase (Meta)',  group: 'Meta Pixel', critical: false },
  { key: 'conv_linker',     label: 'Conversion Linker', group: 'Google Ads', critical: false },
  { key: 'adwords_conv',    label: 'Ads Conversion',   group: 'Google Ads', critical: false },
]

export default function GTMPage() {
  const { gtmContainers: ctxContainers } = useTracking()

  const [containers, setContainers]     = useState([])
  const [selectedId, setSelectedId]     = useState(null)
  const [containerData, setContainerData] = useState({})   // { [publicId]: { tags, triggers, variables, mock } }
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [silentTags, setSilentTags]     = useState(null)
  const [silentLoading, setSilentLoading] = useState(true)
  const [expandedTag, setExpandedTag]   = useState(null)
  const [lastUpdated, setLastUpdated]   = useState(null)
  const [containersLoading, setContainersLoading] = useState(true)
  const [healthData, setHealthData]               = useState(null)
  const [healthLoading, setHealthLoading]         = useState(true)

  // Carrega lista de containers
  useEffect(() => {
    loadContainers()
    loadSilentTags()
    loadHealth()
  }, [])

  // Quando seleciona container, carrega detalhes
  useEffect(() => {
    if (selectedId && !containerData[selectedId]) {
      loadContainerDetail(selectedId)
    }
  }, [selectedId])

  // Sincroniza com contexto global quando disponível
  useEffect(() => {
    if (ctxContainers?.length > 0 && containers.length === 0) {
      setContainers(ctxContainers)
      setContainersLoading(false)
      if (!selectedId) setSelectedId(ctxContainers[0]?.id)
    }
  }, [ctxContainers])

  async function loadContainers() {
    setContainersLoading(true)
    const result = await api.gtmContainers()
    const list = result.containers ?? []
    setContainers(list)
    setContainersLoading(false)
    if (!selectedId && list.length > 0) setSelectedId(list[0].id)
  }

  async function loadContainerDetail(publicId) {
    setLoadingDetail(true)
    setExpandedTag(null)
    const result = await api.gtmContainer(publicId)
    setContainerData(prev => ({ ...prev, [publicId]: result }))
    setLoadingDetail(false)
    setLastUpdated(Date.now())
  }

  async function loadSilentTags() {
    setSilentLoading(true)
    const r = await api.gtmSilentTags()
    setSilentTags(r)
    setSilentLoading(false)
  }

  async function loadHealth() {
    setHealthLoading(true)
    const r = await api.gtmHealth()
    setHealthData(r)
    setHealthLoading(false)
  }

  function handleRefresh() {
    loadContainers()
    loadSilentTags()
    loadHealth()
    if (selectedId) {
      setContainerData(prev => { const n = { ...prev }; delete n[selectedId]; return n })
    }
    setLastUpdated(Date.now())
  }

  function handleSelectContainer(id) {
    setSelectedId(id)
    setExpandedTag(null)
  }

  const detail = selectedId ? containerData[selectedId] : null
  const tags = detail?.tags ?? []
  const triggers = detail?.triggers ?? []
  const variables = detail?.variables ?? []
  const selectedContainer = containers.find(c => c.id === selectedId)

  // Agrupa containers por conta
  const accounts = {}
  containers.forEach(c => {
    const acc = c.account || 'Outros'
    if (!accounts[acc]) accounts[acc] = []
    accounts[acc].push(c)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="GTM"
        subtitle="Containers, tags e triggers em tempo real"
        onRefresh={handleRefresh}
        lastUpdated={lastUpdated}
        action={<DataBadge data={healthData} />}
        select={containers.length > 0 ? {
          label: 'Container:',
          value: selectedId ?? '',
          onChange: handleSelectContainer,
          groups: Object.entries(accounts).map(([accName, cs]) => ({
            label: accName,
            options: cs.map(c => ({ value: c.id, label: `${c.name} — ${c.id}` })),
          })),
        } : undefined}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 'clamp(12px, 2vw, 24px)', minWidth: 0 }}>

        {/* Cards de containers */}
        {containersLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(containers.length, 4)}, 1fr)`,
            gap: 12, marginBottom: 20,
          }}>
            {containers.map((c) => {
              const det = containerData[c.id]
              const isSelected = c.id === selectedId
              return (
                <Card
                  key={c.id}
                  onClick={() => handleSelectContainer(c.id)}
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? '#B9915B' : 'rgba(185,145,91,0.25)',
                    boxShadow: isSelected ? '0 0 0 1px rgba(185,145,91,0.25)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <CardBody>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontFamily: "'PPMuseum','Georgia',serif",
                          fontSize: 13, lineHeight: 1.3,
                          color: isSelected ? '#B9915B' : '#F5F4F3',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {c.name}
                        </div>
                        <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2, fontFamily: 'monospace' }}>{c.id}</div>
                      </div>
                      <StatusBadge status={det?.mock === false ? 'ok' : 'loading'} size="sm" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                      {[
                        { icon: Tag,      val: det?.counts?.tags,      label: 'Tags' },
                        { icon: Zap,      val: det?.counts?.triggers,  label: 'Trig.' },
                        { icon: Variable, val: det?.counts?.variables, label: 'Vars' },
                      ].map(({ icon: Icon, val, label }) => (
                        <div key={label} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#F5F4F3' }}>
                            {val != null ? val : <span style={{ color: '#8A9BAA', fontSize: 12 }}>—</span>}
                          </div>
                          <div style={{ fontSize: 9, color: '#8A9BAA', letterSpacing: '0.04em' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    {det?.mock === false && (
                      <div style={{ fontSize: 9, color: '#22C55E', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                        Live
                      </div>
                    )}
                  </CardBody>
                </Card>
              )
            })}
          </div>
        )}

        {/* Tags sem trigger / pausadas */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader
            title="Tags sem trigger ou pausadas"
            action={silentLoading ? null : (
              <span style={{ fontSize: 11, color: (silentTags?.tags?.length ?? 0) > 0 ? '#F59E0B' : '#22C55E' }}>
                {silentTags?.mock ? 'mock · ' : ''}{silentTags?.tags?.length ?? 0} {(silentTags?.tags?.length ?? 0) === 1 ? 'tag' : 'tags'}
              </span>
            )}
          />
          {silentLoading ? (
            <CardBody><div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Spinner /></div></CardBody>
          ) : (silentTags?.tags?.length ?? 0) === 0 ? (
            <CardBody>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#22C55E' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                Todos os containers com acesso estão limpos — nenhuma tag sem trigger ou pausada.
              </div>
            </CardBody>
          ) : (
            <div>
              {silentTags.tags.map((t, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 20px',
                  borderBottom: i < silentTags.tags.length - 1 ? '1px solid rgba(185,145,91,0.08)' : 'none',
                }}>
                  <AlertTriangle size={14} color={t.issue === 'pausada' ? '#8A9BAA' : '#F59E0B'} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F4F3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 1 }}>
                      {t.containerName} <span style={{ color: 'rgba(185,145,91,0.4)' }}>·</span> {t.container}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8A9BAA', background: 'rgba(138,155,170,0.1)', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>
                    {t.type}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                    color: t.issue === 'pausada' ? '#8A9BAA' : '#F59E0B',
                    background: t.issue === 'pausada' ? 'rgba(138,155,170,0.1)' : 'rgba(245,158,11,0.1)',
                    border: `1px solid ${t.issue === 'pausada' ? 'rgba(138,155,170,0.2)' : 'rgba(245,158,11,0.3)'}`,
                  }}>
                    {t.issueLabel}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Mapa de Cobertura GTM ── */}
        {(() => {
          // Detecta quais eventos esperados têm tag ativa no container selecionado
          const allTagNames = tags.map(t => (t.name || '').toLowerCase())
          const connections = healthData?.connections || []

          // Mapa de cobertura: cruza tags do container + conexões do health check
          const coverage = EXPECTED_EVENTS.map(ev => {
            // Tenta detectar pela name da tag (busca substring)
            const found = allTagNames.some(n =>
              n.includes(ev.key.replace('_', '')) ||
              n.includes(ev.key) ||
              n.replace(/[^a-z0-9]/g, '').includes(ev.key.replace(/_/g, ''))
            )
            // Para checks de infra (conv_linker, pageview_meta), complementa com health
            let status = found ? 'ok' : 'missing'
            if (ev.key === 'conv_linker') {
              const linker = connections.find(c => c.key === 'gtm_linker')
              if (linker?.ok) status = 'ok'
            }
            if (ev.key === 'pageview_meta') {
              const meta = connections.find(c => c.key === 'gtm_meta')
              if (meta?.ok) status = 'ok'
            }
            if (ev.key === 'page_view') {
              const ga4 = connections.find(c => c.key === 'gtm_ga4')
              if (ga4?.ok) status = 'ok'
            }
            return { ...ev, status }
          })

          const okCount       = coverage.filter(c => c.status === 'ok').length
          const missingCrit   = coverage.filter(c => c.status === 'missing' && c.critical)
          const missingOpt    = coverage.filter(c => c.status === 'missing' && !c.critical)
          const coveragePct   = Math.round((okCount / coverage.length) * 100)
          const groups        = [...new Set(EXPECTED_EVENTS.map(e => e.group))]

          return (
            <Card style={{ marginBottom: 20 }}>
              <CardHeader
                title="Mapa de Cobertura"
                action={
                  healthLoading ? null : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <DataBadge data={healthData} />
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: coveragePct >= 80 ? '#22C55E' : coveragePct >= 60 ? '#F59E0B' : '#EF4444',
                      }}>
                        {okCount}/{coverage.length} · {coveragePct}%
                      </span>
                    </div>
                  )
                }
              />
              <CardBody>
                {healthLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                    <RefreshCw size={16} color="#6B7280" style={{ animation: 'spin 1s linear infinite' }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                ) : (
                  <>
                    {/* Barra de progresso geral */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: '#8A9BAA' }}>Cobertura de eventos esperados</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: coveragePct >= 80 ? '#22C55E' : '#F59E0B' }}>{coveragePct}%</span>
                      </div>
                      <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 4, transition: 'width 0.6s ease',
                          width: `${coveragePct}%`,
                          background: coveragePct >= 80 ? '#22C55E' : coveragePct >= 60 ? '#F59E0B' : '#EF4444',
                        }} />
                      </div>
                    </div>

                    {/* Grid por grupo */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
                      {groups.map(grp => {
                        const grpItems = coverage.filter(c => c.group === grp)
                        const grpOk    = grpItems.filter(c => c.status === 'ok').length
                        const grpColor = grpOk === grpItems.length ? '#22C55E' : grpOk > 0 ? '#F59E0B' : '#EF4444'
                        return (
                          <div key={grp} style={{
                            background: '#0D1B26', border: `1px solid ${grpColor}22`, borderRadius: 8, padding: '10px 14px',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: grpColor }}>{grp}</span>
                              <span style={{ fontSize: 10, color: '#6B7280' }}>{grpOk}/{grpItems.length}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {grpItems.map(ev => (
                                <div key={ev.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {ev.status === 'ok'
                                    ? <ShieldCheck size={13} color="#22C55E" />
                                    : <ShieldAlert size={13} color={ev.critical ? '#EF4444' : '#F59E0B'} />
                                  }
                                  <span style={{
                                    fontSize: 12, color: ev.status === 'ok' ? '#F5F4F3' : ev.critical ? '#EF4444' : '#F59E0B',
                                    fontWeight: ev.critical ? 600 : 400,
                                  }}>
                                    {ev.label}
                                  </span>
                                  {ev.critical && ev.status === 'missing' && (
                                    <span style={{ fontSize: 9, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: 3, marginLeft: 'auto' }}>crítico</span>
                                  )}
                                  {ev.status === 'ok' && (
                                    <span style={{ fontSize: 9, color: '#22C55E', marginLeft: 'auto' }}>ativo</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Conexões de infra */}
                    {connections.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Conexões de infraestrutura
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {connections.map(conn => (
                            <div key={conn.key} style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              background: conn.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                              border: `1px solid ${conn.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                              borderRadius: 6, padding: '4px 10px',
                            }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: conn.ok ? '#22C55E' : '#EF4444', flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: conn.ok ? '#86EFAC' : '#FCA5A5', fontWeight: 600 }}>{conn.label}</span>
                              <span style={{ fontSize: 10, color: '#6B7280' }}>{conn.detail}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Alertas críticos */}
                    {missingCrit.length > 0 && (
                      <div style={{
                        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 7, padding: '8px 12px', fontSize: 11, color: '#FCA5A5',
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                      }}>
                        <AlertTriangle size={13} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
                        <span>
                          <strong>Eventos críticos ausentes:</strong>{' '}
                          {missingCrit.map(c => c.label).join(', ')}.
                          {' '}Verifique se as tags foram pausadas ou removidas.
                        </span>
                      </div>
                    )}
                  </>
                )}
              </CardBody>
            </Card>
          )
        })()}

        {/* Detail do container selecionado */}
        {selectedContainer && (
          <Card>
            <CardHeader
              title={`Tags — ${selectedContainer.name}`}
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {loadingDetail ? (
                    <Spinner size={13} />
                  ) : detail ? (
                    <span style={{ fontSize: 11, color: '#8A9BAA' }}>
                      {detail.mock ? 'mock · ' : ''}
                      {tags.filter(t => t.status === 'error').length > 0 && (
                        <span style={{ color: '#EF4444', marginRight: 8 }}>
                          {tags.filter(t => t.status === 'error').length} erros
                        </span>
                      )}
                      {tags.filter(t => t.status === 'warn').length > 0 && (
                        <span style={{ color: '#F59E0B' }}>
                          {tags.filter(t => t.status === 'warn').length} avisos
                        </span>
                      )}
                      {tags.filter(t => t.status === 'error').length === 0 &&
                       tags.filter(t => t.status === 'warn').length === 0 && (
                        <span style={{ color: '#22C55E' }}>tudo ok</span>
                      )}
                    </span>
                  ) : null}
                  <button
                    onClick={() => loadContainerDetail(selectedId)}
                    style={{
                      background: 'rgba(185,145,91,0.08)', border: '1px solid rgba(185,145,91,0.3)',
                      borderRadius: 5, padding: '4px 10px', color: '#B9915B',
                      fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                      fontFamily: 'Manrope, sans-serif',
                    }}
                  >
                    <RefreshCw size={11} />
                    Recarregar
                  </button>
                </div>
              }
            />

            {loadingDetail ? (
              <CardBody><div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div></CardBody>
            ) : !detail ? (
              <CardBody>
                <div style={{ fontSize: 12, color: '#8A9BAA', textAlign: 'center', padding: 16 }}>
                  Clique em "Recarregar" para buscar as tags deste container.
                </div>
              </CardBody>
            ) : tags.length === 0 ? (
              <CardBody>
                <div style={{ fontSize: 12, color: '#8A9BAA', textAlign: 'center', padding: 16 }}>
                  Nenhuma tag encontrada neste workspace.
                </div>
              </CardBody>
            ) : (
              <div>
                {tags.map((tag, i) => (
                  <div key={tag.tagId ?? tag.name}>
                    <div
                      onClick={() => setExpandedTag(expandedTag === i ? null : i)}
                      style={{
                        display: 'flex', alignItems: 'center', padding: '12px 20px', cursor: 'pointer',
                        borderBottom: '1px solid rgba(185,145,91,0.08)',
                        background: expandedTag === i ? 'rgba(185,145,91,0.05)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (expandedTag !== i) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                      onMouseLeave={e => { if (expandedTag !== i) e.currentTarget.style.background = 'transparent' }}
                    >
                      {expandedTag === i
                        ? <ChevronDown size={14} color="#8A9BAA" style={{ marginRight: 10, flexShrink: 0 }} />
                        : <ChevronRight size={14} color="#8A9BAA" style={{ marginRight: 10, flexShrink: 0 }} />
                      }
                      <Tag size={13} color="#B9915B88" style={{ marginRight: 10, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#F5F4F3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tag.name}
                      </span>
                      <span style={{ fontSize: 11, color: '#8A9BAA', background: 'rgba(138,155,170,0.1)', padding: '2px 8px', borderRadius: 4, marginRight: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {tag.type}
                      </span>
                      <StatusBadge status={tag.status} size="sm" />
                    </div>
                    {expandedTag === i && (
                      <div style={{ padding: '12px 20px 14px 52px', background: 'rgba(185,145,91,0.03)', borderBottom: '1px solid rgba(185,145,91,0.08)' }}>
                        <div style={{ fontSize: 11, color: '#8A9BAA', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Triggers vinculados
                        </div>
                        {tag.triggers.length === 0 ? (
                          <span style={{ fontSize: 12, color: '#EF4444' }}>Nenhum trigger — tag não vai disparar</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {tag.triggers.map((t) => (
                              <span key={t} style={{
                                background: 'rgba(185,145,91,0.12)', border: '1px solid rgba(185,145,91,0.25)',
                                color: '#B9915B', padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                              }}>
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {tag.tagId && (
                          <div style={{ fontSize: 10, color: '#8A9BAA44', marginTop: 8, fontFamily: 'monospace' }}>
                            tagId: {tag.tagId}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

      </div>
    </div>
  )
}
