import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import Spinner from '../components/ui/Spinner'
import { useTracking } from '../context/TrackingContext'
import { api } from '../services/api'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { ChevronDown, ChevronRight, TrendingDown } from 'lucide-react'

export default function GA4Page() {
  const { ga4Properties, selectedGA4, setSelectedGA4 } = useTracking()

  const [report, setReport]           = useState(null)
  const [events, setEvents]           = useState(null)
  const [dashboards, setDashboards]   = useState(null)
  const [internalRef, setInternalRef] = useState(null)
  const [sourceMedium, setSourceMedium] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [days, setDays]               = useState(28)

  async function loadData(propId, d) {
    setLoading(true)
    const [rep, evs, dash, iRef, sm] = await Promise.all([
      api.ga4Report(propId, d),
      api.ga4Events(propId),
      api.ga4Dashboards(propId, d),
      api.ga4InternalRef(propId, d),
      api.ga4SourceMedium(propId, d),
    ])
    setReport(rep)
    setEvents(evs)
    setDashboards(dash)
    setInternalRef(iRef)
    setSourceMedium(sm)
    setLoading(false)
    setLastUpdated(Date.now())
  }

  useEffect(() => {
    if (selectedGA4) loadData(selectedGA4, days)
  }, [selectedGA4, days])

  const rows        = report?.rows ?? []
  const totalEvents = rows.reduce((s, r) => s + (r.count || 0), 0)
  const totalUsers  = rows.reduce((s, r) => s + (r.users || 0), 0)
  const isMock      = report?.mock ?? true

  // Trend chart
  const trendData = (() => {
    const byDate = {}
    rows.forEach(r => {
      const d = r.date ? r.date.slice(6, 8) + '/' + r.date.slice(4, 6) : '?'
      if (!byDate[d]) byDate[d] = { data: d, eventos: 0, usuarios: 0 }
      byDate[d].eventos  += r.count || 0
      byDate[d].usuarios += r.users || 0
    })
    return Object.values(byDate)
  })()

  // Event summary
  const eventSummary = (() => {
    if (events?.events?.length > 0) return events.events
    const map = {}
    rows.forEach(r => { map[r.event] = (map[r.event] || 0) + (r.count || 0) })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, status: 'ok', source: 'GA4' }))
  })()

  const activeProperty = ga4Properties.find(p => p.id === selectedGA4)
  const propertyCards  = ga4Properties.slice(0, 6)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="GA4"
        subtitle="Eventos e métricas das propriedades"
        onRefresh={() => loadData(selectedGA4, days)}
        lastUpdated={lastUpdated}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

        {/* ── Controles ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
          <span style={{ fontSize: 12, color: '#8A9BAA' }}>Período:</span>
          {[7, 28, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: `1px solid ${days === d ? '#B9915B' : 'rgba(185,145,91,0.3)'}`,
                background: days === d ? 'rgba(185,145,91,0.15)' : 'transparent',
                color: days === d ? '#B9915B' : '#8A9BAA',
                fontSize: 12,
                fontWeight: days === d ? 700 : 400,
                cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              {d}d
            </button>
          ))}
        </div>

        {/* ── Cards de propriedades ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(propertyCards.length, 3)}, 1fr)`,
          gap: 12,
          marginBottom: 20,
        }}>
          {propertyCards.map((p) => {
            const isActive = p.id === selectedGA4
            return (
              <Card
                key={p.id}
                onClick={() => setSelectedGA4(p.id)}
                style={{
                  borderColor: isActive ? '#B9915B' : 'rgba(185,145,91,0.25)',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  boxShadow: isActive ? '0 0 0 1px rgba(185,145,91,0.3)' : 'none',
                }}
              >
                <CardBody>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: "'PPMuseum','Georgia',serif", fontSize: 13, color: isActive ? '#B9915B' : '#F5F4F3', lineHeight: 1.3 }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2, fontFamily: 'monospace' }}>
                        {p.id}{p.account ? ` · ${p.account}` : ''}
                      </div>
                    </div>
                    <StatusBadge status={isActive && !isMock ? 'ok' : isActive ? 'warn' : 'ok'} size="sm" />
                  </div>
                  {isActive && !loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#F5F4F3' }}>{totalEvents.toLocaleString('pt-BR')}</div>
                        <div style={{ fontSize: 10, color: '#8A9BAA' }}>Eventos/{days}d</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#F5F4F3' }}>{totalUsers.toLocaleString('pt-BR')}</div>
                        <div style={{ fontSize: 10, color: '#8A9BAA' }}>Usuários/{days}d</div>
                      </div>
                    </div>
                  ) : isActive && loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}><Spinner size={14} /></div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#8A9BAA' }}>Clique para carregar</div>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>

        {/* ── Trend ── */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader title={`Tendência — ${activeProperty?.name ?? selectedGA4} (${days} dias)`} />
          <CardBody style={{ paddingTop: 8 }}>
            {loading ? <LoadingBox /> : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#B9915B11" />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#8A9BAA' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8A9BAA' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#8A9BAA' }} />
                  <Line type="monotone" dataKey="eventos" name="Eventos" stroke="#B9915B" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="usuarios" name="Usuários" stroke="#22C55E" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* ── Dashboards: 2 colunas ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

          {/* Top 5 Páginas */}
          <Card>
            <CardHeader title="Top 5 páginas mais acessadas" />
            <CardBody style={{ padding: '8px 0 12px' }}>
              {loading ? <LoadingBox /> : (
                <TopPagesChart data={dashboards?.topPages?.slice(0, 5) ?? []} />
              )}
            </CardBody>
          </Card>

          {/* Funil Checkout / Vendas */}
          <Card>
            <CardHeader title="Funil de checkout (e-commerce)" />
            <CardBody style={{ padding: '8px 0 12px' }}>
              {loading ? <LoadingBox /> : (
                <FunnelChart data={dashboards?.checkoutFunnel ?? []} color="#B9915B" />
              )}
            </CardBody>
          </Card>

          {/* Funil Formulário */}
          <Card>
            <CardHeader
              title="Funil de formulário"
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#F59E0B' }}>
                  <TrendingDown size={12} />
                  {dashboards?.formFunnel?.length >= 2
                    ? `${Math.round((1 - dashboards.formFunnel[dashboards.formFunnel.length - 1].count / dashboards.formFunnel[0].count) * 100)}% drop`
                    : '—'
                  }
                </div>
              }
            />
            <CardBody style={{ padding: '8px 0 12px' }}>
              {loading ? <LoadingBox /> : (
                <FunnelChart data={dashboards?.formFunnel ?? []} color="#22C55E" />
              )}
            </CardBody>
          </Card>

          {/* Top produtos */}
          <Card>
            <CardHeader title="Top produtos vendidos" />
            <CardBody style={{ padding: '8px 16px 12px' }}>
              {loading ? <LoadingBox /> : (
                <TopItemsTable items={dashboards?.topItems ?? []} />
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── Origem por internal_ref + Fonte/Mídia ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <Card>
            <CardHeader
              title="Formulários por internal_ref"
              action={<span style={{ fontSize: 11, color: '#8A9BAA' }}>{days} dias</span>}
            />
            <CardBody style={{ padding: '4px 0 8px' }}>
              {loading ? <LoadingBox /> : (
                <InternalRefTable rows={internalRef?.rows ?? []} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Fonte / Mídia × conversão"
              action={<span style={{ fontSize: 11, color: '#8A9BAA' }}>{days} dias</span>}
            />
            <CardBody style={{ padding: '4px 0 8px' }}>
              {loading ? <LoadingBox /> : (
                <SourceMediumTable rows={sourceMedium?.rows ?? []} />
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── Top eventos (dropdown) ── */}
        <EventsSection
          events={eventSummary}
          loading={loading}
          isMock={isMock}
          days={days}
          propertyName={activeProperty?.name ?? selectedGA4}
        />

      </div>
    </div>
  )
}

// ── Top Páginas ─────────────────────────────────────────────────────────────
function TopPagesChart({ data }) {
  if (!data.length) return <EmptyMsg />
  const max = data[0]?.views ?? 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {data.map((p, i) => (
        <div key={i} style={{ padding: '7px 16px', borderBottom: i < data.length - 1 ? '1px solid rgba(185,145,91,0.06)' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#F5F4F3', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
              {p.path}
            </span>
            <span style={{ fontSize: 11, color: '#B9915B', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {p.views.toLocaleString('pt-BR')} views
            </span>
          </div>
          <div style={{ height: 4, background: 'rgba(185,145,91,0.1)', borderRadius: 2 }}>
            <div style={{ height: 4, background: '#B9915B', borderRadius: 2, width: `${(p.views / max) * 100}%`, transition: 'width 0.4s' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Funil genérico ──────────────────────────────────────────────────────────
function FunnelChart({ data, color }) {
  if (!data.length) return <EmptyMsg />
  const max = Math.max(...data.map(d => d.count ?? 0), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {data.map((step, i) => {
        const pct = Math.round((step.count / max) * 100)
        const dropPct = i > 0 ? Math.round((1 - step.count / data[i - 1].count) * 100) : null
        return (
          <div key={i} style={{ padding: '7px 16px', borderBottom: i < data.length - 1 ? '1px solid rgba(185,145,91,0.06)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#F5F4F3' }}>{step.step}</span>
                {dropPct !== null && dropPct > 0 && (
                  <span style={{ fontSize: 10, color: '#EF4444', background: 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: 4 }}>
                    -{dropPct}%
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, color, fontWeight: 700 }}>
                {step.count.toLocaleString('pt-BR')}
              </span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
              <div style={{ height: 4, background: color, borderRadius: 2, width: `${pct}%`, opacity: 0.7 + (pct / 100) * 0.3, transition: 'width 0.4s' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Top produtos ────────────────────────────────────────────────────────────
function TopItemsTable({ items }) {
  if (!items.length) return (
    <div style={{ fontSize: 12, color: '#8A9BAA', textAlign: 'center', padding: 16 }}>
      Nenhum dado de e-commerce encontrado neste período.
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(185,145,91,0.06)' }}>
          <span style={{ fontSize: 11, color: '#B9915B', fontWeight: 700, width: 18, textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
          <span style={{ fontSize: 12, color: '#F5F4F3', flex: 1 }}>{item.name}</span>
          <span style={{ fontSize: 11, color: '#8A9BAA', whiteSpace: 'nowrap' }}>{item.purchases} vendas</span>
          {item.revenue > 0 && (
            <span style={{ fontSize: 11, color: '#22C55E', fontWeight: 700, whiteSpace: 'nowrap' }}>
              R$ {item.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Internal Ref Table ───────────────────────────────────────────────────────
function InternalRefTable({ rows }) {
  if (!rows.length) return <EmptyMsg />
  const maxStart = Math.max(...rows.map(r => r.form_start), 1)
  return (
    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.2)', position: 'sticky', top: 0, background: '#001A2E', zIndex: 1 }}>
            {['internal_ref', 'Iniciaram', 'Enviaram', 'Conv.'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: h === 'internal_ref' ? 'left' : 'right', fontSize: 10, color: '#8A9BAA', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const barW = Math.round((r.form_start / maxStart) * 100)
            const convColor = r.convRate >= 25 ? '#22C55E' : r.convRate >= 15 ? '#F59E0B' : '#EF4444'
            return (
              <tr key={i} style={{ borderBottom: '1px solid rgba(185,145,91,0.06)' }}>
                <td style={{ padding: '8px 12px', maxWidth: 160 }}>
                  <div style={{ fontSize: 11, color: '#F5F4F3', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={r.ref}>{r.ref}</div>
                  <div style={{ marginTop: 3, height: 3, background: 'rgba(185,145,91,0.1)', borderRadius: 2 }}>
                    <div style={{ height: 3, background: '#B9915B', borderRadius: 2, width: `${barW}%` }} />
                  </div>
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#F5F4F3' }}>
                  {r.form_start.toLocaleString('pt-BR')}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: '#F5F4F3' }}>
                  {r.form_submit.toLocaleString('pt-BR')}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: convColor }}>{r.convRate}%</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Source/Medium Table ───────────────────────────────────────────────────────
const SOURCE_ICON = {
  google:    { icon: 'G', color: '#4285F4', bg: 'rgba(66,133,244,0.15)' },
  facebook:  { icon: 'f', color: '#1877F2', bg: 'rgba(24,119,242,0.15)' },
  instagram: { icon: '▲', color: '#E1306C', bg: 'rgba(225,48,108,0.15)' },
  youtube:   { icon: '▶', color: '#FF0000', bg: 'rgba(255,0,0,0.12)'    },
  email:     { icon: '@', color: '#B9915B', bg: 'rgba(185,145,91,0.15)' },
  linktree:  { icon: '𝕃', color: '#43E660', bg: 'rgba(67,230,96,0.12)'  },
  bing:      { icon: 'B', color: '#008373', bg: 'rgba(0,131,115,0.15)'  },
  '(direct)':{ icon: '→', color: '#8A9BAA', bg: 'rgba(138,155,170,0.12)'},
}

const CHANNEL_BADGE = {
  'Paid Search':   { label: 'Pago Search',  color: '#4285F4', bg: 'rgba(66,133,244,0.1)'  },
  'Organic Search':{ label: 'Org. Search',  color: '#22C55E', bg: 'rgba(34,197,94,0.1)'   },
  'Paid Social':   { label: 'Pago Social',  color: '#E1306C', bg: 'rgba(225,48,108,0.1)'  },
  'Organic Social':{ label: 'Org. Social',  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)'  },
  'Email':         { label: 'Email',        color: '#B9915B', bg: 'rgba(185,145,91,0.1)'  },
  'Direct':        { label: 'Direto',       color: '#8A9BAA', bg: 'rgba(138,155,170,0.1)' },
  'Referral':      { label: 'Referral',     color: '#A855F7', bg: 'rgba(168,85,247,0.1)'  },
}

function SourceMediumTable({ rows }) {
  if (!rows.length) return <EmptyMsg />
  const maxSessions = Math.max(...rows.map(r => r.sessions), 1)

  return (
    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.2)', position: 'sticky', top: 0, background: '#001A2E', zIndex: 1 }}>
            {['Fonte', 'Canal', 'Sessões', 'Compras', 'Leads', 'Conv%'].map(h => (
              <th key={h} style={{
                padding: '8px 10px',
                textAlign: (h === 'Fonte' || h === 'Canal') ? 'left' : 'right',
                fontSize: 10, color: '#8A9BAA', fontWeight: 600,
                letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const barW = Math.round((r.sessions / maxSessions) * 100)
            const convColor = parseFloat(r.convRate) >= 4 ? '#22C55E' : parseFloat(r.convRate) >= 2 ? '#F59E0B' : '#8A9BAA'
            const srcKey = (r.source || '').toLowerCase()
            const src = SOURCE_ICON[srcKey] ?? { icon: srcKey[0]?.toUpperCase() ?? '?', color: '#8A9BAA', bg: 'rgba(138,155,170,0.1)' }
            const ch = CHANNEL_BADGE[r.channel] ?? { label: r.channel, color: '#8A9BAA', bg: 'rgba(138,155,170,0.1)' }

            return (
              <tr key={i} style={{ borderBottom: '1px solid rgba(185,145,91,0.06)' }}>
                {/* Fonte */}
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                      background: src.bg, color: src.color,
                      fontSize: 11, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{src.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, color: '#F5F4F3', fontWeight: 500 }}>{r.source}</div>
                      <div style={{ marginTop: 2, height: 2, width: 60, background: 'rgba(185,145,91,0.1)', borderRadius: 1 }}>
                        <div style={{ height: 2, background: src.color, borderRadius: 1, width: `${barW}%`, opacity: 0.7 }} />
                      </div>
                    </div>
                  </div>
                </td>
                {/* Canal */}
                <td style={{ padding: '8px 10px' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                    color: ch.color, background: ch.bg, whiteSpace: 'nowrap',
                  }}>{ch.label}</span>
                  <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2 }}>{r.medium}</div>
                </td>
                {/* Sessões */}
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: '#F5F4F3' }}>
                  {r.sessions.toLocaleString('pt-BR')}
                </td>
                {/* Compras */}
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: '#22C55E', fontWeight: 600 }}>
                  {r.purchase > 0 ? r.purchase.toLocaleString('pt-BR') : <span style={{ color: '#8A9BAA' }}>—</span>}
                </td>
                {/* Leads */}
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, color: '#B9915B' }}>
                  {r.leads > 0 ? r.leads.toLocaleString('pt-BR') : <span style={{ color: '#8A9BAA' }}>—</span>}
                </td>
                {/* Conv% */}
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: convColor }}>{r.convRate}%</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Seção de eventos com limit selector ─────────────────────────────────────
const LIMIT_OPTIONS = [10, 25, 50]

function EventsSection({ events, loading, isMock, days, propertyName }) {
  const [limit, setLimit] = useState(10)

  return (
    <Card>
      <CardHeader
        title={`Top eventos — ${propertyName}`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#8A9BAA' }}>
              {isMock ? 'dados mock' : `${events.length} eventos · ${days} dias`}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#8A9BAA' }}>Exibir</span>
              <select
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
                style={{
                  background: '#001F35',
                  border: '1px solid rgba(185,145,91,0.35)',
                  borderRadius: 5,
                  color: '#F5F4F3',
                  fontSize: 11,
                  padding: '3px 22px 3px 8px',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  fontFamily: 'Manrope, sans-serif',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23B9915B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 5px center',
                }}
              >
                {LIMIT_OPTIONS.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        }
      />
      {loading ? (
        <CardBody><LoadingBox /></CardBody>
      ) : (
        <EventsTable events={events.slice(0, limit)} />
      )}
    </Card>
  )
}

// ── Tabela de eventos (expansível) ──────────────────────────────────────────
function EventsTable({ events }) {
  const [expanded, setExpanded] = useState(null)

  return (
    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid rgba(185,145,91,0.2)', position: 'sticky', top: 0, background: '#001A2E', zIndex: 1 }}>
          {['Evento', 'Contagem', 'Fonte', 'Status', ''].map((h) => (
            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: '#8A9BAA', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {events.map((ev, i) => {
          const isOpen = expanded === i
          return [
            <tr
              key={`row-${i}`}
              onClick={() => setExpanded(isOpen ? null : i)}
              style={{
                borderBottom: isOpen ? 'none' : '1px solid rgba(185,145,91,0.06)',
                cursor: 'pointer',
                background: isOpen ? 'rgba(185,145,91,0.04)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <td style={{ padding: '9px 16px', fontSize: 12, fontWeight: 600, color: '#F5F4F3', fontFamily: 'monospace' }}>
                {ev.name}
              </td>
              <td style={{ padding: '9px 16px', fontSize: 13, color: '#F5F4F3' }}>
                {(ev.count || 0).toLocaleString('pt-BR')}
              </td>
              <td style={{ padding: '9px 16px', fontSize: 11, color: '#8A9BAA' }}>
                {ev.source || 'GA4'}
              </td>
              <td style={{ padding: '9px 16px' }}>
                <StatusBadge status={ev.status || 'ok'} size="sm" />
              </td>
              <td style={{ padding: '9px 16px', textAlign: 'right' }}>
                {isOpen ? <ChevronDown size={13} color="#8A9BAA" /> : <ChevronRight size={13} color="#8A9BAA" />}
              </td>
            </tr>,
            isOpen && (
              <tr key={`detail-${i}`} style={{ borderBottom: '1px solid rgba(185,145,91,0.06)' }}>
                <td colSpan={5} style={{ padding: '6px 16px 12px 32px', background: 'rgba(185,145,91,0.03)' }}>
                  <EventDetail event={ev} />
                </td>
              </tr>
            ),
          ]
        })}
      </tbody>
    </table>
    </div>
  )
}

function EventDetail({ event }) {
  return (
    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 10, color: '#8A9BAA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Nome</div>
        <div style={{ fontSize: 12, color: '#B9915B', fontFamily: 'monospace' }}>{event.name}</div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: '#8A9BAA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Total</div>
        <div style={{ fontSize: 12, color: '#F5F4F3', fontWeight: 700 }}>{(event.count || 0).toLocaleString('pt-BR')} disparos</div>
      </div>
      {event.lastSeen && (
        <div>
          <div style={{ fontSize: 10, color: '#8A9BAA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Último disparo</div>
          <div style={{ fontSize: 12, color: '#F5F4F3' }}>{event.lastSeen}</div>
        </div>
      )}
      <div>
        <div style={{ fontSize: 10, color: '#8A9BAA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Fonte</div>
        <div style={{ fontSize: 12, color: '#F5F4F3' }}>{event.source || 'GA4'}</div>
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const TOOLTIP_STYLE = { background: '#001F35', border: '1px solid #B9915B55', borderRadius: 6, fontSize: 12, color: '#F5F4F3' }

function LoadingBox() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
}

function EmptyMsg() {
  return <div style={{ fontSize: 12, color: '#8A9BAA', padding: '16px 20px' }}>Nenhum dado disponível para este período.</div>
}
