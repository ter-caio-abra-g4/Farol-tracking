import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { CheckCircle, AlertTriangle, Key, ArrowRight, Download, Zap, Loader, XCircle, FolderOpen, ChevronDown, Upload, Link, RefreshCw, Shield } from 'lucide-react'

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState('detect') // detect | manual | review | done
  const [detection, setDetection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [metaToken, setMetaToken] = useState('')
  const [serviceAccountEmail, setServiceAccountEmail] = useState('')
  const [serviceAccountPath, setServiceAccountPath] = useState('')
  const [ga4Properties, setGa4Properties] = useState([])   // lista de props detectadas
  const [ga4PropId, setGa4PropId] = useState('')            // id selecionado
  const [loadingProps, setLoadingProps] = useState(false)   // buscando props após SA
  const [saving, setSaving] = useState(false)
  const [testResults, setTestResults] = useState(null)
  const [testing, setTesting] = useState(false)
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)

  useEffect(() => {
    api.detectG4OS().then((result) => {
      setDetection(result)
      setLoading(false)
      if (result?.g4osDetected) {
        setStep('review')
        // Se G4 OS detectado, já tenta listar propriedades
        fetchProperties()
      } else {
        setStep('manual')
      }
    })
  }, [])

  async function fetchProperties() {
    setLoadingProps(true)
    try {
      const res = await api.ga4Properties()
      if (!res?.mock && res?.properties?.length > 0) {
        setGa4Properties(res.properties)
        // Pré-seleciona a primeira
        setGa4PropId(res.properties[0].id)
      }
    } catch (_) {
      // silencia — o usuário vai ver o dropdown vazio
    } finally {
      setLoadingProps(false)
    }
  }

  async function handlePickServiceAccount() {
    if (!window.rais?.pickServiceAccount) return
    const result = await window.rais.pickServiceAccount()
    if (!result) return
    if (result.error) {
      alert('Erro ao ler Service Account: ' + result.error)
      return
    }
    setServiceAccountEmail(result.client_email)
    setServiceAccountPath(result.path)
    // Persiste caminho no config
    await api.saveConfig({ ga4: { service_account_path: result.path, client_email: result.client_email } })
    // Agora lista as propriedades automaticamente
    fetchProperties()
  }

  async function handleTestConnections() {
    setTesting(true)
    setTestResults(null)
    try {
      const [gtmRes, ga4Res, metaRes] = await Promise.all([
        api.gtmContainers(),
        api.ga4Properties(),
        api.metaStats(),
      ])
      setTestResults({
        gtm: {
          ok: !gtmRes?.mock,
          detail: !gtmRes?.mock
            ? `${gtmRes?.containers?.length ?? 0} containers encontrados`
            : 'Usando dados mock — verifique service-account',
        },
        ga4: {
          ok: !ga4Res?.mock,
          detail: !ga4Res?.mock
            ? `${ga4Res?.properties?.length ?? 0} propriedades disponíveis`
            : 'Sem acesso — adicione o service account no GA4 Admin',
        },
        meta: {
          ok: !metaRes?.mock,
          detail: !metaRes?.mock
            ? `Match rate: ${metaRes?.matchRate ?? '—'}%`
            : 'Usando dados mock — configure o Meta Access Token',
        },
      })
    } catch (err) {
      setTestResults({ error: 'Erro ao testar conexões: ' + err.message })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    const cfg = {}
    if (metaToken) cfg.meta = { access_token: metaToken, pixel_id: '702432142505333' }
    if (ga4PropId) cfg.ga4 = { ...(serviceAccountPath ? { service_account_path: serviceAccountPath } : {}), property_id: ga4PropId }
    await api.saveConfig(cfg)
    setSaving(false)
    onComplete()
  }

  // ---- Propriedades GA4 — campo compartilhado ----
  const PropertySelector = () => {
    if (loadingProps) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#001F35', border: '1px solid rgba(185,145,91,0.3)', borderRadius: 6, color: '#8A9BAA', fontSize: 13 }}>
          <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />
          Buscando propriedades...
        </div>
      )
    }

    if (ga4Properties.length > 0) {
      return (
        <div style={{ position: 'relative' }}>
          <select
            value={ga4PropId}
            onChange={(e) => setGa4PropId(e.target.value)}
            style={{
              ...inputStyle,
              appearance: 'none',
              cursor: 'pointer',
              paddingRight: 36,
            }}
          >
            {ga4Properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.id})
              </option>
            ))}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#8A9BAA', pointerEvents: 'none' }} />
        </div>
      )
    }

    // Fallback: input manual (service account ainda não configurado)
    return (
      <input
        type="text"
        placeholder={serviceAccountEmail ? 'Nenhuma propriedade encontrada — digitar ID manualmente' : 'Configure o Service Account primeiro'}
        value={ga4PropId}
        onChange={(e) => setGa4PropId(e.target.value)}
        style={{ ...inputStyle, color: serviceAccountEmail ? '#F5F4F3' : '#8A9BAA' }}
        disabled={!serviceAccountEmail && !loadingProps}
      />
    )
  }

  // ---- Campo Service Account (compartilhado) ----
  const ServiceAccountPicker = ({ label = 'Google Service Account (.json)' }) => (
    <div>
      <label style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 6, display: 'block' }}>{label}</label>
      <button
        type="button"
        onClick={handlePickServiceAccount}
        style={{
          ...inputStyle,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          color: serviceAccountEmail ? '#22C55E' : '#8A9BAA',
          justifyContent: 'flex-start',
          borderColor: serviceAccountEmail ? 'rgba(34,197,94,0.4)' : 'rgba(185,145,91,0.3)',
        }}
      >
        {serviceAccountEmail
          ? <CheckCircle size={14} color="#22C55E" />
          : <FolderOpen size={14} />}
        {serviceAccountEmail
          ? serviceAccountEmail
          : 'Clique para selecionar service-account.json'}
      </button>
      {serviceAccountEmail && (
        <div style={{ fontSize: 11, color: '#22C55E', marginTop: 4 }}>
          Arquivo copiado com segurança para o perfil do app
        </div>
      )}
      {!serviceAccountEmail && (
        <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 4 }}>
          Necessário para GA4 e GTM. O arquivo é copiado para o perfil do app.
        </div>
      )}
    </div>
  )

  // ============================
  if (loading) {
    return (
      <Screen>
        <div style={{ color: '#8A9BAA', fontSize: 14 }}>Detectando configurações...</div>
      </Screen>
    )
  }

  // ---- STEP: REVIEW (G4 OS detectado) ----
  if (step === 'review') {
    return (
      <Screen>
        <Logo />
        <h2 style={{ fontFamily: "'PPMuseum','Georgia',serif", fontSize: 22, color: '#B9915B', marginBottom: 8 }}>
          G4 OS detectado
        </h2>
        <p style={{ color: '#8A9BAA', fontSize: 13, marginBottom: 28, textAlign: 'center', maxWidth: 420 }}>
          Encontramos suas credenciais do G4 OS. O Farol vai usar as mesmas conexões.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 400, marginBottom: 20 }}>
          <DetectRow label="GA4 Service Account" ok={!!detection?.ga4ServiceAccount}
            detail={detection?.ga4ServiceAccount ? 'service-account.json encontrado' : 'Não encontrado'} />
          <DetectRow label="GTM OAuth" ok={!!detection?.gtmReady}
            detail={detection?.gtmReady ? 'Configurado via G4 OS' : 'Não configurado'} />
          <DetectRow label="Meta Access Token" ok={false} detail="Precisa ser configurado manualmente" />
        </div>

        {/* Service account manual (se não detectado) */}
        {!detection?.ga4ServiceAccount && (
          <div style={{ width: '100%', maxWidth: 400, marginBottom: 12 }}>
            <ServiceAccountPicker label="Service Account (não detectado automaticamente)" />
          </div>
        )}

        {/* Propriedades GA4 */}
        <div style={{ width: '100%', maxWidth: 400, marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 6, display: 'block' }}>
            Propriedade GA4
          </label>
          <PropertySelector />
          {ga4Properties.length > 0 && (
            <div style={{ fontSize: 11, color: '#22C55E', marginTop: 4 }}>
              {ga4Properties.length} propriedade{ga4Properties.length > 1 ? 's' : ''} encontrada{ga4Properties.length > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Meta token */}
        <div style={{ width: '100%', maxWidth: 400, marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 6, display: 'block' }}>
            Meta Access Token
          </label>
          <input type="password" placeholder="EAAxxxxxxx..." value={metaToken}
            onChange={(e) => setMetaToken(e.target.value)} style={inputStyle} />
        </div>

        <button onClick={handleTestConnections} disabled={testing}
          style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(185,145,91,0.5)', color: '#B9915B', marginBottom: 4 }}>
          {testing
            ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Testando...</>
            : <><Zap size={15} /> Testar conexão</>}
        </button>

        {testResults && !testResults.error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 400, marginBottom: 12 }}>
            <TestResult label="GTM" ok={testResults.gtm.ok} detail={testResults.gtm.detail} />
            <TestResult label="GA4" ok={testResults.ga4.ok} detail={testResults.ga4.detail} />
            <TestResult label="Meta" ok={testResults.meta.ok} detail={testResults.meta.detail} />
          </div>
        )}
        {testResults?.error && (
          <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 8 }}>{testResults.error}</div>
        )}

        <button onClick={handleSave} disabled={saving} style={btnStyle}>
          {saving ? 'Configurando...' : <><Download size={15} /> Importar e continuar</>}
        </button>
        <button onClick={onComplete}
          style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(185,145,91,0.3)', color: '#8A9BAA', marginTop: 0 }}>
          Pular por agora — usar dados demo
        </button>
      </Screen>
    )
  }

  // ---- STEP: MANUAL ----
  return (
    <Screen>
      <Logo />
      <h2 style={{ fontFamily: "'PPMuseum','Georgia',serif", fontSize: 22, color: '#B9915B', marginBottom: 8 }}>
        Configurar conexões
      </h2>
      <p style={{ color: '#8A9BAA', fontSize: 13, marginBottom: 28, textAlign: 'center', maxWidth: 420 }}>
        Configure as credenciais para conectar o Farol aos dados reais de GTM, GA4 e Meta.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 400, marginBottom: 24 }}>

        {/* 1. Service Account primeiro — desbloqueia o dropdown de propriedades */}
        <ServiceAccountPicker />

        {/* 2. Propriedade GA4 — dropdown automático após SA configurado */}
        <div>
          <label style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 6, display: 'block' }}>
            Propriedade GA4
          </label>
          <PropertySelector />
          {ga4Properties.length > 0 && (
            <div style={{ fontSize: 11, color: '#22C55E', marginTop: 4 }}>
              {ga4Properties.length} propriedade{ga4Properties.length > 1 ? 's' : ''} encontrada{ga4Properties.length > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* 3. Meta token */}
        <div>
          <label style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 6, display: 'block' }}>
            Meta Access Token
          </label>
          <input type="password" placeholder="EAAxxxxxxx..." value={metaToken}
            onChange={(e) => setMetaToken(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <button onClick={handleTestConnections} disabled={testing}
        style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(185,145,91,0.5)', color: '#B9915B', marginBottom: 4 }}>
        {testing
          ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Testando...</>
          : <><Zap size={15} /> Testar conexão</>}
      </button>

      {testResults && !testResults.error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 400, marginBottom: 12 }}>
          <TestResult label="GTM" ok={testResults.gtm.ok} detail={testResults.gtm.detail} />
          <TestResult label="GA4" ok={testResults.ga4.ok} detail={testResults.ga4.detail} />
          <TestResult label="Meta" ok={testResults.meta.ok} detail={testResults.meta.detail} />
        </div>
      )}
      {testResults?.error && (
        <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 8 }}>{testResults.error}</div>
      )}

      <button onClick={handleSave} disabled={saving} style={btnStyle}>
        {saving ? 'Salvando...' : <><ArrowRight size={15} /> Salvar e abrir Farol</>}
      </button>

      {/* Botão de importar credenciais portáteis */}
      <button
        onClick={() => setShowCredentialsModal(true)}
        style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(185,145,91,0.35)', color: '#B9915B', marginTop: 0 }}
      >
        <Upload size={14} /> Importar credenciais (.json)
      </button>

      <button onClick={onComplete}
        style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(185,145,91,0.2)', color: '#8A9BAA', marginTop: 0 }}>
        Pular — usar dados demo
      </button>

      {showCredentialsModal && (
        <CredentialsModal
          onClose={() => setShowCredentialsModal(false)}
          onImported={() => { setShowCredentialsModal(false); fetchProperties() }}
        />
      )}
    </Screen>
  )
}

// ---- Componentes auxiliares ----

function Screen({ children }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: '#031A26', padding: 40, gap: 12, overflowY: 'auto' }}>
      {children}
    </div>
  )
}

function Logo() {
  return (
    <div style={{ marginBottom: 16, textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(185,145,91,0.12)',
        border: '1px solid rgba(185,145,91,0.4)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', margin: '0 auto 12px' }}>
        <Key size={24} color="#B9915B" />
      </div>
      <div style={{ fontFamily: "'PPMuseum','Georgia',serif", fontSize: 13, color: '#8A9BAA',
        letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Farol Tracking
      </div>
    </div>
  )
}

function DetectRow({ label, ok, detail }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      background: '#001F35', border: '1px solid rgba(185,145,91,0.15)', borderRadius: 8 }}>
      {ok ? <CheckCircle size={16} color="#22C55E" /> : <AlertTriangle size={16} color="#F59E0B" />}
      <div>
        <div style={{ fontSize: 13, color: '#F5F4F3', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 1 }}>{detail}</div>
      </div>
    </div>
  )
}

function TestResult({ label, ok, detail }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
      background: ok ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
      border: `1px solid ${ok ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 6 }}>
      {ok ? <CheckCircle size={14} color="#22C55E" /> : <XCircle size={14} color="#F59E0B" />}
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12, color: '#F5F4F3', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, color: '#8A9BAA', marginLeft: 8 }}>{detail}</span>
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: ok ? '#22C55E' : '#F59E0B',
        letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {ok ? 'Live' : 'Mock'}
      </span>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '9px 14px',
  background: '#001F35',
  border: '1px solid rgba(185,145,91,0.3)',
  borderRadius: 6,
  color: '#F5F4F3',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'Manrope, sans-serif',
  boxSizing: 'border-box',
}

const btnStyle = {
  width: '100%',
  maxWidth: 400,
  padding: '11px 20px',
  background: '#B9915B',
  border: 'none',
  borderRadius: 8,
  color: '#031A26',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontFamily: 'Manrope, sans-serif',
}

// ── Modal de Credenciais Portáteis ───────────────────────────────────────────
export function CredentialsModal({ onClose, onImported }) {
  const [tab, setTab] = useState('import')   // 'import' | 'export' | 'link'
  const [status, setStatus] = useState(null) // resultado da operação
  const [loading, setLoading] = useState(false)
  const [credPath, setCredPath] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [credSource, setCredSource] = useState(null)

  useEffect(() => {
    api.credentialsStatus().then(s => {
      setCredSource(s)
      if (s?.source) setCredPath(s.source)
    })
  }, [])

  // Importar via caminho no disco
  async function handleImportPath() {
    if (!credPath.trim()) return
    setLoading(true); setStatus(null)
    const r = await api.importCredentialsFromPath(credPath.trim())
    setLoading(false)
    if (r?.ok) { setStatus({ ok: true, msg: `Credenciais importadas de ${r.source}` }); onImported() }
    else setStatus({ ok: false, msg: r?.error || 'Erro ao importar' })
  }

  // Importar via upload de arquivo (drag & drop ou file input)
  async function handleFileUpload(file) {
    if (!file) return
    setLoading(true); setStatus(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const r = await api.importCredentialsInline(json)
      setLoading(false)
      if (r?.ok) { setStatus({ ok: true, msg: 'Credenciais importadas com sucesso!' }); onImported() }
      else setStatus({ ok: false, msg: r?.error || 'Arquivo inválido' })
    } catch (e) {
      setLoading(false)
      setStatus({ ok: false, msg: 'Arquivo inválido — ' + e.message })
    }
  }

  // Exportar credenciais
  async function handleExport() {
    setLoading(true); setStatus(null)
    const creds = await api.exportCredentials()
    setLoading(false)
    if (!creds) { setStatus({ ok: false, msg: 'Erro ao exportar' }); return }
    const blob = new Blob([JSON.stringify(creds, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'farol.credentials.json'; a.click()
    URL.revokeObjectURL(url)
    setStatus({ ok: true, msg: 'farol.credentials.json baixado — compartilhe com a equipe.' })
  }

  // Sync manual com arquivo mestre
  async function handleSync() {
    setLoading(true); setStatus(null)
    const r = await api.syncCredentials()
    setLoading(false)
    if (r?.ok) { setStatus({ ok: true, msg: 'Sincronizado com sucesso!' }); onImported() }
    else setStatus({ ok: false, msg: r?.error || 'Erro ao sincronizar' })
  }

  const TAB_STYLE = (active) => ({
    padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    border: active ? '1px solid rgba(185,145,91,0.5)' : '1px solid transparent',
    background: active ? 'rgba(185,145,91,0.1)' : 'transparent',
    color: active ? '#B9915B' : '#8A9BAA', cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,15,26,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: 480, background: '#001A2E',
        border: '1px solid rgba(185,145,91,0.3)',
        borderRadius: 12, padding: 28,
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={18} color="#B9915B" />
            <div>
              <div style={{ fontFamily: "'PPMuseum','Georgia',serif", fontSize: 15, color: '#B9915B', fontWeight: 600 }}>
                Credenciais Portáteis
              </div>
              <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 2 }}>
                Compartilhe a chave de configuração entre máquinas da equipe
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8A9BAA', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          <button style={TAB_STYLE(tab === 'import')} onClick={() => setTab('import')}><Upload size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Importar</button>
          <button style={TAB_STYLE(tab === 'export')} onClick={() => setTab('export')}><Download size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Exportar</button>
          <button style={TAB_STYLE(tab === 'link')} onClick={() => setTab('link')}><Link size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Arquivo mestre</button>
        </div>

        {/* Tab: Importar */}
        {tab === 'import' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: '#8A9BAA', lineHeight: 1.5 }}>
              Faça upload de um <code style={{ color: '#B9915B', background: 'rgba(185,145,91,0.1)', padding: '1px 5px', borderRadius: 3 }}>farol.credentials.json</code> para configurar esta máquina instantaneamente.
            </div>

            {/* Drag & Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files[0]) }}
              onClick={() => document.getElementById('cred-file-input').click()}
              style={{
                border: `2px dashed ${dragOver ? '#B9915B' : 'rgba(185,145,91,0.3)'}`,
                borderRadius: 8, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
                background: dragOver ? 'rgba(185,145,91,0.06)' : 'rgba(185,145,91,0.02)',
                transition: 'all 0.15s',
              }}
            >
              <Upload size={22} color="#B9915B" style={{ marginBottom: 8, opacity: 0.7 }} />
              <div style={{ fontSize: 13, color: '#F5F4F3', fontWeight: 600 }}>Arrastar arquivo aqui</div>
              <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 4 }}>ou clique para selecionar</div>
              <input id="cred-file-input" type="file" accept=".json" style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e.target.files[0])} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(185,145,91,0.15)' }} />
              <span style={{ fontSize: 11, color: '#8A9BAA' }}>ou informar caminho</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(185,145,91,0.15)' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="C:\Users\...\farol.credentials.json"
                value={credPath}
                onChange={(e) => setCredPath(e.target.value)}
                style={{ ...inputStyle, flex: 1, fontSize: 12 }}
              />
              <button
                onClick={handleImportPath}
                disabled={loading || !credPath.trim()}
                style={{ padding: '9px 16px', borderRadius: 6, border: 'none', background: '#B9915B', color: '#031A26', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', whiteSpace: 'nowrap' }}
              >
                {loading ? '...' : 'Importar'}
              </button>
            </div>
          </div>
        )}

        {/* Tab: Exportar */}
        {tab === 'export' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: '#8A9BAA', lineHeight: 1.6 }}>
              Gera um <code style={{ color: '#B9915B', background: 'rgba(185,145,91,0.1)', padding: '1px 5px', borderRadius: 3 }}>farol.credentials.json</code> com todas as credenciais configuradas nesta máquina.
              Compartilhe com a equipe ou salve em pasta de rede para usar como arquivo mestre.
            </div>
            <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, fontSize: 11, color: '#F59E0B' }}>
              ⚠ O arquivo contém tokens de API. Compartilhe apenas em canais seguros (pasta de rede interna, OneDrive corporativo).
            </div>
            <button
              onClick={handleExport}
              disabled={loading}
              style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#B9915B', color: '#031A26', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Download size={14} />
              {loading ? 'Exportando...' : 'Baixar farol.credentials.json'}
            </button>
          </div>
        )}

        {/* Tab: Arquivo mestre */}
        {tab === 'link' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: '#8A9BAA', lineHeight: 1.6 }}>
              Configure um <strong style={{ color: '#F5F4F3' }}>arquivo mestre</strong> em pasta de rede ou OneDrive. O Farol verifica automaticamente se há versão mais nova a cada inicialização e sincroniza.
            </div>

            {credSource?.source && (
              <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 700, marginBottom: 2 }}>Arquivo mestre configurado</div>
                <div style={{ fontSize: 11, color: '#8A9BAA', wordBreak: 'break-all' }}>{credSource.source}</div>
                {credSource.syncedAt && (
                  <div style={{ fontSize: 10, color: '#8A9BAA55', marginTop: 4 }}>
                    Última sync: {new Date(credSource.syncedAt).toLocaleString('pt-BR')}
                  </div>
                )}
              </div>
            )}

            <div>
              <label style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 6, display: 'block' }}>
                Caminho do arquivo mestre
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="\\servidor\ti\farol.credentials.json  ou  C:\..."
                  value={credPath}
                  onChange={(e) => setCredPath(e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                />
              </div>
              <div style={{ fontSize: 10, color: '#8A9BAA55', marginTop: 4 }}>
                Pode ser caminho local, UNC de rede (\\servidor\pasta) ou OneDrive sincronizado
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleImportPath}
                disabled={loading || !credPath.trim()}
                style={{ flex: 1, padding: '9px 14px', borderRadius: 6, border: 'none', background: '#B9915B', color: '#031A26', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}
              >
                {loading ? '...' : 'Vincular e importar agora'}
              </button>
              {credSource?.source && (
                <button
                  onClick={handleSync}
                  disabled={loading}
                  style={{ padding: '9px 14px', borderRadius: 6, border: '1px solid rgba(185,145,91,0.4)', background: 'transparent', color: '#B9915B', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw size={12} /> Sincronizar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Status */}
        {status && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 6,
            background: status.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${status.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            fontSize: 12, color: status.ok ? '#22C55E' : '#EF4444',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {status.ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
            {status.msg}
          </div>
        )}
      </div>
    </div>
  )
}
