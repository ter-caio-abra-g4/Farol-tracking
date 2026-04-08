import { useState, useCallback } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import StatusBadge from '../components/ui/StatusBadge'
import Metric from '../components/ui/Metric'
import Spinner from '../components/ui/Spinner'
import { useTrackingStatus } from '../hooks/useTrackingStatus'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Tag, BarChart2, Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

export default function Dashboard() {
  const { data, loading, lastUpdated, refresh } = useTrackingStatus()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header
        title="Dashboard"
        subtitle="Visão geral de integridade do tracking"
        onRefresh={refresh}
        lastUpdated={lastUpdated}
      />

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {/* Semáforo principal */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <SemaphoreCard
            icon={Tag}
            title="GTM"
            subtitle="Container GTM-MJT8CNGM"
            status={data?.gtm?.status ?? 'loading'}
            metrics={data?.gtm?.metrics}
            loading={loading}
          />
          <SemaphoreCard
            icon={BarChart2}
            title="GA4"
            subtitle="G4 Education — propriedades ativas"
            status={data?.ga4?.status ?? 'loading'}
            metrics={data?.ga4?.metrics}
            loading={loading}
          />
          <SemaphoreCard
            icon={Activity}
            title="Meta Ads"
            subtitle="Pixel + Conversions API"
            status={data?.meta?.status ?? 'loading'}
            metrics={data?.meta?.metrics}
            loading={loading}
          />
        </div>

        {/* Alertas ativos */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <AlertsCard alerts={data?.alerts} loading={loading} />
          <EventsChartCard events={data?.eventsTimeline} loading={loading} />
        </div>

        {/* Checklist de integridade */}
        <IntegrityChecklist checks={data?.integrityChecks} loading={loading} />
      </div>
    </div>
  )
}

function SemaphoreCard({ icon: Icon, title, subtitle, status, metrics, loading }) {
  const statusBorder = {
    ok: '#22C55E',
    warn: '#F59E0B',
    error: '#EF4444',
    loading: '#B9915B',
  }

  return (
    <Card
      style={{
        borderColor: statusBorder[status] ?? '#B9915B',
        transition: 'border-color 0.3s ease',
      }}
    >
      <CardHeader
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon size={15} color="#B9915B" strokeWidth={1.8} />
            <span
              style={{
                fontFamily: "'PPMuseum','Georgia',serif",
                fontSize: 14,
                color: '#B9915B',
              }}
            >
              {title}
            </span>
          </div>
        }
        action={loading ? <Spinner size={16} /> : <StatusBadge status={status} />}
      />
      <CardBody>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
            <Spinner />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {(metrics ?? PLACEHOLDER_METRICS[title] ?? []).map((m, i) => (
              <Metric key={i} {...m} />
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 11, color: '#8A9BAA' }}>{subtitle}</div>
      </CardBody>
    </Card>
  )
}

const PLACEHOLDER_METRICS = {
  GTM: [
    { label: 'Tags ativas', value: '—', delta: undefined },
    { label: 'Triggers OK', value: '—', delta: undefined },
  ],
  GA4: [
    { label: 'Eventos/dia', value: '—', delta: undefined },
    { label: 'Propriedades', value: '—', delta: undefined },
  ],
  'Meta Ads': [
    { label: 'Match rate', value: '—', delta: undefined },
    { label: 'Eventos 24h', value: '—', delta: undefined },
  ],
}

function AlertsCard({ alerts = [], loading }) {
  const AlertIcon = {
    error: XCircle,
    warn: AlertTriangle,
    ok: CheckCircle,
  }

  const alertColor = {
    error: '#EF4444',
    warn: '#F59E0B',
    ok: '#22C55E',
  }

  return (
    <Card>
      <CardHeader title="Alertas ativos" />
      <CardBody style={{ padding: '12px 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <Spinner />
          </div>
        ) : alerts?.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#22C55E',
              fontSize: 13,
              padding: '12px 0',
            }}
          >
            <CheckCircle size={16} />
            Nenhum alerta — tudo operacional
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(alerts ?? MOCK_ALERTS).map((a, i) => {
              const Icon = AlertIcon[a.level] ?? AlertTriangle
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    background: `${alertColor[a.level]}0D`,
                    border: `1px solid ${alertColor[a.level]}33`,
                    borderRadius: 6,
                  }}
                >
                  <Icon size={14} color={alertColor[a.level]} style={{ marginTop: 1, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#F5F4F3' }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 2 }}>{a.description}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

const MOCK_ALERTS = [
  { level: 'warn', title: 'Conecte as fontes', description: 'Configure GA4, GTM e Meta nas configurações para ver dados reais.' },
]

function EventsChartCard({ events, loading }) {
  const mockData = [
    { hora: '00h', eventos: 1200 },
    { hora: '04h', eventos: 800 },
    { hora: '08h', eventos: 3400 },
    { hora: '12h', eventos: 5200 },
    { hora: '16h', eventos: 4800 },
    { hora: '20h', eventos: 3100 },
    { hora: '23h', eventos: 1900 },
  ]

  const chartData = events ?? mockData

  return (
    <Card>
      <CardHeader title="Eventos — últimas 24h" />
      <CardBody style={{ paddingTop: 8 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <Spinner />
          </div>
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
              <XAxis dataKey="hora" tick={{ fontSize: 10, fill: '#8A9BAA' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8A9BAA' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#001F35',
                  border: '1px solid #B9915B55',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#F5F4F3',
                }}
                cursor={{ stroke: '#B9915B44' }}
              />
              <Area
                type="monotone"
                dataKey="eventos"
                stroke="#B9915B"
                strokeWidth={2}
                fill="url(#goldGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  )
}

function IntegrityChecklist({ checks, loading }) {
  const items = checks ?? [
    { label: 'GTM container publicado', status: 'loading' },
    { label: 'GA4 recebendo eventos', status: 'loading' },
    { label: 'Meta Pixel disparando', status: 'loading' },
    { label: 'Conversions API ativa', status: 'loading' },
    { label: 'purchase event presente', status: 'loading' },
    { label: 'lead event presente', status: 'loading' },
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
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                background: '#031A26',
                borderRadius: 6,
                border: '1px solid rgba(185,145,91,0.1)',
              }}
            >
              {loading ? <Spinner size={14} /> : iconMap[item.status] ?? iconMap.loading}
              <span style={{ fontSize: 12, color: '#F5F4F3' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}
