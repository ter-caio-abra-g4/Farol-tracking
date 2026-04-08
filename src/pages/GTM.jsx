import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import Spinner from '../components/ui/Spinner'
import { Tag, Zap, Variable, ChevronDown, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react'
import { api } from '../services/api'
import { useTracking } from '../context/TrackingContext'

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

  // Carrega lista de containers
  useEffect(() => {
    loadContainers()
    loadSilentTags()
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

  function handleRefresh() {
    loadContainers()
    loadSilentTags()
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

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

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
