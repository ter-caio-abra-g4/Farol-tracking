import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { CheckCircle, AlertTriangle, Key, ArrowRight, Download, Zap, Loader, XCircle } from 'lucide-react'

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState('detect') // detect | manual | done
  const [detection, setDetection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [metaToken, setMetaToken] = useState('')
  const [ga4PropId, setGa4PropId] = useState('')
  const [saving, setSaving] = useState(false)
  const [testResults, setTestResults] = useState(null) // null | { gtm, ga4, meta }
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    api.detectG4OS().then((result) => {
      setDetection(result)
      setLoading(false)
      if (result?.g4osDetected) {
        setStep('review')
      } else {
        setStep('manual')
      }
    })
  }, [])

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
            ? `${ga4Res?.rows?.length ?? 0} linhas de eventos (7 dias)`
            : 'Sem acesso — adicione o service account no GA4 Admin ou verifique permissões',
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

  async function handleManualSave() {
    setSaving(true)
    await api.saveConfig({
      meta: { access_token: metaToken, pixel_id: '702432142505333' },
      ga4: { property_id: ga4PropId },
    })
    setSaving(false)
    onComplete()
  }

  if (loading) {
    return (
      <Screen>
        <div style={{ color: '#8A9BAA', fontSize: 14 }}>Detectando configurações...</div>
      </Screen>
    )
  }

  if (step === 'review') {
    return (
      <Screen>
        <Logo />
        <h2 style={{ fontFamily: "'PPMuseum','Georgia',serif", fontSize: 22, color: '#B9915B', marginBottom: 8 }}>
          G4 OS detectado
        </h2>
        <p style={{ color: '#8A9BAA', fontSize: 13, marginBottom: 28, textAlign: 'center', maxWidth: 420 }}>
          Encontramos suas credenciais do G4 OS. O Farol vai usar as mesmas conexões sem alterar nenhum arquivo existente.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 400, marginBottom: 20 }}>
          <DetectRow
            label="GA4 Service Account"
            ok={!!detection?.ga4ServiceAccount}
            detail={detection?.ga4ServiceAccount ? 'service-account.json encontrado' : 'Não encontrado'}
          />
          <DetectRow
            label="GTM OAuth"
            ok={!!detection?.gtmReady}
            detail={detection?.gtmReady ? 'Configurado via G4 OS' : 'Não configurado'}
          />
          <DetectRow
            label="Meta Access Token"
            ok={false}
            detail="Precisa ser configurado manualmente"
          />
        </div>

        {/* Botão Testar Conexão */}
        <button
          onClick={handleTestConnections}
          disabled={testing}
          style={{
            ...btnStyle,
            background: 'transparent',
            border: '1px solid rgba(185,145,91,0.5)',
            color: '#B9915B',
            marginBottom: 4,
          }}
        >
          {testing
            ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Testando...</>
            : <><Zap size={15} /> Testar conexão</>
          }
        </button>

        {/* Resultados do teste */}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 400 }}>
          <label style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 2 }}>
            Meta Access Token (necessário para dados de Pixel)
          </label>
          <input
            type="password"
            placeholder="EAAxxxxxxx..."
            value={metaToken}
            onChange={(e) => setMetaToken(e.target.value)}
            style={inputStyle}
          />

          <label style={{ fontSize: 12, color: '#8A9BAA', marginTop: 8, marginBottom: 2 }}>
            GA4 Property ID (opcional — usado nos relatórios)
          </label>
          <input
            type="text"
            placeholder="123456789"
            value={ga4PropId}
            onChange={(e) => setGa4PropId(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button
          onClick={async () => {
            setSaving(true)
            await api.saveConfig({
              meta: { access_token: metaToken, pixel_id: '702432142505333' },
              ga4: { property_id: ga4PropId },
            })
            await api.detectG4OS()
            setSaving(false)
            onComplete()
          }}
          disabled={saving}
          style={btnStyle}
        >
          {saving ? 'Configurando...' : (
            <>
              <Download size={15} /> Importar e continuar
            </>
          )}
        </button>

        <button
          onClick={onComplete}
          style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(185,145,91,0.3)', color: '#8A9BAA', marginTop: 0 }}
        >
          Pular por agora — usar dados demo
        </button>
      </Screen>
    )
  }

  // Manual setup
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
        <div>
          <label style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 6, display: 'block' }}>
            Meta Access Token
          </label>
          <input
            type="password"
            placeholder="EAAxxxxxxx..."
            value={metaToken}
            onChange={(e) => setMetaToken(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 6, display: 'block' }}>
            GA4 Property ID
          </label>
          <input
            type="text"
            placeholder="123456789"
            value={ga4PropId}
            onChange={(e) => setGa4PropId(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: '#8A9BAA', marginBottom: 6, display: 'block' }}>
            Google Service Account (caminho do arquivo)
          </label>
          <input
            type="text"
            placeholder="C:\caminho\para\service-account.json"
            style={inputStyle}
            onChange={(e) => setGa4PropId((prev) => prev)} // handled via api.saveConfig
          />
          <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 4 }}>
            Necessário para GA4 e GTM. Deve ter permissões de leitura Analytics e TagManager.
          </div>
        </div>
      </div>

      {/* Botão Testar Conexão no modo manual */}
      <button
        onClick={handleTestConnections}
        disabled={testing}
        style={{
          ...btnStyle,
          background: 'transparent',
          border: '1px solid rgba(185,145,91,0.5)',
          color: '#B9915B',
          marginBottom: 4,
        }}
      >
        {testing
          ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Testando...</>
          : <><Zap size={15} /> Testar conexão</>
        }
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

      <button onClick={handleManualSave} disabled={saving} style={btnStyle}>
        {saving ? 'Salvando...' : <><ArrowRight size={15} /> Salvar e abrir Farol</>}
      </button>

      <button
        onClick={onComplete}
        style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(185,145,91,0.2)', color: '#8A9BAA', marginTop: 0 }}
      >
        Pular — usar dados demo
      </button>
    </Screen>
  )
}

function Screen({ children }) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#031A26',
        padding: 40,
        gap: 12,
        overflowY: 'auto',
      }}
    >
      {children}
    </div>
  )
}

function Logo() {
  return (
    <div style={{ marginBottom: 16, textAlign: 'center' }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: 'rgba(185,145,91,0.12)',
          border: '1px solid rgba(185,145,91,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px',
        }}
      >
        <Key size={24} color="#B9915B" />
      </div>
      <div
        style={{
          fontFamily: "'PPMuseum','Georgia',serif",
          fontSize: 13,
          color: '#8A9BAA',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        Farol Tracking
      </div>
    </div>
  )
}

function DetectRow({ label, ok, detail }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: '#001F35',
        border: '1px solid rgba(185,145,91,0.15)',
        borderRadius: 8,
      }}
    >
      {ok
        ? <CheckCircle size={16} color="#22C55E" />
        : <AlertTriangle size={16} color="#F59E0B" />
      }
      <div>
        <div style={{ fontSize: 13, color: '#F5F4F3', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: '#8A9BAA', marginTop: 1 }}>{detail}</div>
      </div>
    </div>
  )
}

function TestResult({ label, ok, detail }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: ok ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
        border: `1px solid ${ok ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
        borderRadius: 6,
      }}
    >
      {ok
        ? <CheckCircle size={14} color="#22C55E" />
        : <XCircle size={14} color="#F59E0B" />
      }
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12, color: '#F5F4F3', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, color: '#8A9BAA', marginLeft: 8 }}>{detail}</span>
      </div>
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        color: ok ? '#22C55E' : '#F59E0B',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
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
