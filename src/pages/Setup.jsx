import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { CheckCircle, AlertTriangle, Key, ArrowRight, Download, Zap, Loader, XCircle, FolderOpen, ChevronDown } from 'lucide-react'

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
      <button onClick={onComplete}
        style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(185,145,91,0.2)', color: '#8A9BAA', marginTop: 0 }}>
        Pular — usar dados demo
      </button>
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
