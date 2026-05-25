import { useState, useEffect, useRef, useCallback } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import { api } from '../services/api'
import { fmtNum } from '../utils/format'
import { TT } from '../components/ui/DarkTooltip'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Radio, RefreshCw, Clock, CheckCircle2, AlertTriangle, Database } from 'lucide-react'

const POLL_MS = 30_000

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtEpochTime(ts) {
  if (!ts) return '—'
  const ms = typeof ts === 'string' && ts.length === 13 ? parseInt(ts) : parseInt(ts) * (ts.length === 10 ? 1000 : 1)
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ loading, mock, error }) {
  const isFatal = !mock && error
  const color = isFatal ? '#EF4444' : mock ? '#F59E0B' : '#22C55E'
  const icon  = isFatal ? <AlertTriangle size={12} /> : mock ? <Clock size={12} /> : <CheckCircle2 size={12} />
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: `${color}12`, border: `1px solid ${color}40`,
      borderRadius: 6, padding: '4px 10px',
    }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>Databricks</span>
      <span style={{ fontSize: 10, color: '#6B7280' }}>pipeline 5–30 min</span>
      {loading && <RefreshCw size={10} color="#6B7280" style={{ animation: 'spin 1s linear infinite' }} />}
    </div>
  )
}

function KpiCard({ label, value, sub, color = '#F59E0B', sparkData, pulse }) {
  return (
    <div style={{
      background: '#0D1B26', border: `1px solid ${color}33`,
      borderRadius: 10, padding: '14px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color, borderRadius: '10px 0 0 10px' }} />
      {pulse && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 8, height: 8, borderRadius: '50%', background: '#22C55E',
          animation: 'liveKpiPulse 1.5s ease-out infinite',
        }} />
      )}
      <div style={{ fontSize: 20, fontWeight: 800, color: '#F5F4F3', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color, marginTop: 4, fontWeight: 700 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{sub}</div>}
      {sparkData?.length >= 3 && (
        <div style={{ marginTop: 8, opacity: 0.7 }}>
          <ResponsiveContainer width="100%" height={28}>
            <AreaChart data={sparkData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`sdb-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
                fill={`url(#sdb-${color.replace('#', '')})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default function LiveDatabricks() {
  const [eventFilter, setEventFilter] = useState('generate_lead')
  const [inputEvent, setInputEvent]   = useState('generate_lead')
  const [isRunning, setIsRunning]     = useState(true)
  const [countdown, setCountdown]     = useState(POLL_MS / 1000)
  const [data, setData]               = useState(null)
  const [loading, setLoading]         = useState(false)

  const historyRef = useRef([])
  const [history, setHistory] = useState([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const timeLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const result = await api.liveDatabricks(eventFilter)
    setData(result)
    setLoading(false)

    const point = {
      time:        timeLabel,
      total:       result?.total ?? 0,
      uniqueUsers: result?.uniqueUsers ?? 0,
      mock:        !!(result?.mock),
    }
    const updated = [...historyRef.current, point].slice(-40)
    historyRef.current = updated
    setHistory(updated)
    setCountdown(POLL_MS / 1000)
  }, [eventFilter])

  useEffect(() => {
    fetchData()
    if (!isRunning) return
    const iv = setInterval(fetchData, POLL_MS)
    return () => clearInterval(iv)
  }, [fetchData, isRunning])

  useEffect(() => {
    if (!isRunning) return
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(tick)
  }, [isRunning, data])

  const applyFilter = () => {
    const f = inputEvent.trim() || 'generate_lead'
    setEventFilter(f)
    historyRef.current = []
    setHistory([])
  }

  // Evolução por hora (agrega pontos por HH:00)
  const hourlyData = (() => {
    const byHour = {}
    for (const p of history) {
      const now = new Date()
      // Use index * 30s para estimar hora (não temos savedAt aqui — usa posição relativa)
      const hKey = p.time?.slice(0, 5) || '00:00'
      if (!byHour[hKey]) byHour[hKey] = { hour: hKey, total: 0, users: 0 }
      byHour[hKey].total = p.total
      byHour[hKey].users = p.uniqueUsers
    }
    return Object.values(byHour).sort((a, b) => a.hour.localeCompare(b.hour))
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        @keyframes liveKpiPulse {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <Header
        title="Databricks · Ao Vivo"
        subtitle="Pipeline CRM — eventos, usuários e cohort em tempo real"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusBadge loading={loading} mock={data?.mock} error={data?.error} />
            <div style={{ fontSize: 11, color: isRunning ? '#22C55E' : '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Radio size={11} />
              {isRunning ? `${countdown}s` : 'Pausado'}
            </div>
            <button onClick={() => setIsRunning(r => !r)} style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Manrope, sans-serif',
              background: isRunning ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
              border: `1px solid ${isRunning ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
              color: isRunning ? '#EF4444' : '#22C55E',
            }}>{isRunning ? 'Pausar' : 'Retomar'}</button>
            <button onClick={fetchData} style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 4,
            }}><RefreshCw size={11} /> Agora</button>
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Filtro de evento */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Evento:</span>
          <input
            value={inputEvent}
            onChange={e => setInputEvent(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilter()}
            style={{
              background: '#0D1B26', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#F5F4F3',
              fontFamily: 'monospace', width: 200, outline: 'none',
            }}
          />
          <button onClick={applyFilter} style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'Manrope, sans-serif',
            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: '#F59E0B',
          }}>Aplicar</button>
        </div>

        {/* Aviso de latência */}
        <div style={{
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 6, padding: '6px 14px', fontSize: 11, color: '#D97706',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Clock size={12} />
          <span>Databricks usa pipeline batch — latência de 5–30 min. Valores são acumulados do dia (não realtime puro).</span>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <KpiCard
            label={`"${eventFilter}" hoje`}
            value={fmtNum(data?.total ?? 0)}
            sub={`dados do pipeline · ${fmtTime(data?.capturedAt)}`}
            color="#F59E0B"
            sparkData={history.slice(-12).map(p => ({ v: p.total }))}
            pulse={!data?.mock}
          />
          <KpiCard
            label="Usuários únicos hoje"
            value={fmtNum(data?.uniqueUsers ?? 0)}
            sub={`distinct user_id no pipeline`}
            color="#06B6D4"
            sparkData={history.slice(-12).map(p => ({ v: p.uniqueUsers }))}
            pulse={!data?.mock}
          />
          <KpiCard
            label="Último evento visto"
            value={fmtEpochTime(data?.lastSeenTs)}
            sub={data?.latencyNote ?? 'pipeline batch'}
            color="#22C55E"
          />
          <KpiCard
            label="Ciclos capturados"
            value={fmtNum(history.length)}
            sub={data?.mock ? '⚠ modo estimado' : '✓ dados reais'}
            color={data?.mock ? '#F59E0B' : '#34D399'}
          />
        </div>

        {/* Evolução ao longo dos ciclos */}
        {history.length >= 2 && (
          <Card>
            <CardHeader
              title={`Evolução · "${eventFilter}" hoje`}
              subtitle={`Total acumulado no pipeline ao longo da sessão · ${history.length} ciclos`}
              action={<div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}><Database size={10} />{fmtTime(data?.capturedAt)}</div>}
            />
            <CardBody>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={history} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dbTotalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dbUsersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" tick={{ fill: '#8A9BAA', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#8A9BAA', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={TT.cursorLine} content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div style={TT.contentStyle}>
                        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11 }}>{label}</div>
                        {payload.map((p, i) => <div key={i} style={{ color: p.color, fontSize: 11 }}>{p.name}: {fmtNum(p.value)}</div>)}
                      </div>
                    )
                  }} />
                  <Area type="monotone" dataKey="total"       name={`"${eventFilter}" total`} stroke="#F59E0B" strokeWidth={2} fill="url(#dbTotalGrad)" dot={false} activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="uniqueUsers" name="Usuários únicos"           stroke="#06B6D4" strokeWidth={1.5} fill="url(#dbUsersGrad)" dot={false} activeDot={{ r: 3 }} strokeDasharray="5 3" />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        )}

        {/* Detalhe do último snapshot */}
        {data && !data.mock && (
          <Card>
            <CardHeader
              title="Snapshot do pipeline"
              subtitle={data.latencyNote ?? 'Dados do Databricks'}
              action={<div style={{ fontSize: 10, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}><Database size={10} />{fmtTime(data.capturedAt)}</div>}
            />
            <CardBody>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: `"${eventFilter}" hoje`,  value: fmtNum(data.total),                     color: '#F59E0B' },
                  { label: 'Usuários únicos',         value: fmtNum(data.uniqueUsers),               color: '#06B6D4' },
                  { label: 'Último evento às',        value: fmtEpochTime(data.lastSeenTs),          color: '#22C55E' },
                ].map((k, i) => (
                  <div key={i} style={{ background: '#031A26', border: `1px solid ${k.color}22`, borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F4F3' }}>{k.value}</div>
                    <div style={{ fontSize: 11, color: k.color, marginTop: 5, fontWeight: 600 }}>{k.label}</div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {data?.mock && (
          <div style={{
            background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 8, padding: '16px 20px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', marginBottom: 6 }}>
              ⚠ Modo estimado — Databricks não conectado
            </div>
            <div style={{ fontSize: 12, color: '#8A9BAA', lineHeight: 1.6 }}>
              Configure as credenciais Databricks em <strong style={{ color: '#F5F4F3' }}>Configurações → Databricks</strong> para ver dados reais do pipeline. Os valores exibidos são estimados.
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
