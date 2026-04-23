import { useState, useEffect, useRef, useCallback } from 'react'
import Header from '../components/layout/Header'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import { api } from '../services/api'
import { fmtNum, fmtMoney } from '../utils/format'
import { TT } from '../components/ui/DarkTooltip'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Radio, RefreshCw, AlertTriangle, CheckCircle2, Clock,
  Activity, DollarSign, Database, History, Download, Trash2, X,
} from 'lucide-react'
import { useTracking } from '../context/TrackingContext'

const POLL_INTERVAL_MS = 30_000   // 30 segundos

// Gera um sessionId diário: live-YYYYMMDD-evento
// Mesmo ID se o app reiniciar no mesmo dia com o mesmo evento — garante continuidade
function makeSessionId(eventFilter) {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const dateStr = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`
  return `live-${dateStr}-${eventFilter.replace(/[^a-z0-9_]/gi, '_')}`
}

// Extrai data YYYYMMDD de qualquer formato de sessionId (novo ou legado com hora)
function sessionDateKey(id) {
  const m = id.match(/live-(\d{8})/)
  return m ? m[1] : null
}

// Recorta pontos pelo filtro de período (em minutos; 0 = todos)
function filterPointsByPeriod(points, minutes) {
  if (!minutes || !points?.length) return points || []
  const cutoff = Date.now() - minutes * 60 * 1000
  return points.filter(p => {
    const ts = p.savedAt ? new Date(p.savedAt).getTime() : 0
    return ts >= cutoff
  })
}

// Exporta array de points como CSV e dispara download
function exportCsv(session) {
  if (!session?.points?.length) return
  const headers = ['time', 'ga4', 'meta', 'databricks', 'crm', 'qualificados', 'savedAt']
  const rows = session.points.map(p =>
    [p.time, p.ga4 ?? 0, p.meta ?? 0, p.databricks ?? 0, p.crm ?? 0, p.qualificados ?? 0, p.savedAt ?? ''].join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${session.id}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Formata timestamp ISO para HH:MM:SS
function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Formata ms epoch para HH:MM
function fmtEpochTime(ts) {
  if (!ts) return '—'
  const ms = typeof ts === 'string' && ts.length === 13 ? parseInt(ts) : parseInt(ts) * (ts.length === 10 ? 1000 : 1)
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ── Badge de status da fonte ───────────────────────────────────────────────────
function SourceBadge({ label, loading, mock, error, latency }) {
  const color = error ? '#EF4444' : mock ? '#F59E0B' : '#22C55E'
  const icon  = error ? <AlertTriangle size={12} /> : mock ? <Clock size={12} /> : <CheckCircle2 size={12} />
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: `${color}12`, border: `1px solid ${color}40`,
      borderRadius: 6, padding: '4px 10px',
    }}>
      <span style={{ color, display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
      {latency && <span style={{ fontSize: 10, color: '#6B7280' }}>{latency}</span>}
      {loading && <RefreshCw size={10} color="#6B7280" style={{ animation: 'spin 1s linear infinite' }} />}
    </div>
  )
}

// ── KPI live ───────────────────────────────────────────────────────────────────
function LiveKpi({ label, value, sub, color = '#B9915B', pulse = false }) {
  return (
    <div style={{
      background: '#0D1B26', border: `1px solid ${color}33`,
      borderRadius: 10, padding: '14px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, background: color, borderRadius: '10px 0 0 10px',
      }} />
      {pulse && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 8, height: 8, borderRadius: '50%', background: '#22C55E',
          boxShadow: '0 0 0 0 rgba(34,197,94,0.4)',
          animation: 'liveKpiPulse 1.5s ease-out infinite',
        }} />
      )}
      <div style={{ fontSize: 20, fontWeight: 800, color: '#F5F4F3', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color, marginTop: 4, fontWeight: 700 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Linha da tabela de eventos GA4 ────────────────────────────────────────────
function EventRow({ ev, max, highlight }) {
  const pct = max > 0 ? (ev.count / max) * 100 : 0
  const isHighlight = highlight && ev.event === highlight
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 60px 60px',
      gap: 8, alignItems: 'center',
      padding: '7px 12px',
      background: isHighlight ? 'rgba(185,145,91,0.06)' : 'transparent',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      borderLeft: isHighlight ? '2px solid #B9915B' : '2px solid transparent',
    }}>
      <div>
        <div style={{ fontSize: 12, color: isHighlight ? '#B9915B' : '#F5F4F3', fontWeight: isHighlight ? 700 : 500 }}>
          {ev.event}
        </div>
        <div style={{
          marginTop: 4, height: 3, borderRadius: 2,
          background: 'rgba(255,255,255,0.06)',
          width: '100%',
        }}>
          <div style={{ width: `${pct}%`, height: '100%', background: isHighlight ? '#B9915B' : '#4B6272', borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 12, color: '#F5F4F3', fontWeight: 600 }}>{fmtNum(ev.count)}</div>
      <div style={{ textAlign: 'right', fontSize: 11, color: '#8A9BAA' }}>{fmtNum(ev.users)} u</div>
    </div>
  )
}

// Função helper para notificação nativa (não-bloqueante, ignora se não disponível)
function notify(title, body, urgency = 'normal') {
  try {
    if (typeof window !== 'undefined' && window.rais?.notify) {
      window.rais.notify(title, body, urgency)
    }
  } catch (_) { /* silencioso em browser/dev sem Electron */ }
}

export default function LiveMonitor() {
  const { selectedGA4 } = useTracking()

  const [eventFilter, setEventFilter]   = useState('generate_lead')
  const [inputEvent, setInputEvent]     = useState('generate_lead')
  const [isRunning, setIsRunning]       = useState(true)
  const [countdown, setCountdown]       = useState(POLL_INTERVAL_MS / 1000)

  // Rastreia ciclos consecutivos com problema por fonte para threshold de alertas
  // { ga4ZeroCycles, metaZeroCycles, dbMockAfterReal }
  const alertStateRef = useRef({ ga4ZeroCycles: 0, metaZeroCycles: 0, dbMockAfterReal: false })

  const [ga4Data, setGa4Data]           = useState(null)
  const [metaData, setMetaData]         = useState(null)
  const [dbData, setDbData]             = useState(null)

  const [ga4Loading, setGa4Loading]     = useState(false)
  const [metaLoading, setMetaLoading]   = useState(false)
  const [dbLoading, setDbLoading]       = useState(false)
  const [crmLoading, setCrmLoading]     = useState(false)

  // Filtro de campanha UTM (opcional — filtra CRM)
  const [campaignFilter, setCampaignFilter] = useState('')
  const [inputCampaign, setInputCampaign]   = useState('')
  const [crmData, setCrmData]               = useState(null)

  // Histórico de snapshots — em memória (ref) + persiste no servidor
  const [history, setHistory]           = useState([])
  const historyRef = useRef([])

  // Último ponto anterior — para calcular delta entre ciclos
  const prevPointRef = useRef(null)

  // ID da sessão atual — criado uma vez por montagem + mudança de filtro
  const sessionIdRef = useRef(makeSessionId('generate_lead'))

  // Painel de histórico
  const [showHistory, setShowHistory]       = useState(false)
  const [sessions, setSessions]             = useState([])
  const [loadingSession, setLoadingSession] = useState(false)
  const [viewSession, setViewSession]       = useState(null)   // sessão sendo visualizada
  const [viewDayAll, setViewDayAll]         = useState(false)  // modo "dia todo"
  const [dayAllPoints, setDayAllPoints]     = useState([])     // pontos agregados do dia
  const [periodFilter, setPeriodFilter]     = useState(0)      // 0=tudo, 30, 60, 180 (min)
  const [loadingDayAll, setLoadingDayAll]   = useState(false)

  const propertyId = selectedGA4 || '381992026'

  // Carrega lista de sessões ao abrir o painel
  useEffect(() => {
    if (!showHistory) return
    api.liveSessions().then(r => setSessions(r?.sessions || []))
  }, [showHistory])

  const fetchAll = useCallback(async () => {
    const now = new Date()
    const timeLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    setGa4Loading(true); setMetaLoading(true); setDbLoading(true); setCrmLoading(true)

    const [ga4, meta, db, crm] = await Promise.all([
      api.liveGa4(propertyId, eventFilter),
      api.liveMeta(),
      api.liveDatabricks(eventFilter),
      api.liveCrm(campaignFilter),
    ])

    setGa4Data(ga4)
    setMetaData(meta)
    setDbData(db)
    setCrmData(crm)
    setGa4Loading(false); setMetaLoading(false); setDbLoading(false); setCrmLoading(false)

    const evRow = (ga4?.topEvents || []).find(e => e.event === eventFilter)
    const ga4Count = evRow?.count ?? 0
    const dbCount  = db?.total ?? 0

    const point = {
      time:         timeLabel,
      ga4:          ga4Count,
      meta:         meta?.totalLeads ?? 0,
      databricks:   dbCount,
      crm:          crm?.totalLeads ?? 0,
      qualificados: crm?.qualificados ?? 0,
      dbMock:       !!(db?.mock),
      eventFilter,
      savedAt:      new Date().toISOString(),
    }

    // Delta em relação ao ponto anterior (quanto mudou neste ciclo de 30s)
    const prev = prevPointRef.current
    point.deltaGa4  = prev != null ? ga4Count - (prev.ga4 ?? 0) : null
    point.deltaMeta = prev != null ? (meta?.totalLeads ?? 0) - (prev.meta ?? 0) : null
    prevPointRef.current = point

    // Histórico: guarda deltas para o gráfico de pulso
    const deltaPoint = {
      time:       timeLabel,
      savedAt:    point.savedAt,
      ga4Delta:   Math.max(0, point.deltaGa4 ?? 0),
      metaDelta:  Math.max(0, point.deltaMeta ?? 0),
      // Databricks e CRM são acumulados do dia — não faz sentido delta
      crm:        crm?.totalLeads ?? 0,
      qualificados: crm?.qualificados ?? 0,
    }

    // Atualiza histórico em memória
    const updated = [...historyRef.current, deltaPoint].slice(-40)
    historyRef.current = updated
    setHistory(updated)
    setCountdown(POLL_INTERVAL_MS / 1000)

    // Persiste no servidor (fire-and-forget — não bloqueia o UI)
    api.liveSavePoint(sessionIdRef.current, point)

    // ── Alertas proativos ────────────────────────────────────────────────────
    // Só ativa após ter pelo menos 2 pontos de histórico (evita falso positivo no boot)
    const pts = historyRef.current
    if (pts.length >= 2) {
      const al = alertStateRef.current

      // GA4: 3 ciclos consecutivos com evento-alvo = 0 quando antes tinha > 0
      const hadGa4 = pts.slice(-6, -3).some(p => (p.ga4 ?? 0) > 0)
      if (!ga4?.mock && ga4Count === 0 && hadGa4) {
        al.ga4ZeroCycles = (al.ga4ZeroCycles || 0) + 1
        if (al.ga4ZeroCycles === 3) {
          notify(
            '⚠️ GA4 sem dados',
            `Evento "${eventFilter}" está em 0 há 3 ciclos (≈ 90s). Verifique o GA4 Realtime.`,
            'normal'
          )
        }
      } else {
        al.ga4ZeroCycles = 0
      }

      // Meta: 4 ciclos com leads = 0 quando antes tinha > 0
      const hadMeta = pts.slice(-8, -4).some(p => (p.meta ?? 0) > 0)
      if (!meta?.mock && (meta?.totalLeads ?? 0) === 0 && hadMeta) {
        al.metaZeroCycles = (al.metaZeroCycles || 0) + 1
        if (al.metaZeroCycles === 4) {
          notify(
            '⚠️ Meta · Sem leads',
            'Meta Ads não registra leads novos há 4 ciclos (≈ 2 min). Verifique o Ads Manager.',
            'normal'
          )
        }
      } else {
        al.metaZeroCycles = 0
      }

      // Databricks: voltou para mock depois de ter sido real — possível timeout
      const wasReal = pts.slice(-3).some(p => !(p.dbMock ?? true))
      if (db?.mock && wasReal && !al.dbMockAfterReal) {
        al.dbMockAfterReal = true
        notify(
          '⚠️ Databricks · Timeout',
          'A conexão com Databricks caiu. Dados voltaram para modo estimado.',
          'normal'
        )
      } else if (!db?.mock) {
        al.dbMockAfterReal = false
      }
    }
    // ── Fim alertas ──────────────────────────────────────────────────────────
  }, [propertyId, eventFilter, campaignFilter])

  // Polling automático
  useEffect(() => {
    fetchAll()
    if (!isRunning) return
    const interval = setInterval(fetchAll, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchAll, isRunning])

  // Countdown visual
  useEffect(() => {
    if (!isRunning) return
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(tick)
  }, [isRunning, ga4Data])

  const handleApplyFilter = () => {
    const newFilter = inputEvent.trim() || 'generate_lead'
    setEventFilter(newFilter)
    // Nova sessão ao trocar o evento monitorado
    sessionIdRef.current = makeSessionId(newFilter)
    historyRef.current = []
    setHistory([])
  }

  const handleApplyCampaign = () => {
    setCampaignFilter(inputCampaign.trim())
    historyRef.current = []
    setHistory([])
  }

  async function handleViewSession(id) {
    setLoadingSession(true)
    const session = await api.liveSession(id)
    setViewSession(session)
    setPeriodFilter(0)
    setLoadingSession(false)
  }

  // Agrega todos os pontos do dia atual de todas as sessões (suporta reinicializações)
  async function handleViewDayAll() {
    setLoadingDayAll(true)
    setViewDayAll(true)
    setViewSession(null)
    setPeriodFilter(0)
    const today = (() => {
      const d = new Date()
      const pad = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`
    })()
    // Busca lista de sessões e filtra as do dia de hoje (suporta formato legado com hora)
    const { sessions: all } = await api.liveSessions()
    const todaySessions = (all || []).filter(s => sessionDateKey(s.id) === today)
    // Carrega pontos de cada sessão em paralelo
    const results = await Promise.all(todaySessions.map(s => api.liveSession(s.id)))
    // Merge e ordena cronologicamente por savedAt
    const merged = results
      .flatMap(s => (s?.points || []))
      .sort((a, b) => new Date(a.savedAt || 0) - new Date(b.savedAt || 0))
    setDayAllPoints(merged)
    setLoadingDayAll(false)
  }

  async function handleDeleteSession(id) {
    await api.liveDeleteSession(id)
    setSessions(s => s.filter(sess => sess.id !== id))
    if (viewSession?.id === id) setViewSession(null)
  }

  // Max para barra de progresso da tabela de eventos
  const maxCount = Math.max(...(ga4Data?.topEvents || []).map(e => e.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Animações inline */}
      <style>{`
        @keyframes liveKpiPulse {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <Header
        title="Monitor ao Vivo"
        subtitle="Triangulação GA4 · Meta · Databricks em tempo real"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Indicador ao vivo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: isRunning ? '#22C55E' : '#6B7280' }}>
              <Radio size={12} />
              {isRunning ? `Ao vivo · próxima em ${countdown}s` : 'Pausado'}
            </div>
            <button
              onClick={() => setIsRunning(r => !r)}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
                background: isRunning ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                border: `1px solid ${isRunning ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
                color: isRunning ? '#EF4444' : '#22C55E',
              }}
            >
              {isRunning ? 'Pausar' : 'Retomar'}
            </button>
            <button
              onClick={fetchAll}
              style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                background: 'rgba(185,145,91,0.1)', border: '1px solid rgba(185,145,91,0.3)',
                color: '#B9915B', fontFamily: 'Manrope, sans-serif',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <RefreshCw size={11} /> Agora
            </button>
            <button
              onClick={() => setShowHistory(h => !h)}
              style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                background: showHistory ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)',
                border: `1px solid ${showHistory ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.25)'}`,
                color: '#A5B4FC', fontFamily: 'Manrope, sans-serif',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <History size={11} /> Histórico
            </button>
          </div>
        }
      />

      {/* ── Painel de Histórico (drawer lateral) ── */}
      {showHistory && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 420,
          background: '#020F1A', borderLeft: '1px solid rgba(99,102,241,0.25)',
          zIndex: 100, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
        }}>
          {/* Header do painel */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#F5F4F3' }}>Histórico de Sessões</div>
                <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 2 }}>{sessions.length} sessão{sessions.length !== 1 ? 'ões' : ''} salva{sessions.length !== 1 ? 's' : ''}</div>
              </div>
              <button onClick={() => { setShowHistory(false); setViewSession(null); setViewDayAll(false) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9BAA', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
            {/* Botão Dia Todo */}
            <button
              onClick={handleViewDayAll}
              disabled={loadingDayAll}
              style={{
                width: '100%', padding: '7px 0', borderRadius: 7, fontSize: 12, fontWeight: 700,
                cursor: loadingDayAll ? 'wait' : 'pointer', fontFamily: 'Manrope, sans-serif',
                background: viewDayAll ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)',
                border: `1px solid ${viewDayAll ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.25)'}`,
                color: '#A5B4FC', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Activity size={12} />
              {loadingDayAll ? 'Carregando…' : 'Ver dia todo (hoje)'}
            </button>
          </div>

          {/* Conteúdo do painel */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* ── View: Dia todo ── */}
            {viewDayAll && !viewSession ? (() => {
              const pts = filterPointsByPeriod(dayAllPoints, periodFilter)
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <button onClick={() => setViewDayAll(false)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9BAA', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      ← Voltar
                    </button>
                    <button
                      onClick={() => exportCsv({ id: `dia-todo-${new Date().toISOString().slice(0,10)}`, points: pts })}
                      style={{
                        marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                        background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                      <Download size={11} /> CSV
                    </button>
                  </div>

                  {/* Info + filtro de período */}
                  <div style={{ background: '#0D1B26', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC', marginBottom: 6 }}>
                      Hoje — {new Date().toLocaleDateString('pt-BR')}
                    </div>
                    <div style={{ fontSize: 11, color: '#8A9BAA', marginBottom: 8 }}>
                      {dayAllPoints.length} pontos totais · {pts.length} exibidos
                    </div>
                    {/* Filtro de período */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[{ label: '30min', v: 30 }, { label: '1h', v: 60 }, { label: '3h', v: 180 }, { label: 'Tudo', v: 0 }].map(opt => (
                        <button key={opt.v} onClick={() => setPeriodFilter(opt.v)}
                          style={{
                            flex: 1, padding: '4px 0', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                            background: periodFilter === opt.v ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.08)',
                            border: `1px solid ${periodFilter === opt.v ? 'rgba(99,102,241,0.7)' : 'rgba(99,102,241,0.2)'}`,
                            color: periodFilter === opt.v ? '#E0E7FF' : '#8A9BAA',
                          }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Gráfico do dia todo */}
                  {pts.length >= 2 && (
                    <div style={{ background: '#0D1B26', borderRadius: 8, padding: '10px 8px', marginBottom: 8 }}>
                      <ResponsiveContainer width="100%" height={150}>
                        <LineChart data={pts} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="time" tick={{ fill: '#8A9BAA', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                          <YAxis tick={{ fill: '#8A9BAA', fontSize: 9 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: '#0D1B26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 10 }} />
                          <Line type="monotone" dataKey="ga4"        name="GA4"        stroke="#6366F1" strokeWidth={1.5} dot={false} />
                          <Line type="monotone" dataKey="meta"       name="Meta"       stroke="#E1306C" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                          <Line type="monotone" dataKey="databricks" name="Databricks" stroke="#F59E0B" strokeWidth={1.5} dot={false} strokeDasharray="2 2" />
                          <Line type="monotone" dataKey="crm"        name="CRM"        stroke="#22C55E" strokeWidth={1.5} dot={false} strokeDasharray="6 2" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {pts.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 12, padding: '24px 0' }}>
                      Nenhum ponto no período selecionado.
                    </div>
                  )}

                  {/* Tabela de pontos */}
                  {pts.length > 0 && (
                    <div style={{ background: '#0D1B26', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr 1fr 1fr 1fr', gap: 6, padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {[
                          { label: 'Hora', color: '#6B7280' }, { label: 'GA4', color: '#6366F1' },
                          { label: 'Meta', color: '#E1306C' }, { label: 'DB',  color: '#F59E0B' },
                          { label: 'CRM',  color: '#22C55E' }, { label: 'MQL', color: '#06B6D4' },
                        ].map((h, i) => (
                          <div key={i} style={{ fontSize: 10, color: h.color, fontWeight: 700, textAlign: i > 0 ? 'right' : 'left' }}>{h.label}</div>
                        ))}
                      </div>
                      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                        {[...pts].reverse().map((p, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr 1fr 1fr 1fr', gap: 6, padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ fontSize: 10, color: '#8A9BAA', fontFamily: 'monospace' }}>{p.time}</div>
                            <div style={{ textAlign: 'right', fontSize: 10, color: '#6366F1', fontWeight: 600 }}>{fmtNum(p.ga4)}</div>
                            <div style={{ textAlign: 'right', fontSize: 10, color: '#E1306C', fontWeight: 600 }}>{fmtNum(p.meta)}</div>
                            <div style={{ textAlign: 'right', fontSize: 10, color: '#F59E0B', fontWeight: 600 }}>{fmtNum(p.databricks)}</div>
                            <div style={{ textAlign: 'right', fontSize: 10, color: '#22C55E', fontWeight: 600 }}>{fmtNum(p.crm ?? 0)}</div>
                            <div style={{ textAlign: 'right', fontSize: 10, color: '#06B6D4', fontWeight: 600 }}>{fmtNum(p.qualificados ?? 0)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })() : viewSession ? (
              /* ── View: sessão específica ── */
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <button onClick={() => setViewSession(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A9BAA', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                    ← Voltar
                  </button>
                  <button onClick={() => exportCsv({ ...viewSession, points: filterPointsByPeriod(viewSession.points, periodFilter) })}
                    style={{
                      marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                    <Download size={11} /> CSV
                  </button>
                </div>
                <div style={{ background: '#0D1B26', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC', marginBottom: 4 }}>{viewSession.id}</div>
                  <div style={{ fontSize: 11, color: '#8A9BAA' }}>Evento: <span style={{ color: '#F5F4F3' }}>{viewSession.eventFilter || '—'}</span></div>
                  <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 2, marginBottom: 8 }}>
                    {viewSession.points?.length || 0} pontos · {new Date(viewSession.createdAt).toLocaleString('pt-BR')}
                  </div>
                  {/* Filtro de período */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[{ label: '30min', v: 30 }, { label: '1h', v: 60 }, { label: '3h', v: 180 }, { label: 'Tudo', v: 0 }].map(opt => (
                      <button key={opt.v} onClick={() => setPeriodFilter(opt.v)}
                        style={{
                          flex: 1, padding: '4px 0', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                          background: periodFilter === opt.v ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.08)',
                          border: `1px solid ${periodFilter === opt.v ? 'rgba(99,102,241,0.7)' : 'rgba(99,102,241,0.2)'}`,
                          color: periodFilter === opt.v ? '#E0E7FF' : '#8A9BAA',
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mini gráfico da sessão (filtrado) */}
                {(() => {
                  const pts = filterPointsByPeriod(viewSession.points, periodFilter)
                  return pts.length >= 2 ? (
                    <div style={{ background: '#0D1B26', borderRadius: 8, padding: '10px 8px', marginBottom: 8 }}>
                      <ResponsiveContainer width="100%" height={140}>
                        <LineChart data={pts} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="time" tick={{ fill: '#8A9BAA', fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                          <YAxis tick={{ fill: '#8A9BAA', fontSize: 9 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: '#0D1B26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 10 }} />
                          <Line type="monotone" dataKey="ga4"        name="GA4"        stroke="#6366F1" strokeWidth={1.5} dot={false} />
                          <Line type="monotone" dataKey="meta"       name="Meta"       stroke="#E1306C" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                          <Line type="monotone" dataKey="databricks" name="Databricks" stroke="#F59E0B" strokeWidth={1.5} dot={false} strokeDasharray="2 2" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null
                })()}

                {/* Tabela de pontos (filtrada) */}
                {(() => {
                  const pts = filterPointsByPeriod(viewSession.points, periodFilter)
                  return (
                    <div style={{ background: '#0D1B26', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr 1fr 1fr 1fr', gap: 6, padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {[
                          { label: 'Hora', color: '#6B7280' }, { label: 'GA4', color: '#6366F1' },
                          { label: 'Meta', color: '#E1306C' }, { label: 'DB',  color: '#F59E0B' },
                          { label: 'CRM',  color: '#22C55E' }, { label: 'MQL', color: '#06B6D4' },
                        ].map((h, i) => (
                          <div key={i} style={{ fontSize: 10, color: h.color, fontWeight: 700, textAlign: i > 0 ? 'right' : 'left' }}>{h.label}</div>
                        ))}
                      </div>
                      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                        {[...pts].reverse().map((p, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr 1fr 1fr 1fr', gap: 6, padding: '5px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ fontSize: 10, color: '#8A9BAA', fontFamily: 'monospace' }}>{p.time}</div>
                            <div style={{ textAlign: 'right', fontSize: 10, color: '#6366F1', fontWeight: 600 }}>{fmtNum(p.ga4)}</div>
                            <div style={{ textAlign: 'right', fontSize: 10, color: '#E1306C', fontWeight: 600 }}>{fmtNum(p.meta)}</div>
                            <div style={{ textAlign: 'right', fontSize: 10, color: '#F59E0B', fontWeight: 600 }}>{fmtNum(p.databricks)}</div>
                            <div style={{ textAlign: 'right', fontSize: 10, color: '#22C55E', fontWeight: 600 }}>{fmtNum(p.crm ?? 0)}</div>
                            <div style={{ textAlign: 'right', fontSize: 10, color: '#06B6D4', fontWeight: 600 }}>{fmtNum(p.qualificados ?? 0)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </>
            ) : (
              /* ── Lista de sessões ── */
              sessions.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 12, padding: '40px 0' }}>
                  Nenhuma sessão salva ainda.<br />O histórico é criado automaticamente durante o monitoramento.
                </div>
              ) : (
                sessions.map((s) => (
                  <div key={s.id} style={{
                    background: '#0D1B26', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#F5F4F3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.id}</div>
                      <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 2 }}>
                        {s.pointCount} pontos · {new Date(s.createdAt).toLocaleString('pt-BR')}
                      </div>
                      {s.firstPoint && (
                        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>{s.firstPoint} → {s.lastPoint}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => handleViewSession(s.id)}
                        disabled={loadingSession}
                        style={{ padding: '4px 8px', borderRadius: 5, fontSize: 10, cursor: 'pointer', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#A5B4FC' }}>
                        {loadingSession ? '...' : 'Ver'}
                      </button>
                      <button
                        onClick={async () => { const full = await api.liveSession(s.id); exportCsv(full) }}
                        title="Exportar CSV"
                        style={{ padding: '4px 6px', borderRadius: 5, fontSize: 10, cursor: 'pointer', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22C55E', display: 'flex', alignItems: 'center' }}>
                        <Download size={10} />
                      </button>
                      <button
                        onClick={() => handleDeleteSession(s.id)}
                        title="Excluir sessão"
                        style={{ padding: '4px 6px', borderRadius: 5, fontSize: 10, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Filtro de evento + status das fontes ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Evento:</span>
            <input
              value={inputEvent}
              onChange={e => setInputEvent(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleApplyFilter()}
              placeholder="ex: generate_lead"
              style={{
                background: '#0D1B26', border: '1px solid rgba(185,145,91,0.25)',
                borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#F5F4F3',
                fontFamily: 'monospace', width: 180, outline: 'none',
              }}
            />
            <button
              onClick={handleApplyFilter}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
                background: 'rgba(185,145,91,0.15)', border: '1px solid rgba(185,145,91,0.4)',
                color: '#B9915B',
              }}
            >
              Aplicar
            </button>
          </div>
          {/* Filtro de campanha UTM */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#8A9BAA', fontWeight: 700 }}>Campanha:</span>
            <input
              value={inputCampaign}
              onChange={e => setInputCampaign(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleApplyCampaign()}
              placeholder="utm_campaign (opcional)"
              style={{
                background: '#0D1B26', border: `1px solid ${campaignFilter ? 'rgba(34,197,94,0.4)' : 'rgba(99,102,241,0.25)'}`,
                borderRadius: 6, padding: '5px 10px', fontSize: 12, color: '#F5F4F3',
                fontFamily: 'monospace', width: 200, outline: 'none',
              }}
            />
            <button
              onClick={handleApplyCampaign}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.35)',
                color: '#A5B4FC',
              }}
            >
              {campaignFilter ? 'Atualizar' : 'Filtrar'}
            </button>
            {campaignFilter && (
              <button
                onClick={() => { setCampaignFilter(''); setInputCampaign(''); historyRef.current = []; setHistory([]) }}
                style={{ padding: '5px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}
              >
                ✕ limpar
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <SourceBadge label="GA4 Realtime" loading={ga4Loading} mock={ga4Data?.mock} error={ga4Data?.error} latency="~1 min" />
            <SourceBadge label="Meta Ads"     loading={metaLoading} mock={metaData?.mock} error={metaData?.error} latency="~15 min" />
            <SourceBadge label="Databricks"   loading={dbLoading}   mock={dbData?.mock}  error={dbData?.error}  latency={dbData?.latencyNote ? 'pipeline' : ''} />
            <SourceBadge label="CRM"          loading={crmLoading}  mock={crmData?.mock} error={crmData?.error} latency="5–30 min" />
          </div>
        </div>

        {/* ── Aviso de latência ── */}
        <div style={{
          background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 6, padding: '6px 14px', fontSize: 11, color: '#A5B4FC',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Clock size={12} />
          <span>
            <strong>GA4</strong> ~1 min ·&nbsp;
            <strong>Meta</strong> ~15 min ·&nbsp;
            <strong>Databricks</strong> 5–30 min ·&nbsp;
            <strong>CRM</strong> pipeline 5–30 min
            {campaignFilter && <> · Filtrando campanha: <strong style={{ color: '#22C55E' }}>{campaignFilter}</strong></>}
          </span>
        </div>

        {/* ══════════════════════════════════════════════════════════
            BLOCO 1 — TEMPO REAL (este instante)
            Valores do snapshot mais recente: ativos agora, delta do ciclo
        ══════════════════════════════════════════════════════════ */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radio size={10} color="#22C55E" />
            Agora — snapshot do último ciclo (30s)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {/* GA4: usuários ativos + novo evento neste ciclo */}
            {(() => {
              const lastDelta = history.length > 0 ? history[history.length - 1]?.ga4Delta ?? null : null
              return (
                <LiveKpi
                  label={`GA4 · "${eventFilter}" neste ciclo`}
                  value={lastDelta != null ? `+${fmtNum(lastDelta)}` : fmtNum((ga4Data?.topEvents || []).find(e => e.event === eventFilter)?.count ?? 0)}
                  sub={`${fmtNum(ga4Data?.activeUsers ?? 0)} usuários ativos agora · ${fmtTime(ga4Data?.capturedAt)}`}
                  color="#6366F1"
                  pulse={!ga4Data?.mock}
                />
              )
            })()}
            {/* Meta: delta de leads neste ciclo */}
            {(() => {
              const lastDelta = history.length > 0 ? history[history.length - 1]?.metaDelta ?? null : null
              return (
                <LiveKpi
                  label="Meta · novos leads neste ciclo"
                  value={lastDelta != null ? `+${fmtNum(lastDelta)}` : '—'}
                  sub={`CPL atual ${metaData?.cpl ? fmtMoney(metaData.cpl) : '—'} · ${fmtTime(metaData?.capturedAt)}`}
                  color="#E1306C"
                  pulse={!metaData?.mock}
                />
              )
            })()}
            {/* Databricks: último evento visto */}
            <LiveKpi
              label="Databricks · último evento"
              value={fmtEpochTime(dbData?.lastSeenTs)}
              sub={`${fmtNum(dbData?.uniqueUsers ?? 0)} usuários únicos hoje`}
              color="#F59E0B"
              pulse={!dbData?.mock}
            />
            {/* CRM: qualificados */}
            <LiveKpi
              label="Qualificados (MQL) hoje"
              value={fmtNum(crmData?.qualificados ?? 0)}
              sub={crmData?.totalLeads ? `${Math.round(((crmData.qualificados ?? 0) / crmData.totalLeads) * 100)}% dos leads do dia` : '—'}
              color="#06B6D4"
              pulse={!crmData?.mock}
            />
          </div>
        </div>

        {/* ── Gráfico de pulso — delta por ciclo ── */}
        <Card>
          <CardHeader
            title={`Pulso de atividade · "${eventFilter}"`}
            subtitle={`Novos eventos por ciclo de 30s · ${history.filter(p => p.ga4Delta != null).length} ciclos capturados`}
          />
          <CardBody>
            {history.length < 2 ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 12 }}>
                Aguardando dados… ({history.length}/2 ciclos)
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={history} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#8A9BAA', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={TT.cursorLine}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div style={TT.contentStyle}>
                          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11 }}>{label}</div>
                          {payload.map((p, i) => (
                            <div key={i} style={{ color: p.color, fontSize: 11 }}>
                              {p.name}: +{fmtNum(p.value)}
                            </div>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Line type="monotone" dataKey="ga4Delta"  name={`GA4 "${eventFilter}"`} stroke="#6366F1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="metaDelta" name="Meta leads"              stroke="#E1306C" strokeWidth={2} dot={false} activeDot={{ r: 4 }} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* ══════════════════════════════════════════════════════════
            BLOCO 2 — ACUMULADO DO DIA (desde meia-noite)
            Totais reais de cada fonte para referência contextual
        ══════════════════════════════════════════════════════════ */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={10} color="#8A9BAA" />
            Acumulado do dia — totais desde meia-noite
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <LiveKpi
              label={`GA4 · "${eventFilter}" hoje`}
              value={fmtNum((ga4Data?.topEvents || []).find(e => e.event === eventFilter)?.count ?? 0)}
              sub={`${fmtNum(ga4Data?.totalEvents ?? 0)} eventos no total`}
              color="#6366F1"
            />
            <LiveKpi
              label="Meta · leads hoje"
              value={fmtNum(metaData?.totalLeads ?? 0)}
              sub={`${fmtMoney(metaData?.totalSpend ?? 0)} investido`}
              color="#E1306C"
            />
            <LiveKpi
              label={`Databricks · "${eventFilter}" hoje`}
              value={fmtNum(dbData?.total ?? 0)}
              sub={`${fmtNum(dbData?.uniqueUsers ?? 0)} usuários únicos`}
              color="#F59E0B"
            />
            <LiveKpi
              label={`CRM · leads hoje${campaignFilter ? ` (${campaignFilter})` : ''}`}
              value={fmtNum(crmData?.totalLeads ?? 0)}
              sub={`${fmtNum(crmData?.ganhos ?? 0)} ganhos`}
              color="#22C55E"
            />
            <LiveKpi
              label="CPL Meta (dia)"
              value={metaData?.cpl ? fmtMoney(metaData.cpl) : '—'}
              sub={metaData?.totalLeads ? `base: ${fmtNum(metaData.totalLeads)} leads` : '—'}
              color={!metaData?.cpl ? '#6B7280' : metaData.cpl < 150 ? '#22C55E' : metaData.cpl < 300 ? '#F59E0B' : '#EF4444'}
            />
          </div>
        </div>

        {/* ── Detalhe GA4 + Meta lado a lado ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Top eventos GA4 */}
          <Card>
            <CardHeader
              title="Top eventos GA4 (agora)"
              subtitle={`${fmtNum(ga4Data?.totalEvents ?? 0)} eventos · ${fmtNum(ga4Data?.activeUsers ?? 0)} ativos`}
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}>
                  <Activity size={10} />
                  {fmtTime(ga4Data?.capturedAt)}
                </div>
              }
            />
            <CardBody style={{ padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: 8, padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Evento', 'Disparos', 'Usuários'].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
                ))}
              </div>
              {(ga4Data?.topEvents || []).length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>Sem dados</div>
              ) : (
                (ga4Data?.topEvents || []).map((ev, i) => (
                  <EventRow key={i} ev={ev} max={maxCount} highlight={eventFilter} />
                ))
              )}
            </CardBody>
          </Card>

          {/* Top anúncios Meta hoje */}
          <Card>
            <CardHeader
              title="Top anúncios Meta (hoje)"
              subtitle={`${fmtMoney(metaData?.totalSpend ?? 0)} investido · ${fmtNum(metaData?.totalLeads ?? 0)} leads`}
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}>
                  <DollarSign size={10} />
                  {fmtTime(metaData?.capturedAt)}
                </div>
              }
            />
            <CardBody style={{ padding: 0 }}>
              {/* Header colunas */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 70px 50px 60px',
                gap: 8, padding: '6px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                {[
                  { label: 'Criativo / Campanha', align: 'left'  },
                  { label: 'Invest.',             align: 'right' },
                  { label: 'Leads',               align: 'right' },
                  { label: 'CPL',                 align: 'right' },
                ].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textAlign: h.align }}>{h.label}</div>
                ))}
              </div>
              {(metaData?.topAds || []).length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: '#6B7280', fontSize: 12 }}>Sem dados de hoje</div>
              ) : (
                (metaData?.topAds || []).map((ad, i) => {
                  const nameParts = (ad.name || '').split('_')
                  const shortName = nameParts.length > 3 ? nameParts.slice(0, 3).join('_') + '…' : ad.name
                  return (
                    <div key={i} style={{
                      padding: '9px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      display: 'grid', gridTemplateColumns: '1fr 70px 50px 60px', gap: 8, alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#F5F4F3', fontWeight: 600 }} title={ad.name}>{shortName}</div>
                        <div style={{ fontSize: 10, color: '#8A9BAA', marginTop: 1 }}>{ad.campaign}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 11, color: '#B9915B', fontWeight: 700 }}>{fmtMoney(ad.spend)}</div>
                      <div style={{ textAlign: 'right', fontSize: 11, color: '#F5F4F3' }}>{fmtNum(ad.leads)}</div>
                      <div style={{ textAlign: 'right' }}>
                        {ad.cpl != null
                          ? <span style={{ color: ad.cpl < 150 ? '#22C55E' : ad.cpl < 300 ? '#F59E0B' : '#EF4444', fontSize: 11, fontWeight: 700 }}>{fmtMoney(ad.cpl)}</span>
                          : <span style={{ color: '#6B7280', fontSize: 11 }}>—</span>
                        }
                      </div>
                    </div>
                  )
                })
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── Top 5 páginas — pódio ── */}
        {(ga4Data?.topPages?.length > 0) && (
          <Card>
            <CardHeader
              title="Páginas mais acessadas agora"
              subtitle="GA4 realtime · últimos 30 min · page_view"
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}>
                  <Activity size={10} />
                  {fmtTime(ga4Data?.capturedAt)}
                </div>
              }
            />
            <CardBody>
              {(() => {
                const pages = ga4Data.topPages
                const maxViews = pages[0]?.views || 1
                const MEDALS = ['#F59E0B', '#9CA3AF', '#B45309', '#6B7280', '#6B7280']
                const RANK_LABEL = ['1°', '2°', '3°', '4°', '5°']
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Header de colunas */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ minWidth: 28 }} />
                      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 700 }}>Página</span>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, minWidth: 60, textAlign: 'right' }}>Page views</span>
                          <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, minWidth: 70, textAlign: 'right' }}>Usuários ativos</span>
                        </div>
                      </div>
                    </div>
                    {pages.map((p, i) => {
                      const pct = (p.views / maxViews) * 100
                      const isFirst = i === 0
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {/* Rank */}
                          <div style={{
                            minWidth: 28, textAlign: 'center',
                            fontSize: isFirst ? 16 : 13,
                            fontWeight: 800,
                            color: MEDALS[i],
                          }}>
                            {RANK_LABEL[i]}
                          </div>
                          {/* Barra + label */}
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{
                                fontSize: isFirst ? 13 : 11,
                                fontWeight: isFirst ? 700 : 500,
                                color: isFirst ? '#F5F4F3' : '#C4D0DC',
                                fontFamily: 'monospace',
                                maxWidth: '55%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }} title={p.page}>
                                {p.page}
                              </span>
                              <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                                <span style={{ color: isFirst ? MEDALS[0] : '#8A9BAA', fontWeight: isFirst ? 700 : 400, minWidth: 60, textAlign: 'right' }}>
                                  {fmtNum(p.views)} views
                                </span>
                                <span style={{ color: '#6366F1', minWidth: 70, textAlign: 'right' }}>
                                  {fmtNum(p.users)} usuários
                                </span>
                              </div>
                            </div>
                            {/* Barra estilo pódio */}
                            <div style={{ height: isFirst ? 6 : 4, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                              <div style={{
                                width: `${pct}%`, height: '100%',
                                background: isFirst
                                  ? `linear-gradient(90deg, ${MEDALS[0]}, ${MEDALS[0]}88)`
                                  : MEDALS[i],
                                borderRadius: 3,
                                opacity: isFirst ? 1 : 0.7,
                                transition: 'width 0.4s ease',
                              }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </CardBody>
          </Card>
        )}

        {/* ── CRM Top Campanhas hoje ── */}
        {crmData && !crmData.mock && crmData.topCampaigns?.length > 0 && (
          <Card>
            <CardHeader
              title="Top Campanhas CRM · hoje"
              subtitle={`${campaignFilter ? `Filtro ativo: ${campaignFilter} · ` : ''}${crmData.topCampaigns.length} campanha${crmData.topCampaigns.length !== 1 ? 's' : ''} com leads hoje`}
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}>
                  <Database size={10} />
                  {fmtTime(crmData.capturedAt)}
                </div>
              }
            />
            <CardBody style={{ padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px', gap: 8, padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { label: 'Campanha UTM',  align: 'left'  },
                  { label: 'Leads',         align: 'right' },
                  { label: 'Qualificados',  align: 'right' },
                  { label: 'Ganhos',        align: 'right' },
                ].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, color: '#6B7280', fontWeight: 700, textAlign: h.align }}>{h.label}</div>
                ))}
              </div>
              {(() => {
                const maxLeads = crmData.topCampaigns[0]?.leads || 1
                return crmData.topCampaigns.map((c, i) => {
                  const pct = Math.round((c.leads / maxLeads) * 100)
                  const qualRate = c.leads > 0 ? Math.round((c.qualificados / c.leads) * 100) : 0
                  return (
                    <div key={i} style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontSize: 11, color: '#F5F4F3', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.campaign}>
                          {c.campaign || '(sem utm_campaign)'}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 11, color: '#22C55E', fontWeight: 700 }}>{fmtNum(c.leads)}</div>
                        <div style={{ textAlign: 'right', fontSize: 11, color: '#06B6D4', fontWeight: 600 }}>
                          {fmtNum(c.qualificados)}
                          {c.leads > 0 && <span style={{ fontSize: 9, color: '#6B7280', marginLeft: 3 }}>{qualRate}%</span>}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 11, color: c.ganhos > 0 ? '#F59E0B' : '#6B7280', fontWeight: c.ganhos > 0 ? 700 : 400 }}>
                          {c.ganhos > 0 ? fmtNum(c.ganhos) : '—'}
                        </div>
                      </div>
                      {/* Barra proporcional de leads */}
                      <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#22C55E', borderRadius: 2, opacity: 0.6, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  )
                })
              })()}
            </CardBody>
          </Card>
        )}

        {/* ── Databricks detail ── */}
        {dbData && !dbData.mock && (
          <Card>
            <CardHeader
              title={`Databricks · evento "${eventFilter}" hoje`}
              subtitle={dbData.latencyNote}
              action={
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280' }}>
                  <Database size={10} />
                  {fmtTime(dbData.capturedAt)}
                </div>
              }
            />
            <CardBody>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Total de eventos', value: fmtNum(dbData.total), color: '#F59E0B' },
                  { label: 'Usuários únicos',  value: fmtNum(dbData.uniqueUsers), color: '#06B6D4' },
                  { label: 'Último evento',    value: fmtEpochTime(dbData.lastSeenTs), color: '#22C55E' },
                ].map((k, i) => (
                  <div key={i} style={{ background: '#031A26', border: `1px solid ${k.color}22`, borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#F5F4F3' }}>{k.value}</div>
                    <div style={{ fontSize: 11, color: k.color, marginTop: 4, fontWeight: 600 }}>{k.label}</div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

      </div>
    </div>
  )
}
