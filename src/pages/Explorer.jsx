import { useState, useEffect, useMemo } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import Spinner from '../components/ui/Spinner'
import { Search, BarChart2, Tag, ChevronDown, ChevronRight, X, Database } from 'lucide-react'
import { api } from '../services/api'
import { useTracking } from '../context/TrackingContext'

export default function Explorer() {
  const { selectedGA4, selectedGTM, gtmContainers } = useTracking()

  const [tab, setTab]               = useState('events')
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selected, setSelected]     = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  // Dados GA4
  const [events, setEvents]         = useState([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsMock, setEventsMock] = useState(true)

  // Dados GTM (agrega todos os containers visíveis)
  const [gtmTags, setGtmTags]       = useState([])
  const [tagsLoading, setTagsLoading] = useState(true)
  const [tagsMock, setTagsMock]     = useState(true)

  // Dados Tabelas DB
  const [dbTables, setDbTables]         = useState([])
  const [dbTablesLoading, setDbTablesLoading] = useState(false)
  const [dbTablesMock, setDbTablesMock] = useState(true)
  const [dbSelected, setDbSelected]     = useState(null)
  const [dbPreview, setDbPreview]       = useState(null)
  const [dbPreviewLoading, setDbPreviewLoading] = useState(false)

  // Carrega eventos GA4
  useEffect(() => {
    if (!selectedGA4) return
    setEventsLoading(true)
    api.ga4Events(selectedGA4).then(r => {
      const evList = r?.events ?? []
      setEvents(evList)
      setEventsMock(r?.mock ?? true)
      setEventsLoading(false)
      setLastUpdated(Date.now())
    })
  }, [selectedGA4])

  // Carrega tags GTM — usa containers do contexto global
  useEffect(() => {
    loadGtmTags()
  }, [selectedGTM, gtmContainers])

  async function loadDbTables() {
    setDbTablesLoading(true)
    const r = await api.databricksTables()
    setDbTables(r?.tables ?? [])
    setDbTablesMock(r?.mock ?? true)
    setDbTablesLoading(false)
    setLastUpdated(Date.now())
  }

  async function loadDbPreview(tableName) {
    setDbSelected(tableName)
    setDbPreview(null)
    setDbPreviewLoading(true)
    const r = await api.databricksPreview(tableName)
    setDbPreview(r)
    setDbPreviewLoading(false)
  }

  // Carrega tabelas DB quando a aba é selecionada
  useEffect(() => {
    if (tab === 'db' && dbTables.length === 0) loadDbTables()
  }, [tab])

  async function loadGtmTags() {
    if (!gtmContainers?.length) return
    setTagsLoading(true)

    const visible = selectedGTM === 'all'
      ? gtmContainers
      : gtmContainers.filter(c => c.id === selectedGTM)

    // Carrega detalhes de cada container (até 4 em paralelo)
    const results = await Promise.all(
      visible.slice(0, 8).map(c => api.gtmContainer(c.id))
    )

    // Agrega tags de todos os containers com info do container
    const allTags = []
    results.forEach((r, idx) => {
      const container = visible[idx]
      ;(r?.tags ?? []).forEach(t => {
        allTags.push({
          ...t,
          container: container.id,
          containerName: container.name,
          mock: r?.mock ?? true,
        })
      })
    })

    setGtmTags(allTags)
    setTagsMock(results.some(r => r?.mock))
    setTagsLoading(false)
    setLastUpdated(Date.now())
  }

  function handleRefresh() {
    if (tab === 'events') {
      setEventsLoading(true)
      api.ga4Events(selectedGA4).then(r => {
        setEvents(r?.events ?? [])
        setEventsMock(r?.mock ?? true)
        setEventsLoading(false)
        setLastUpdated(Date.now())
      })
    } else if (tab === 'db') {
      loadDbTables()
      setDbSelected(null)
      setDbPreview(null)
    } else {
      loadGtmTags()
    }
    setSelected(null)
  }

  // Filtragem
  const filteredEvents = useMemo(() => events.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || e.status === filterStatus
    return matchSearch && matchStatus
  }), [events, search, filterStatus])

  const filteredTags = useMemo(() => gtmTags.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || t.status === filterStatus
    return matchSearch && matchStatus
  }), [gtmTags, search, filterStatus])

  const loading = tab === 'events' ? eventsLoading : tab === 'db' ? dbTablesLoading : tagsLoading
  const isMock  = tab === 'events' ? eventsMock    : tab === 'db' ? dbTablesMock    : tagsMock

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Explorador"
        subtitle="Eventos GA4 e tags GTM em tempo real"
        onRefresh={handleRefresh}
        lastUpdated={lastUpdated}
        showGTM
        showGA4
      />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: 0 }}>

        {/* ── Lista ── */}
        <div style={{
          width: selected ? '55%' : '100%',
          overflow: 'auto', padding: 24,
          transition: 'width 0.2s ease',
          minWidth: 0,
        }}>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 0, marginBottom: 16,
            background: '#001F35', border: '1px solid rgba(185,145,91,0.4)',
            borderRadius: 8, padding: 4,
          }}>
            {[
              { id: 'events', label: 'Eventos GA4', icon: BarChart2 },
              { id: 'tags',   label: 'Tags GTM',    icon: Tag },
              { id: 'db',     label: 'Tabelas DB',  icon: Database },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setTab(id); setSelected(null); setSearch(''); setFilterStatus('all') }}
                style={{
                  flex: 1, padding: '8px 16px', border: 'none', borderRadius: 6,
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  background: tab === id ? '#B9915B' : 'transparent',
                  color: tab === id ? '#031A26' : '#8A9BAA',
                  transition: 'all 0.15s', fontFamily: 'Manrope, sans-serif',
                }}
              >
                <Icon size={14} />
                {label}
                {!loading && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    background: tab === id ? 'rgba(3,26,38,0.2)' : 'rgba(185,145,91,0.15)',
                    color: tab === id ? '#031A26' : '#B9915B',
                    padding: '1px 6px', borderRadius: 10,
                  }}>
                    {id === 'events' ? filteredEvents.length : id === 'db' ? dbTables.length : filteredTags.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Barra de busca + filtros */}
          <div style={{ display: tab === 'db' ? 'none' : 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8A9BAA' }} />
              <input
                type="text"
                placeholder={tab === 'events' ? 'Buscar evento...' : 'Buscar tag...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 12px 8px 34px',
                  background: '#001F35', border: '1px solid rgba(185,145,91,0.3)',
                  borderRadius: 6, color: '#F5F4F3', fontSize: 13,
                  outline: 'none', fontFamily: 'Manrope, sans-serif',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'ok', 'warn', 'error'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  style={{
                    padding: '6px 12px', border: '1px solid',
                    borderColor: filterStatus === s ? '#B9915B' : 'rgba(185,145,91,0.25)',
                    borderRadius: 6,
                    background: filterStatus === s ? 'rgba(185,145,91,0.15)' : 'transparent',
                    color: filterStatus === s ? '#B9915B' : '#8A9BAA',
                    cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    fontFamily: 'Manrope, sans-serif',
                  }}
                >
                  {s === 'all' ? 'Todos' : s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Badge mock */}
          {isMock && !loading && (
            <div style={{
              fontSize: 11, color: '#F59E0B', marginBottom: 10,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
              padding: '5px 12px', borderRadius: 6,
            }}>
              Dados mock — conecte a API para dados reais
            </div>
          )}

          {/* Conteúdo */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner /></div>
          ) : tab === 'events' ? (
            <EventsTable
              events={filteredEvents}
              selected={selected}
              onSelect={setSelected}
            />
          ) : tab === 'db' ? (
            <DbTablesPanel
              tables={dbTables}
              selected={dbSelected}
              preview={dbPreview}
              previewLoading={dbPreviewLoading}
              onSelect={loadDbPreview}
            />
          ) : (
            <TagsTable
              tags={filteredTags}
              selected={selected}
              onSelect={setSelected}
            />
          )}
        </div>

        {/* ── Painel de detalhe ── */}
        {selected && tab !== 'db' && (
          <div style={{
            width: '45%', borderLeft: '1px solid rgba(185,145,91,0.2)',
            overflow: 'auto', padding: 24, flexShrink: 0,
          }}>
            <DetailPanel item={selected} onClose={() => setSelected(null)} />
          </div>
        )}

      </div>
    </div>
  )
}


// ── Painel de tabelas Databricks ──────────────────────────────────────────────
function DbTablesPanel({ tables, selected, preview, previewLoading, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 12, height: '100%', minHeight: 400 }}>
      {/* Lista */}
      <Card style={{ width: 260, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(185,145,91,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tabelas</span>
          <span style={{ fontSize: 11, color: '#8A9BAA' }}>{tables.length}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tables.length === 0 ? (
            <div style={{ padding: 20, fontSize: 12, color: '#8A9BAA', textAlign: 'center' }}>
              Nenhuma tabela.<br />Configure o Databricks em Settings.
            </div>
          ) : tables.map((t, i) => (
            <button
              key={i}
              onClick={() => onSelect(t.fullName)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 14px',
                background: selected === t.fullName ? 'rgba(185,145,91,0.08)' : 'transparent',
                borderLeft: selected === t.fullName ? '2px solid #B9915B' : '2px solid transparent',
                border: 'none', borderBottom: '1px solid rgba(185,145,91,0.07)',
                cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: '#F5F4F3', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.name}
              </div>
              <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2 }}>{t.schema}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Preview */}
      <Card style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!selected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 10, color: '#8A9BAA' }}>
            <Database size={28} strokeWidth={1} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 12 }}>Selecione uma tabela</span>
          </div>
        ) : previewLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}><Spinner /></div>
        ) : preview ? (
          <>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(185,145,91,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#B9915B' }}>{selected}</span>
              <span style={{ fontSize: 11, color: '#8A9BAA' }}>
                {preview.columns?.length ?? 0} colunas · {preview.rows?.length ?? 0} linhas (preview)
                {preview.mock && <span style={{ color: '#F59E0B', marginLeft: 8 }}>mock</span>}
              </span>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {preview.columns?.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.2)', position: 'sticky', top: 0, background: '#001A2E' }}>
                      {preview.columns.map((col, ci) => (
                        <th key={ci} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#8A9BAA', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          <div style={{ fontFamily: 'monospace', color: '#F5F4F3' }}>{col.name}</div>
                          <div style={{ fontSize: 9, color: '#8A9BAA55' }}>{col.type}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.rows ?? []).map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: '1px solid rgba(185,145,91,0.06)' }}>
                        {preview.columns.map((col, ci) => (
                          <td key={ci} style={{ padding: '6px 12px', color: '#F5F4F3', fontFamily: 'monospace', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row[col.name] == null ? <span style={{ color: '#8A9BAA55' }}>null</span> : String(row[col.name])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : null}
      </Card>
    </div>
  )
}

// ── Tabela de eventos ─────────────────────────────────────────────────────────
function EventsTable({ events, selected, onSelect }) {
  if (events.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#8A9BAA', textAlign: 'center', padding: 32 }}>
        Nenhum evento encontrado.
      </div>
    )
  }
  return (
    <Card>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.2)' }}>
            {['Evento', 'Fonte', 'Contagem', 'Último disparo', 'Status'].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#8A9BAA', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map(ev => {
            const isActive = selected?.data?.name === ev.name
            return (
              <tr
                key={ev.name}
                onClick={() => onSelect({ type: 'event', data: ev })}
                style={{
                  borderBottom: '1px solid rgba(185,145,91,0.08)',
                  cursor: 'pointer',
                  background: isActive ? 'rgba(185,145,91,0.06)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#F5F4F3', fontFamily: 'monospace' }}>
                  {ev.name}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ fontSize: 11, color: '#8A9BAA', background: 'rgba(138,155,170,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                    {ev.source || 'GA4'}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: '#F5F4F3', fontWeight: 500 }}>
                  {(ev.count || 0).toLocaleString('pt-BR')}
                </td>
                <td style={{ padding: '10px 16px', fontSize: 12, color: '#8A9BAA' }}>
                  {ev.lastSeen || '—'}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <StatusBadge status={ev.status || 'ok'} size="sm" />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

// ── Tabela de tags GTM ────────────────────────────────────────────────────────
function TagsTable({ tags, selected, onSelect }) {
  const [expandedRow, setExpandedRow] = useState(null)

  if (tags.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#8A9BAA', textAlign: 'center', padding: 32 }}>
        Nenhuma tag encontrada. Selecione um container GTM no topo.
      </div>
    )
  }

  return (
    <Card>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.2)' }}>
            {['Tag', 'Container', 'Tipo', 'Triggers', 'Status', ''].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#8A9BAA', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tags.map((tag, i) => {
            const isOpen = expandedRow === i
            const isActive = selected?.data?.name === tag.name && selected?.data?.container === tag.container
            return [
              <tr
                key={`tag-${i}`}
                onClick={() => { setExpandedRow(isOpen ? null : i); onSelect({ type: 'tag', data: tag }) }}
                style={{
                  borderBottom: isOpen ? 'none' : '1px solid rgba(185,145,91,0.08)',
                  cursor: 'pointer',
                  background: isActive ? 'rgba(185,145,91,0.06)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#F5F4F3', maxWidth: 180 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag.name}</div>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ fontSize: 10, color: '#8A9BAA', fontFamily: 'monospace' }}>{tag.container}</span>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ fontSize: 11, color: '#8A9BAA', background: 'rgba(138,155,170,0.1)', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                    {tag.type}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: tag.triggers?.length === 0 ? '#EF4444' : '#F5F4F3' }}>
                  {tag.triggers?.length ?? 0}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <StatusBadge status={tag.status || 'ok'} size="sm" />
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                  {isOpen ? <ChevronDown size={13} color="#8A9BAA" /> : <ChevronRight size={13} color="#8A9BAA" />}
                </td>
              </tr>,
              isOpen && (
                <tr key={`tag-detail-${i}`} style={{ borderBottom: '1px solid rgba(185,145,91,0.08)' }}>
                  <td colSpan={6} style={{ padding: '8px 16px 12px 32px', background: 'rgba(185,145,91,0.03)' }}>
                    <div style={{ fontSize: 11, color: '#8A9BAA', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Triggers vinculados
                    </div>
                    {!tag.triggers?.length ? (
                      <span style={{ fontSize: 12, color: '#EF4444' }}>Nenhum trigger — tag não vai disparar</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {tag.triggers.map(t => (
                          <span key={t} style={{
                            background: 'rgba(185,145,91,0.12)', border: '1px solid rgba(185,145,91,0.25)',
                            color: '#B9915B', padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ),
            ]
          })}
        </tbody>
      </table>
    </Card>
  )
}

// ── Painel de detalhe ─────────────────────────────────────────────────────────
function DetailPanel({ item, onClose }) {
  const { type, data } = item

  const fields = type === 'event'
    ? [
        { label: 'Nome',         value: data.name },
        { label: 'Contagem',     value: (data.count || 0).toLocaleString('pt-BR') },
        { label: 'Fonte',        value: data.source || 'GA4' },
        { label: 'Último disparo', value: data.lastSeen || '—' },
        { label: 'Status',       value: data.status },
      ]
    : [
        { label: 'Nome',         value: data.name },
        { label: 'Container',    value: `${data.containerName} (${data.container})` },
        { label: 'Tipo',         value: data.type },
        { label: 'Triggers',     value: data.triggers?.length ?? 0 },
        { label: 'Status',       value: data.status },
        ...(data.tagId ? [{ label: 'Tag ID', value: data.tagId }] : []),
      ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'PPMuseum','Georgia',serif", fontSize: 16, color: '#B9915B' }}>
          {type === 'event' ? 'Evento' : 'Tag GTM'}
        </h2>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: '1px solid rgba(185,145,91,0.3)', borderRadius: 6, color: '#8A9BAA', cursor: 'pointer', padding: '4px 8px' }}
        >
          <X size={13} />
        </button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <CardBody>
          <div style={{ fontFamily: "'PPMuseum','Georgia',serif", fontSize: 17, color: '#F5F4F3', marginBottom: 8, wordBreak: 'break-all' }}>
            {data.name}
          </div>
          <StatusBadge status={data.status || 'ok'} />
        </CardBody>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <CardHeader title="Propriedades" />
        <CardBody style={{ padding: '4px 16px 12px' }}>
          {fields.filter(f => f.label !== 'Nome' && f.label !== 'Status').map(f => (
            <div key={f.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '9px 0', borderBottom: '1px solid rgba(185,145,91,0.08)', fontSize: 13,
            }}>
              <span style={{ color: '#8A9BAA', flexShrink: 0, marginRight: 12 }}>{f.label}</span>
              <span style={{ color: '#F5F4F3', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>{String(f.value)}</span>
            </div>
          ))}
        </CardBody>
      </Card>

      {type === 'tag' && data.triggers?.length > 0 && (
        <Card>
          <CardHeader title="Triggers" />
          <CardBody>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {data.triggers.map(t => (
                <span key={t} style={{
                  background: 'rgba(185,145,91,0.12)', border: '1px solid rgba(185,145,91,0.25)',
                  color: '#B9915B', padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                }}>{t}</span>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
