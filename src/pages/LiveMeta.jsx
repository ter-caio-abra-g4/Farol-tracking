import { useState, useEffect, useRef, useCallback } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import { api } from '../services/api'
import { fmtNum, fmtMoney } from '../utils/format'
import { TT } from '../components/ui/DarkTooltip'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Radio, RefreshCw, Clock, CheckCircle2, AlertTriangle, DollarSign } from 'lucide-react'

const POLL_MS = 30_000

const ACCOUNTS = [
  { value: '',                     label: 'Todas as contas' },
  { value: 'act_942577509469439',  label: 'LGEN' },
  { value: 'act_584341142722462',  label: 'SOCIAL' },
  { value: 'act_324663872349737',  label: 'SELFCHECKOUT' },
]

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function StatusBadge({ loading, mock, error, account }) {
  const isFatal = !mock && error
  const color = isFatal ? '#EF4444' : mock ? '#F59E0B' : '#22C55E'
  const icon  = isFatal ? <AlertTriangle size={12} /> : mock ? <Clock size={12} /> : <CheckCircle2 size={12} />
  const label = account ? `Meta · ${ACCOUNTS.find(a => a.value === account)?.label ?? account}` : 'Meta Ads'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: `${color}12`, border: `1px solid ${color}40`,
      borderRadius: 6, padding: '4px 10px',
    }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
      <span style={{ fontSize: 10, color: '#6B7280' }}>~15 min</span>
      {loading && <RefreshCw size={10} color="#6B7280" style={{ animation: 'spin 1s linear infinite' }} />}
    </div>
  )
}

function KpiCard({ label, value, sub, color = '#E1306C', sparkData, pulse }) {
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
                <linearGradient id={`smeta-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
                fill={`url(#smeta-${color.replace('#', '')})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default function LiveMeta() {
  const [account, setAccount]     = useState('')
  const [isRunning, setIsRunning] = useState(true)
  const [countdown, setCountdown] = useState(POLL_MS / 1000)
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(false)

  const historyRef = useRef([])
  const [history, setHistory]     = useState([])
  const prevLeadsRef = useRef(null)

  const minutelyRef = useRef({})
  const [minutelyData, setMinutelyData] = useState([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const timeLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const result = await api.liveMeta(account)
    setData(result)
    setLoading(false)

    const leads = result?.totalLeads ?? 0
    const prev  = prevLeadsRef.current
    const delta = prev != null ? Math.max(0, leads - prev) : 0
    prevLeadsRef.current = leads

    const point = { time: timeLabel, delta, totalLeads: leads, cpl: result?.cpl ?? 0 }
    const updated = [...historyRef.current, point].slice(-40)
    historyRef.current = updated
    setHistory(updated)

    // Minutely
    const minuteKey = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const mb = minutelyRef.current
    if (!mb[minuteKey]) mb[minuteKey] = { minute: minuteKey, delta: 0, ts: now.getTime() }
    mb[minuteKey].delta += delta
    const cutoff = now.getTime() - 60 * 60 * 1000
    for (const k of Object.keys(mb)) { if (mb[k].ts < cutoff) delete mb[k] }
    setMinutelyData(Object.values(mb).sort((a, b) => a.ts - b.ts))

    setCountdown(POLL_MS / 1000)
  }, [account])

  useEffect(() => {
    historyRef.current = []
    prevLeadsRef.current = null
    minutelyRef.current = {}
    setHistory([])
    setMinutelyData([])
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

  const SELECT_STYLE = {
    background: '#001F35', border: '1px solid rgba(225,48,108,0.35)',
    borderRadius: 6, color: '#F5F4F3', padding: '5px 28px 5px 10px',
    fontSize: 12, cursor: 'pointer', outline: 'none', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23E1306C' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
    fontFamily: 'Manrope, sans-serif',
  }

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
        title="Meta Ads · Ao Vivo"
        subtitle="Leads, investimento e CPL em tempo real"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusBadge loading={loading} mock={data?.mock} error={data?.error} account={account} />
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
              background: 'rgba(225,48,108,0.1)', border: '1px solid rgba(225,48,108,0.3)',
              color: '#E1306C', display: 'flex', alignItems: 'center', gap: 4,
            }}><RefreshCw size={11} /> Agora</button>
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Seletor de conta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Conta:</span>
          <select value={account} onChange={e => setAccount(e.target.value)} style={SELECT_STYLE}>
            {ACCOUNTS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <KpiCard
            label="Leads hoje"
            value={fmtNum(data?.totalLeads ?? 0)}
            sub={`atualizado às ${fmtTime(data?.capturedAt)}`}
            color="#E1306C"
            sparkData={history.slice(-12).map(p => ({ v: p.totalLeads }))}
            pulse={!data?.mock}
          />
          <KpiCard
            label="Novos leads (ciclo)"
            value={history.length > 0 ? `+${fmtNum(history[history.length - 1]?.delta ?? 0)}` : '—'}
            sub={`delta do último ciclo de 30s`}
            color="#F43F5E"
            sparkData={history.slice(-12).map(p => ({ v: p.delta }))}
            pulse={!data?.mock}
          />
          <KpiCard
            label="CPL atual"
            value={data?.cpl ? fmtMoney(data.cpl) : '—'}
            sub={data?.cpl ? (data.cpl < 150 ? '✓ abaixo de R$150' : data.cpl < 300 ? '~ referência' : '↑ acima de R$300') : '—'}
            color={!data?.cpl ? '#6B7280' : data.cpl < 150 ? '#22C55E' : data.cpl < 300 ? '#F59E0B' : '#EF4444'}
          />
          <KpiCard
            label="Investimento hoje"
            value={data?.totalSpend ? fmtMoney(data.totalSpend) : '—'}
            sub={`${fmtNum(data?.totalLeads ?? 0)} leads · ${data?.topAds?.length ?? 0} anúncios`}
            color="#B9915B"
          />
        </div>

        {/* Pulso de leads */}
        {history.length >= 2 && (
          <Card>
            <CardHeader
              title="Pulso de leads · Meta"
              subtitle={`Novos leads por ciclo de 30s · ${history.length} ciclos`}
              action={<div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}><DollarSign size={10} />{fmtTime(data?.capturedAt)}</div>}
            />
            <CardBody>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={history} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="metaPulseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E1306C" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#E1306C" stopOpacity={0} />
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
                        {payload.map((p, i) => <div key={i} style={{ color: p.color, fontSize: 11 }}>{p.name}: +{fmtNum(p.value)}</div>)}
                      </div>
                    )
                  }} />
                  <Area type="monotone" dataKey="delta" name="Δ Leads" stroke="#E1306C" strokeWidth={2} fill="url(#metaPulseGrad)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        )}

        {/* Top anúncios */}
        <Card>
          <CardHeader
            title="Top anúncios hoje"
            subtitle={`${fmtMoney(data?.totalSpend ?? 0)} investido · ${fmtNum(data?.totalLeads ?? 0)} leads`}
          />
          <CardBody style={{ padding: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 70px', gap: 8, padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { label: 'Criativo / Campanha', align: 'left' },
                { label: 'Investimento',        align: 'right' },
                { label: 'Leads',               align: 'right' },
                { label: 'CPL',                 align: 'right' },
              ].map((h, i) => (
                <div key={i} style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textAlign: h.align }}>{h.label}</div>
              ))}
            </div>
            {(data?.topAds || []).length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>Sem dados de hoje</div>
            ) : (data.topAds || []).map((ad, i) => {
              const shortName = (() => {
                const parts = (ad.name || '').split('_')
                return parts.length > 3 ? parts.slice(0, 3).join('_') + '…' : ad.name
              })()
              const cplColor = !ad.cpl ? '#6B7280' : ad.cpl < 150 ? '#22C55E' : ad.cpl < 300 ? '#F59E0B' : '#EF4444'
              return (
                <div key={i} style={{ padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'grid', gridTemplateColumns: '1fr 80px 60px 70px', gap: 8, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#F5F4F3', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ad.name}>{shortName}</div>
                    <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 1 }}>{ad.campaign}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#B9915B', fontWeight: 700 }}>{fmtMoney(ad.spend)}</div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#F5F4F3' }}>{fmtNum(ad.leads)}</div>
                  <div style={{ textAlign: 'right', fontSize: 11, color: cplColor, fontWeight: 700 }}>
                    {ad.cpl != null ? fmtMoney(ad.cpl) : '—'}
                  </div>
                </div>
              )
            })}
          </CardBody>
        </Card>

        {/* Gráfico CPL por ciclo */}
        {history.length >= 3 && history.some(p => p.cpl > 0) && (
          <Card>
            <CardHeader title="CPL ao longo da sessão" subtitle="Custo por lead capturado a cada ciclo" />
            <CardBody>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={history.filter(p => p.cpl > 0)} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" tick={{ fill: '#8A9BAA', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#8A9BAA', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={TT.cursorLine} content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div style={TT.contentStyle}>
                        <div style={{ fontWeight: 700, fontSize: 11 }}>{label}</div>
                        <div style={{ color: '#B9915B', fontSize: 11 }}>CPL: {fmtMoney(payload[0]?.value)}</div>
                      </div>
                    )
                  }} />
                  <Line type="monotone" dataKey="cpl" name="CPL" stroke="#B9915B" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        )}

      </div>
    </div>
  )
}
