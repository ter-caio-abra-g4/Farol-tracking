import { useState, useEffect } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import Metric from '../components/ui/Metric'
import Spinner from '../components/ui/Spinner'
import PeriodSelect from '../components/ui/PeriodSelect'
import { useTracking } from '../context/TrackingContext'
import { api } from '../services/api'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Tag, BarChart2, Activity, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus as MinusIcon,
  Database, PlugZap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fmtNum, fmtMoney } from '../utils/format'
import DataBadge from '../components/ui/DataBadge'

function DeltaBadge({ delta, suffix = '', inverse = false }) {
  if (delta === 0 || delta === null || delta === undefined)
    return <span style={{ color: '#6B7280', fontSize: 11 }}>= igual</span>
  const positive = inverse ? delta < 0 : delta > 0
  const color = positive ? '#22C55E' : '#EF4444'
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : MinusIcon
  const sign = delta > 0 ? '+' : ''
  return (
    <span style={{ color, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
      <Icon size={11} />
      {sign}{fmtNum(delta)}{suffix} vs ontem
    </span>
  )
}

export default function Dashboard() {
  const { selectedGTM, gtmContainers, selectedGA4 } = useTracking()
  const [lastUpdated, setLastUpdated] = useState(null)
  const [days, setDays] = useState(1)
  const [appConfig, setAppConfig] = useState({})

  // Executive summary (Databricks)
  const [exec, setExec] = useState(null)
  const [execLoading, setExecLoading] = useState(true)

  // GA4
  const [ga4Data, setGa4Data] = useState(null)
  const [ga4Loading, setGa4Loading] = useState(true)

  // GTM containers detail
  const [gtmData, setGtmData] = useState({}) // { [publicId]: detail }
  const [gtmLoading, setGtmLoading] = useState(true)

  // Meta
  const [metaData, setMetaData] = useState(null)
  const [metaLoading, setMetaLoading] = useState(true)

  // GTM Connection Health
  const [gtmHealth, setGtmHealth] = useState(null)
  const [gtmHealthLoading, setGtmHealthLoading] = useState(true)

  // Anomaly Alerts
  const [anomalies, setAnomalies] = useState(null)
  const [anomaliesLoading, setAnomaliesLoading] = useState(true)

  const visibleContainers = selectedGTM === 'all'
    ? gtmContainers
    : gtmContainers.filter(c => c.id === selectedGTM)

  async function loadData(forceRefresh = false) {
    if (forceRefresh) await api.databricksCacheClear()
    setGa4Loading(true)
    setGtmLoading(true)
    setExecLoading(true)
    setMetaLoading(true)
    setGtmHealthLoading(true)
    setAnomaliesLoading(true)

    // Executive summary (Databricks) — corre em paralelo com GA4
    api.databricksExecutiveSummary().then(d => {
      setExec(d)
      setExecLoading(false)
    })

    // Meta stats — paralelo
    api.metaStats().then(d => {
      setMetaData(d)
      setMetaLoading(false)
    })

    // GTM Health — paralelo
    api.gtmHealth().then(d => {
      setGtmHealth(d)
      setGtmHealthLoading(false)
    })

    // Anomaly Alerts — paralelo
    api.databricksAnomalyAlerts().then(d => {
      setAnomalies(d)
      setAnomaliesLoading(false)
    })

    // GA4 report
    const report = await api.ga4Report(selectedGA4, days)
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
    api.getConfig().then(cfg => setAppConfig(cfg ?? {}))
  }, [])

  useEffect(() => {
    if (gtmContainers.length === 0 && !selectedGA4) return
    loadData()
  }, [selectedGTM, selectedGA4, gtmContainers.length, days])

  // GA4 agregados
  const ga4Rows = ga4Data?.rows ?? []
  const totalEvents = ga4Rows.reduce((s, r) => s + (r.count || 0), 0)
  const totalUsers = ga4Rows.reduce((s, r) => s + (r.users || 0), 0)
  const ga4Status = ga4Loading ? 'loading' : ga4Data?._stale ? 'warn' : ga4Data?.mock ? 'warn' : 'ok'

  // Chart — agrupa por dia
  const chartData = (() => {
    if (!ga4Rows.length) return buildMockChart(days)
    const byDate = {}
    ga4Rows.forEach(r => {
      const d = r.date ? r.date.slice(4, 6) + '/' + r.date.slice(6, 8) : '?'
      byDate[d] = (byDate[d] || 0) + (r.count || 0)
    })
    return Object.entries(byDate).map(([data, eventos]) => ({ data, eventos })).slice(-days)
  })()

  const gtmHasReal = Object.values(gtmData).some(d => !d?.mock)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Dashboard"
        subtitle="Visão geral de integridade do tracking"
        onRefresh={() => loadData(true)}
        lastUpdated={lastUpdated}
        action={<PeriodSelect value={days} onChange={setDays} />}
        showGTM
        showGA4
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 'clamp(12px, 2vw, 24px)', minWidth: 0 }}>

        {/* ── Faixa Executiva ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12, marginBottom: 20,
        }}>
          {[
            {
              label: 'MQLs hoje',
              value: execLoading ? '…' : fmtNum(exec?.mqls_hoje ?? 0),
              sub: execLoading ? null : <DeltaBadge delta={exec?.delta_mqls} />,
              color: '#6366F1',
              detail: execLoading ? '' : `${fmtNum(exec?.mqls_7d)} nos últimos 7d`,
            },
            {
              label: 'Ganhos hoje',
              value: execLoading ? '…' : fmtNum(exec?.ganhos_hoje ?? 0),
              sub: execLoading ? null : <DeltaBadge delta={exec?.delta_ganhos} />,
              color: '#22C55E',
              detail: execLoading ? '' : `${fmtNum(exec?.ganhos_7d)} nos últimos 7d`,
            },
            {
              label: 'Conv% (7d)',
              value: execLoading ? '…' : `${exec?.conv_7d ?? 0}%`,
              sub: execLoading ? null : <DeltaBadge delta={exec?.delta_conv} suffix="pp" />,
              color: '#F59E0B',
              detail: execLoading ? '' : `Semana ant: ${exec?.conv_ant ?? 0}%`,
            },
            {
              label: 'Receita (7d)',
              value: execLoading ? '…' : fmtMoney(exec?.receita_7d ?? 0),
              sub: execLoading ? null : <DeltaBadge delta={exec?.delta_receita} suffix="" />,
              color: '#14B8A6',
              detail: execLoading ? '' : `Sem ant: ${fmtMoney(exec?.receita_ant ?? 0)}`,
            },
          ].map((kpi, i) => (
            <div key={i} style={{
              background: '#0D1B26',
              border: `1px solid ${kpi.color}33`,
              borderRadius: 10,
              padding: '14px 18px',
              display: 'flex', flexDirection: 'column', gap: 4,
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Barra lateral colorida */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: kpi.color, borderRadius: '10px 0 0 10px' }} />
              <div style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {kpi.label}
                {exec && <span style={{ marginLeft: 6 }}><DataBadge data={exec} /></span>}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: kpi.color, lineHeight: 1.1 }}>
                {kpi.value}
              </div>
              <div style={{ minHeight: 16 }}>{kpi.sub}</div>
              <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>{kpi.detail}</div>
            </div>
          ))}
        </div>

        {/* ── Faixa de Conexões (dropdown) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>

          {/* GTM */}
          <ConnectionDropdown
            icon={Tag}
            title="GTM"
            summary={`${visibleContainers.length} container${visibleContainers.length !== 1 ? 's' : ''}`}
            status={gtmLoading ? 'loading' : gtmHasReal ? 'ok' : 'warn'}
            loading={gtmLoading}
          >
            {visibleContainers.length === 0 ? (
              <div style={{ fontSize: 12, color: '#8A9BAA' }}>Nenhum container. Configure em Configurações.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {visibleContainers.map(c => (
                  <ContainerCard key={c.id} container={c} detail={gtmData[c.id]} loading={gtmLoading && !gtmData[c.id]} />
                ))}
              </div>
            )}
          </ConnectionDropdown>

          {/* GA4 */}
          <ConnectionDropdown
            icon={BarChart2}
            title="GA4"
            summary={ga4Loading ? '…' : `${totalEvents.toLocaleString('pt-BR')} eventos`}
            status={ga4Status}
            loading={ga4Loading}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row label="Property" value={selectedGA4} />
              <Row label="Eventos (7d)" value={ga4Loading ? '…' : totalEvents.toLocaleString('pt-BR')} />
              <Row label="Usuários (7d)" value={ga4Loading ? '…' : totalUsers.toLocaleString('pt-BR')} />
              {ga4Data?._stale && <WarnNote>Usando último dado real ({Math.round((Date.now()-ga4Data._stale_ts)/60000)}min atrás) — API GA4 indisponível, tentando reconectar.</WarnNote>}
              {ga4Data?.mock && !ga4Data?._stale && <WarnNote>Dados simulados — adicione o service account à conta GA4.</WarnNote>}
            </div>
          </ConnectionDropdown>

          {/* Meta */}
          <ConnectionDropdown
            icon={Activity}
            title="Meta Ads"
            summary={metaLoading ? '…' : metaData?.mock ? 'mock' : `Pixel ${metaData?.pixelId ?? '—'}`}
            status={metaLoading ? 'loading' : metaData?.mock ? 'warn' : 'ok'}
            loading={metaLoading}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row label="Pixel ID"    value={metaLoading ? '…' : metaData?.pixelId ?? '—'} mono />
              <Row label="Eventos 24h" value={metaLoading ? '…' : fmtNum(metaData?.totalEvents ?? 0)} />
              <Row label="Leads 24h"   value={metaLoading ? '…' : fmtNum(metaData?.funnel?.find(f => f.stage === 'Lead')?.count ?? 0)} />
              {metaData?.mock && <WarnNote>Dados simulados — configure o Access Token em Meta Ads.</WarnNote>}
            </div>
          </ConnectionDropdown>

          {/* Databricks */}
          <ConnectionDropdown
            icon={Database}
            title="Databricks"
            summary={execLoading ? '…' : exec?.mock ? 'mock' : `${fmtNum(exec?.mqls_7d)} MQLs 7d`}
            status={execLoading ? 'loading' : exec?.mock ? 'warn' : 'ok'}
            loading={execLoading}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Row label="Warehouse" value={appConfig?.databricks?.warehouse_id ?? '—'} mono />
              <Row label="Catalog" value={appConfig?.databricks?.catalog ?? 'production'} />
              <Row label="MQLs hoje" value={execLoading ? '…' : fmtNum(exec?.mqls_hoje)} />
              <Row label="Ganhos hoje" value={execLoading ? '…' : fmtNum(exec?.ganhos_hoje)} />
              <Row label="Conv% 7d" value={execLoading ? '…' : `${exec?.conv_7d ?? 0}%`} />
              {exec?.mock && <WarnNote>Dados simulados — verifique credenciais Databricks.</WarnNote>}
            </div>
          </ConnectionDropdown>

        </div>

        {/* ── Gráfico + Status ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>
          <EventsChartCard chartData={chartData} loading={ga4Loading} days={days} />
          <AlertsCard
            ga4Mock={!!ga4Data?.mock}
            gtmMock={!gtmHasReal && Object.keys(gtmData).length > 0}
            metaMock={!!metaData?.mock}
            databricksMock={!!exec?.mock}
          />
          <GTMHealthCard data={gtmHealth} loading={gtmHealthLoading} />
          <AnomalyAlertsCard data={anomalies} loading={anomaliesLoading} />
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

// ── ConnectionDropdown ─────────────────────────────────────────────────────
const STATUS_COLOR = { ok: '#22C55E', warn: '#F59E0B', error: '#EF4444', loading: '#B9915B' }

function ConnectionDropdown({ icon: Icon, title, summary, status, loading, children }) {
  const [open, setOpen] = useState(false)
  const col = STATUS_COLOR[status] ?? '#B9915B'

  return (
    <div style={{
      background: '#0D1B26',
      border: `1px solid ${col}33`,
      borderRadius: 10,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Header clicável */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {/* Dot de status */}
          {loading
            ? <Spinner size={12} />
            : <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
          }
          <Icon size={13} color={col} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#F5F4F3', whiteSpace: 'nowrap' }}>{title}</span>
          <span style={{
            fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{summary}</span>
        </div>
        {open
          ? <ChevronDown size={13} color="#6B7280" style={{ flexShrink: 0 }} />
          : <ChevronRight size={13} color="#6B7280" style={{ flexShrink: 0 }} />
        }
      </button>

      {/* Conteúdo expansível */}
      {open && (
        <div style={{
          borderTop: `1px solid ${col}22`,
          background: 'rgba(0,15,30,0.4)',
          padding: '10px 14px 12px',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, mono = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{
        fontSize: 11, color: '#D1D5DB', fontFamily: mono ? 'monospace' : undefined,
        textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{value}</span>
    </div>
  )
}

function WarnNote({ children }) {
  return (
    <div style={{
      fontSize: 10, color: '#F59E0B', background: 'rgba(245,158,11,0.07)',
      border: '1px solid rgba(245,158,11,0.2)', borderRadius: 5, padding: '5px 8px', marginTop: 4,
    }}>{children}</div>
  )
}

// ── Gráfico ────────────────────────────────────────────────────────────────
function buildMockChart(days = 7) {
  const counts = [1200, 800, 3400, 5200, 4800, 3100, 1900, 2600, 4100, 3700, 2900, 1500, 3800, 5100]
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
    result.push({ data: label, eventos: counts[i % counts.length] })
  }
  return result
}

function EventsChartCard({ chartData, loading, days = 7 }) {
  return (
    <Card>
      <CardHeader title={`Eventos GA4 — últimos ${days === 1 ? 'dia' : `${days} dias`}`} />
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
function AlertsCard({ ga4Mock, gtmMock, metaMock, databricksMock }) {
  const connections = [
    {
      label: 'GTM',
      ok: !gtmMock,
      warnMsg: 'Adicione o service account aos containers GTM.',
    },
    {
      label: 'GA4',
      ok: !ga4Mock,
      warnMsg: 'Adicione o service account à conta GA4.',
    },
    {
      label: 'Meta Ads',
      ok: !metaMock,
      warnMsg: 'Configure o Access Token em Meta Ads → Configurar.',
    },
    {
      label: 'Databricks',
      ok: !databricksMock,
      warnMsg: 'Verifique as credenciais em Configurações.',
    },
  ]

  const allOk = connections.every(c => c.ok)

  return (
    <Card>
      <CardHeader
        title="Status das conexões"
        subtitle={allOk ? 'Todas operacionais' : `${connections.filter(c => !c.ok).length} com atenção`}
      />
      <CardBody style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {connections.map((c) => {
            const color  = c.ok ? '#22C55E' : '#F59E0B'
            const Icon   = c.ok ? CheckCircle : AlertTriangle
            return (
              <div key={c.label} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px',
                background: `${color}08`,
                border: `1px solid ${color}28`,
                borderRadius: 7,
              }}>
                <Icon size={13} color={color} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#F5F4F3', flex: 1 }}>{c.label}</span>
                {c.ok
                  ? <span style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>Conectado</span>
                  : <span style={{ fontSize: 11, color: '#F59E0B' }}>{c.warnMsg}</span>
                }
              </div>
            )
          })}
        </div>
      </CardBody>
    </Card>
  )
}

// ── GTM Health Card ────────────────────────────────────────────────────────
function GTMHealthCard({ data, loading }) {
  const navigate = useNavigate()
  const connections = data?.connections ?? []
  const allOk = connections.length > 0 && connections.every(c => c.ok)
  const isMock = data?.mock ?? true
  const paused = data?.summary?.totalPaused ?? 0

  // Não mostra nada enquanto carrega E é mock (evita flash)
  if (!loading && isMock) return null

  return (
    <Card>
      <CardHeader
        title="Saúde das integrações GTM"
        subtitle={
          loading ? 'Verificando…'
          : allOk ? `${data.summary.containersChecked} containers OK`
          : `${connections.filter(c => !c.ok).length} item(s) com atenção`
        }
      />
      <CardBody style={{ padding: '10px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Spinner /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {connections.map((conn) => {
              const color = conn.ok ? '#22C55E' : '#F59E0B'
              const Icon  = conn.ok ? CheckCircle : AlertTriangle
              return (
                <div key={conn.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px',
                  background: `${color}08`,
                  border: `1px solid ${color}28`,
                  borderRadius: 7,
                }}>
                  <Icon size={13} color={color} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#F5F4F3', flex: 1 }}>{conn.label}</span>
                  <span style={{ fontSize: 11, color: conn.ok ? '#22C55E' : '#F59E0B', fontWeight: conn.ok ? 600 : 400 }}>
                    {conn.detail}
                  </span>
                </div>
              )
            })}
            {paused > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
                padding: '6px 12px', background: 'rgba(245,158,11,0.05)',
                border: '1px solid rgba(245,158,11,0.15)', borderRadius: 6,
              }}>
                <AlertTriangle size={11} color="#F59E0B" />
                <span style={{ fontSize: 11, color: '#8A9BAA' }}>
                  <span style={{ color: '#F59E0B', fontWeight: 700 }}>{paused}</span> tag{paused !== 1 ? 's' : ''} pausada{paused !== 1 ? 's' : ''} nos containers
                </span>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ── Anomaly Alerts ─────────────────────────────────────────────────────────
function AnomalyAlertsCard({ data, loading }) {
  if (loading) return (
    <Card>
      <CardHeader title="Anomalias detectadas" subtitle="Variação semana a semana" />
      <CardBody><div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Spinner /></div></CardBody>
    </Card>
  )

  const alerts = data?.alerts ?? []
  const isMock = data?.mock ?? true

  function fmtVal(m) {
    if (m.unit === 'R$') return fmtMoney(m.curr)
    return fmtNum(m.curr)
  }
  function fmtPrev(m) {
    if (m.unit === 'R$') return fmtMoney(m.prev)
    return fmtNum(m.prev)
  }

  if (alerts.length === 0 && !isMock) return (
    <Card>
      <CardHeader title="Anomalias detectadas" subtitle="Variação semana a semana" />
      <CardBody>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
          <CheckCircle size={18} color="#22C55E" />
          <span style={{ fontSize: 13, color: '#22C55E', fontWeight: 600 }}>Nenhuma anomalia — todas as métricas estáveis esta semana.</span>
        </div>
      </CardBody>
    </Card>
  )

  return (
    <Card>
      <CardHeader
        title="Anomalias detectadas"
        subtitle={isMock ? 'Exemplo — conecte Databricks para dados reais' : `${alerts.length} métrica${alerts.length !== 1 ? 's' : ''} com variação ≥ 20% vs semana anterior`}
        action={data && (data._stale || data.mock) ? <DataBadge data={data} /> : null}
      />
      <CardBody style={{ padding: '8px 16px 14px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map((a, i) => {
            const isUp    = a.delta > 0
            // Para MQLs e Ganhos: subida é boa, queda é ruim.
            // Para Receita: subida é boa.
            const isGood  = isUp
            const color   = isGood ? '#22C55E' : '#EF4444'
            const bgColor = isGood ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)'
            const border  = isGood ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'
            const Icon    = isUp ? TrendingUp : TrendingDown
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                background: bgColor, border: `1px solid ${border}`, borderRadius: 8,
              }}>
                <Icon size={16} color={color} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#F5F4F3', marginBottom: 2 }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: '#8A9BAA' }}>
                    {fmtPrev(a)} → <strong style={{ color: '#F5F4F3' }}>{fmtVal(a)}</strong>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color }}>{a.delta > 0 ? '+' : ''}{a.delta}%</div>
                  <div style={{ fontSize: 9, color: '#6B7280' }}>vs sem. ant.</div>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
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
