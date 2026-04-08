import { useState } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import EmptyState from '../components/ui/EmptyState'
import { Search, ChevronRight, Filter, Tag, BarChart2, Download } from 'lucide-react'

const MOCK_EVENTS = [
  { name: 'page_view', source: 'GA4', count: 48200, status: 'ok', lastSeen: '2 min' },
  { name: 'purchase', source: 'GA4+Meta', count: 342, status: 'ok', lastSeen: '8 min' },
  { name: 'lead', source: 'GA4+Meta', count: 1820, status: 'ok', lastSeen: '3 min' },
  { name: 'add_to_cart', source: 'GA4', count: 890, status: 'ok', lastSeen: '5 min' },
  { name: 'view_item', source: 'GA4', count: 12400, status: 'ok', lastSeen: '1 min' },
  { name: 'scroll', source: 'GTM', count: 31200, status: 'ok', lastSeen: '1 min' },
  { name: 'video_start', source: 'GTM', count: 0, status: 'error', lastSeen: 'nunca' },
  { name: 'video_progress', source: 'GTM', count: 0, status: 'error', lastSeen: 'nunca' },
  { name: 'form_submit', source: 'GTM', count: 1240, status: 'ok', lastSeen: '12 min' },
  { name: 'click_whatsapp', source: 'GTM', count: 2840, status: 'ok', lastSeen: '4 min' },
  { name: 'click_cta', source: 'GTM', count: 6200, status: 'warn', lastSeen: '22 min' },
  { name: 'begin_checkout', source: 'GA4', count: 510, status: 'ok', lastSeen: '11 min' },
]

const GTM_TAGS = [
  { name: 'GA4 — Base Tag', type: 'Google Analytics', status: 'ok', triggers: 3 },
  { name: 'Meta Pixel — Base', type: 'Custom HTML', status: 'ok', triggers: 1 },
  { name: 'Meta Pixel — Purchase', type: 'Custom HTML', status: 'ok', triggers: 2 },
  { name: 'Meta Pixel — Lead', type: 'Custom HTML', status: 'ok', triggers: 3 },
  { name: 'GA4 — purchase', type: 'Google Analytics', status: 'ok', triggers: 1 },
  { name: 'GA4 — video_start', type: 'Google Analytics', status: 'error', triggers: 0 },
  { name: 'GA4 — scroll_depth', type: 'Google Analytics', status: 'warn', triggers: 1 },
  { name: 'Hotjar', type: 'Custom HTML', status: 'ok', triggers: 1 },
]

export default function Explorer() {
  const [tab, setTab] = useState('events')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selected, setSelected] = useState(null)

  const filteredEvents = MOCK_EVENTS.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || e.status === filterStatus
    return matchSearch && matchStatus
  })

  const filteredTags = GTM_TAGS.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || t.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Explorador de Dados"
        subtitle="Navegue por eventos GA4 e tags GTM"
        onRefresh={() => {}}
      />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: 0 }}>
        {/* Lista */}
        <div
          style={{
            width: selected ? '55%' : '100%',
            overflow: 'auto',
            padding: 24,
            transition: 'width 0.2s ease',
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              marginBottom: 16,
              background: '#001F35',
              border: '1px solid #B9915B',
              borderRadius: 8,
              padding: 4,
            }}
          >
            {[
              { id: 'events', label: 'Eventos GA4', icon: BarChart2 },
              { id: 'tags', label: 'Tags GTM', icon: Tag },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setTab(id); setSelected(null) }}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  background: tab === id ? '#B9915B' : 'transparent',
                  color: tab === id ? '#031A26' : '#8A9BAA',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Barra de busca + filtro */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8A9BAA' }}
              />
              <input
                type="text"
                placeholder={tab === 'events' ? 'Buscar evento...' : 'Buscar tag...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  background: '#001F35',
                  border: '1px solid rgba(185,145,91,0.3)',
                  borderRadius: 6,
                  color: '#F5F4F3',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'ok', 'warn', 'error'].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid',
                    borderColor: filterStatus === s ? '#B9915B' : 'rgba(185,145,91,0.25)',
                    borderRadius: 6,
                    background: filterStatus === s ? 'rgba(185,145,91,0.15)' : 'transparent',
                    color: filterStatus === s ? '#B9915B' : '#8A9BAA',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {s === 'all' ? 'Todos' : s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Tabela de eventos */}
          {tab === 'events' && (
            <Card>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.2)' }}>
                    {['Evento', 'Fonte', 'Contagem', 'Último disparo', 'Status'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 16px',
                          textAlign: 'left',
                          fontSize: 11,
                          color: '#8A9BAA',
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((ev, i) => (
                    <tr
                      key={ev.name}
                      onClick={() => setSelected({ type: 'event', data: ev })}
                      style={{
                        borderBottom: '1px solid rgba(185,145,91,0.08)',
                        cursor: 'pointer',
                        background: selected?.data?.name === ev.name ? 'rgba(185,145,91,0.06)' : 'transparent',
                      }}
                      onMouseEnter={(e) => { if (selected?.data?.name !== ev.name) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                      onMouseLeave={(e) => { if (selected?.data?.name !== ev.name) e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#F5F4F3' }}>
                        {ev.name}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 11, color: '#8A9BAA', background: 'rgba(138,155,170,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                          {ev.source}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: '#F5F4F3', fontWeight: 500 }}>
                        {ev.count.toLocaleString('pt-BR')}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: '#8A9BAA' }}>{ev.lastSeen}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <StatusBadge status={ev.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                  {filteredEvents.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState title="Nenhum evento encontrado" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          )}

          {/* Tabela de tags GTM */}
          {tab === 'tags' && (
            <Card>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.2)' }}>
                    {['Tag', 'Tipo', 'Triggers', 'Status'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 16px',
                          textAlign: 'left',
                          fontSize: 11,
                          color: '#8A9BAA',
                          fontWeight: 600,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTags.map((tag) => (
                    <tr
                      key={tag.name}
                      onClick={() => setSelected({ type: 'tag', data: tag })}
                      style={{
                        borderBottom: '1px solid rgba(185,145,91,0.08)',
                        cursor: 'pointer',
                        background: selected?.data?.name === tag.name ? 'rgba(185,145,91,0.06)' : 'transparent',
                      }}
                      onMouseEnter={(e) => { if (selected?.data?.name !== tag.name) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                      onMouseLeave={(e) => { if (selected?.data?.name !== tag.name) e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#F5F4F3' }}>{tag.name}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: 11, color: '#8A9BAA', background: 'rgba(138,155,170,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                          {tag.type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: '#F5F4F3' }}>{tag.triggers}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <StatusBadge status={tag.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        {/* Painel de detalhe */}
        {selected && (
          <div
            style={{
              width: '45%',
              borderLeft: '1px solid rgba(185,145,91,0.2)',
              overflow: 'auto',
              padding: 24,
            }}
          >
            <DetailPanel item={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  )
}

function DetailPanel({ item, onClose }) {
  const { type, data } = item

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2
          style={{
            fontFamily: "'PPMuseum','Georgia',serif",
            fontSize: 16,
            color: '#B9915B',
          }}
        >
          Detalhes
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid rgba(185,145,91,0.3)',
            borderRadius: 6,
            color: '#8A9BAA',
            cursor: 'pointer',
            padding: '4px 10px',
            fontSize: 12,
          }}
        >
          Fechar
        </button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <CardBody>
          <div
            style={{
              fontFamily: "'PPMuseum','Georgia',serif",
              fontSize: 18,
              color: '#F5F4F3',
              marginBottom: 8,
            }}
          >
            {data.name}
          </div>
          <StatusBadge status={data.status} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Propriedades" />
        <CardBody>
          {Object.entries(data)
            .filter(([k]) => !['name', 'status'].includes(k))
            .map(([key, val]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(185,145,91,0.1)',
                  fontSize: 13,
                }}
              >
                <span style={{ color: '#8A9BAA' }}>{key}</span>
                <span style={{ color: '#F5F4F3', fontWeight: 500 }}>{String(val)}</span>
              </div>
            ))}
        </CardBody>
      </Card>
    </div>
  )
}
