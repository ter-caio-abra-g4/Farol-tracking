import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import Metric from '../components/ui/Metric'
import Spinner from '../components/ui/Spinner'
import { useTracking } from '../context/TrackingContext'
import { api } from '../services/api'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Tag, BarChart2, Activity, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronRight,
} from 'lucide-react'

export default function Dashboard() {
  const { selectedGTM, gtmContainers, selectedGA4 } = useTracking()
  const [lastUpdated, setLastUpdated] = useState(null)

  // GA4
  const [ga4Data, setGa4Data] = useState(null)
  const [ga4Loading, setGa4Loading] = useState(true)

  // GTM containers detail
  const [gtmData, setGtmData] = useState({}) // { [publicId]: detail }
  const [gtmLoading, setGtmLoading] = useState(true)

  const visibleContainers = selectedGTM === 'all'
    ? gtmContainers
    : gtmContainers.filter(c => c.id === selectedGTM)

  async function loadData() {
    setGa4Loading(true)
    setGtmLoading(true)

    // GA4 report
    const report = await api.ga4Report(selectedGA4, 7)
    setGa4Data(report)
    setGa4Loading(false)

    // GTM — detalhes paralelos de cada container visível
    const targets = selectedGTM === 'all' ? gtmContainers : gtmContainers.filter(c => c.id === selectedGTM)
    if (targets.length > 0) {
      const entries = await Promise.all(
        targets.map(async (c) => {
          const detail = await api.gtmContainer(c.id)
          return [c.id, { ...detail, name: c.name, account: c.account }]
        })
      )
      setGtmData(Object.fromEntries(entries))
    }
    setGtmLoading(false)
    setLastUpdated(Date.now())
  }

  useEffect(() => {
    loadData()
  }, [selectedGTM, selectedGA4, gtmContainers.length])

  // GA4 agregados
  const ga4Rows = ga4Data?.rows ?? []
  const totalEvents = ga4Rows.reduce((s, r) => s + (r.count || 0), 0)
  const totalUsers = ga4Rows.reduce((s, r) => s + (r.users || 0), 0)
  const ga4Status = ga4Loading ? 'loading' : ga4Data?.mock ? 'warn' : 'ok'

  // Chart — agrupa por dia
  const chartData = (() => {
    if (!ga4Rows.length) return MOCK_CHART
    const byDate = {}
    ga4Rows.forEach(r => {
      const d = r.date ? r.date.slice(4, 6) + '/' + r.date.slice(6, 8) : '?'
      byDate[d] = (byDate[d] || 0) + (r.count || 0)
    })
    return Object.entries(byDate).map(([data, eventos]) => ({ data, eventos })).slice(-7)
  })()

  const gtmHasReal = Object.values(gtmData).some(d => !d?.mock)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Dashboard"
        subtitle="Visão geral de integridade do tracking"
        onRefresh={loadData}
        lastUpdated={lastUpdated}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

        {/* ── Semáforo GA4 + Meta ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <SemaphoreCard
            icon={BarChart2}
            title="GA4"
            subtitle={`Property ${selectedGA4}`}
            status={ga4Status}
            metrics={[
              { label: 'Eventos (7 dias)', value: ga4Loading ? '...' : totalEvents.toLocaleString('pt-BR') },
              { label: 'Usuários (7 dias)', value: ga4Loading ? '...' : totalUsers.toLocaleString('pt-BR') },
            ]}
            loading={ga4Loading}
          />
          <SemaphoreCard
            icon={Activity}
            title="Meta Ads"
            subtitle="Pixel + Conversions API"
            status="warn"
            metrics={[
              { label: 'Match rate', value: '—' },
              { label: 'Eventos 24h', value: '—' },
            ]}
            loading={false}
          />
        </div>

        {/* ── Containers GTM expansíveis ── */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeader
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={14} color="#B9915B" />
                <span>
                  GTM — {selectedGTM === 'all'
                    ? `${visibleContainers.length} container${visibleContainers.length !== 1 ? 's' : ''}`
                    : visibleContainers[0]?.name || selectedGTM}
                </span>
              </div>
            }
            action={gtmLoading ? <Spinner size={16} /> : <StatusBadge status={gtmHasReal ? 'ok' : 'warn'} />}
          />
          <CardBody style={{ padding: '8px 16px 12px' }}>
            {visibleContainers.length === 0 ? (
              <div style={{ fontSize: 12, color: '#8A9BAA', padding: '8px 0' }}>
                Nenhum container disponível. Verifique a conexão GTM em Configurações.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {visibleContainers.map(c => (
                  <ContainerCard
                    key={c.id}
                    container={c}
                    detail={gtmData[c.id]}
                    loading={gtmLoading && !gtmData[c.id]}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── Gráfico + Status ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <EventsChartCard chartData={chartData} loading={ga4Loading} />
          <AlertsCard ga4Mock={!!ga4Data?.mock} gtmMock={!gtmHasReal && Object.keys(gtmData).length > 0} />
        </div>

        {/* ── Checklist ── */}
        <IntegrityChecklist ga4Data={ga4Data} gtmData={gtmData} />
      </div>
    </div>
  )
}

// ── Container card expansível ──────────────────────────────────────────────
function ContainerCard({ container, detail, loading }) {
  const [expanded, setExpanded] = useState(false)

  const tagCount = detail?.counts?.tags ?? detail?.tags?.length ?? null
  const triggerCount = detail?.counts?.triggers ?? detail?.triggers?.length ?? null
  const isMock = detail?.mock ?? true
  const status = loading ? 'loading' : isMock ? 'warn' : 'ok'

  const statusColor = { ok: '#22C55E', warn: '#F59E0B', loading: '#B9915B', error: '#EF4444' }

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${statusColor[status]}33` }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: expanded ? 'rgba(185,145,91,0.05)' : '#031A26',
          border: 'none',
          cursor: 'pointer',
          gap: 10,
          transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor[status], flexShrink: 0 }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, color: '#F5F4F3', fontWeight: 600 }}>{container.name || container.id}</div>
            <div style={{ fontSize: 10, color: '#8A9BAA', fontFamily: 'monospace' }}>
              {container.id} · {container.account}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {loading ? <Spinner size={13} /> : (
            <>
              {tagCount !== null && (
                <span style={{ fontSize: 11, color: '#8A9BAA' }}>
                  <span style={{ color: '#F5F4F3', fontWeight: 600 }}>{tagCount}</span> tags
                </span>
              )}
              {triggerCount !== null && (
                <span style={{ fontSize: 11, color: '#8A9BAA' }}>
                  <span style={{ color: '#F5F4F3', fontWeight: 600 }}>{triggerCount}</span> triggers
                </span>
              )}
              {isMock && (
                <span style={{ fontSize: 10, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                  mock
                </span>
              )}
            </>
          )}
          {expanded
            ? <ChevronDown size={14} color="#8A9BAA" />
            : <ChevronRight size={14} color="#8A9BAA" />
          }
        </div>
      </button>

      {expanded && (
        <div style={{ background: 'rgba(0,31,53,0.6)', borderTop: '1px solid rgba(185,145,91,0.1)', padding: '10px 14px 12px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}><Spinner /></div>
          ) : isMock ? (
            <div style={{ fontSize: 12, color: '#8A9BAA' }}>
              Adicione o service account a este container no GTM para ver as tags reais.
            </div>
          ) : (
            <TagList tags={detail?.tags ?? []} />
          )}
        </div>
      )}
    </div>
  )
}

function TagList({ tags }) {
  if (!tags.length) return <div style={{ fontSize: 12, color: '#8A9BAA' }}>Nenhuma tag encontrada.</div>
  const statusColor = { ok: '#22C55E', warn: '#F59E0B', error: '#EF4444' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {tags.slice(0, 20).map((tag, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor[tag.status] ?? '#8A9BAA', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#F5F4F3', flex: 1 }}>{tag.name}</span>
          <span style={{ fontSize: 10, color: '#8A9BAA', fontFamily: 'monospace' }}>{tag.type}</span>
        </div>
      ))}
      {tags.length > 20 && (
        <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 4 }}>+{tags.length - 20} tags adicionais</div>
      )}
    </div>
  )
}

// ── Semáforo ───────────────────────────────────────────────────────────────
function SemaphoreCard({ icon: Icon, title, subtitle, status, metrics, loading }) {
  const statusBorder = { ok: '#22C55E', warn: '#F59E0B', error: '#EF4444', loading: '#B9915B' }
  return (
    <Card style={{ borderColor: statusBorder[status] ?? '#B9915B', transition: 'border-color 0.3s ease' }}>
      <CardHeader
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon size={15} color="#B9915B" strokeWidth={1.8} />
            <span style={{ fontFamily: "'PPMuseum','Georgia',serif", fontSize: 14, color: '#B9915B' }}>{title}</span>
          </div>
        }
        action={loading ? <Spinner size={16} /> : <StatusBadge status={status} />}
      />
      <CardBody>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Spinner /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {metrics.map((m, i) => <Metric key={i} {...m} />)}
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 11, color: '#8A9BAA' }}>{subtitle}</div>
      </CardBody>
    </Card>
  )
}

// ── Gráfico ────────────────────────────────────────────────────────────────
const MOCK_CHART = [
  { data: '01/04', eventos: 1200 }, { data: '02/04', eventos: 800 },
  { data: '03/04', eventos: 3400 }, { data: '04/04', eventos: 5200 },
  { data: '05/04', eventos: 4800 }, { data: '06/04', eventos: 3100 },
  { data: '07/04', eventos: 1900 },
]

function EventsChartCard({ chartData, loading }) {
  return (
    <Card>
      <CardHeader title="Eventos GA4 — últimos 7 dias" />
      <CardBody style={{ paddingTop: 8 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Spinner /></div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#B9915B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#B9915B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#B9915B11" />
              <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#8A9BAA' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8A9BAA' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#001F35', border: '1px solid #B9915B55', borderRadius: 6, fontSize: 12, color: '#F5F4F3' }}
                cursor={{ stroke: '#B9915B44' }}
              />
              <Area type="monotone" dataKey="eventos" stroke="#B9915B" strokeWidth={2} fill="url(#goldGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  )
}

// ── Alertas / Status ───────────────────────────────────────────────────────
function AlertsCard({ ga4Mock, gtmMock }) {
  const alerts = []
  if (ga4Mock) alerts.push({ level: 'warn', title: 'GA4 em modo mock', description: 'Adicione o service account à conta GA4 para dados reais.' })
  if (gtmMock) alerts.push({ level: 'warn', title: 'GTM em modo mock', description: 'Adicione o service account aos containers GTM.' })
  if (!ga4Mock && !gtmMock && (alerts.length === 0)) {
    alerts.push({ level: 'ok', title: 'Tudo operacional', description: 'GA4 e GTM conectados com dados reais.' })
  }

  const alertColor = { error: '#EF4444', warn: '#F59E0B', ok: '#22C55E' }
  const AlertIcon = { error: XCircle, warn: AlertTriangle, ok: CheckCircle }

  return (
    <Card>
      <CardHeader title="Status das conexões" />
      <CardBody style={{ padding: '12px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map((a, i) => {
            const Icon = AlertIcon[a.level]
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px',
                background: `${alertColor[a.level]}0D`,
                border: `1px solid ${alertColor[a.level]}33`,
                borderRadius: 6,
              }}>
                <Icon size={14} color={alertColor[a.level]} style={{ marginTop: 1, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#F5F4F3' }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 2 }}>{a.description}</div>
                </div>
              </div>
            )
          })}
        </div>
      </CardBody>
    </Card>
  )
}

// ── Checklist ──────────────────────────────────────────────────────────────
function IntegrityChecklist({ ga4Data, gtmData }) {
  const ga4Ok = !ga4Data?.mock
  const gtmOk = Object.values(gtmData).some(d => !d?.mock)
  const hasEvents = (ga4Data?.rows?.length ?? 0) > 0
  const hasPurchase = ga4Data?.rows?.some(r => r.event === 'purchase')
  const hasLead = ga4Data?.rows?.some(r => r.event === 'lead' || r.event === 'generate_lead')

  const items = [
    { label: 'GTM conectado', status: gtmOk ? 'ok' : 'warn' },
    { label: 'GA4 recebendo eventos', status: ga4Ok ? 'ok' : 'warn' },
    { label: 'Eventos nos últimos 7 dias', status: hasEvents ? 'ok' : ga4Ok ? 'warn' : 'loading' },
    { label: 'Meta Pixel configurado', status: 'warn' },
    { label: 'Evento purchase presente', status: hasPurchase ? 'ok' : ga4Ok ? 'warn' : 'loading' },
    { label: 'Evento lead presente', status: hasLead ? 'ok' : ga4Ok ? 'warn' : 'loading' },
  ]

  const iconMap = {
    ok: <CheckCircle size={14} color="#22C55E" />,
    warn: <AlertTriangle size={14} color="#F59E0B" />,
    error: <XCircle size={14} color="#EF4444" />,
    loading: <Spinner size={14} />,
  }

  return (
    <Card>
      <CardHeader title="Checklist de integridade" />
      <CardBody>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {items.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', background: '#031A26',
              borderRadius: 6, border: '1px solid rgba(185,145,91,0.1)',
            }}>
              {iconMap[item.status] ?? iconMap.loading}
              <span style={{ fontSize: 12, color: '#F5F4F3' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
