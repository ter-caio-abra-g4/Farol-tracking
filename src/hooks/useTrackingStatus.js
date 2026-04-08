import { useState, useCallback, useEffect } from 'react'

/**
 * Hook principal — agrega status GTM, GA4 e Meta
 * Quando conectado às APIs reais, chama o bridge Python
 * ou serviços Node diretamente via axios.
 */
export function useTrackingStatus() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Tentar bridge Electron/Python primeiro
      if (typeof window !== 'undefined' && window.rais) {
        const result = await window.rais.pythonCall('status.py', [])
        setData(result)
      } else {
        // Fallback: dados mock para desenvolvimento
        await new Promise((r) => setTimeout(r, 800))
        setData(getMockData())
      }
      setLastUpdated(new Date().toISOString())
    } catch (err) {
      console.error('[RAIS] Erro ao buscar status:', err)
      setData(getMockData())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Auto-refresh a cada 5 minutos
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  return { data, loading, lastUpdated, refresh: fetchData }
}

function getMockData() {
  return {
    gtm: {
      status: 'warn',
      metrics: [
        { label: 'Tags ativas', value: '24', delta: '+2', status: 'ok' },
        { label: 'Triggers OK', value: '19/24', delta: undefined, status: 'warn' },
      ],
    },
    ga4: {
      status: 'ok',
      metrics: [
        { label: 'Eventos/dia', value: '142k', delta: '+8%' },
        { label: 'Propriedades', value: '3', delta: undefined },
      ],
    },
    meta: {
      status: 'ok',
      metrics: [
        { label: 'Match rate', value: '87%', delta: '+3%', status: 'ok' },
        { label: 'Eventos 24h', value: '8.4k', delta: '+12%' },
      ],
    },
    alerts: [
      {
        level: 'warn',
        title: '5 tags sem disparos nas últimas 24h',
        description: 'GTM — verifique triggers de scroll e video_progress',
      },
    ],
    eventsTimeline: [
      { hora: '00h', eventos: 1200 },
      { hora: '04h', eventos: 800 },
      { hora: '08h', eventos: 3400 },
      { hora: '12h', eventos: 5200 },
      { hora: '16h', eventos: 4800 },
      { hora: '20h', eventos: 3100 },
      { hora: '23h', eventos: 1900 },
    ],
    integrityChecks: [
      { label: 'GTM container publicado', status: 'ok' },
      { label: 'GA4 recebendo eventos', status: 'ok' },
      { label: 'Meta Pixel disparando', status: 'ok' },
      { label: 'Conversions API ativa', status: 'ok' },
      { label: 'purchase event presente', status: 'warn' },
      { label: 'lead event presente', status: 'ok' },
    ],
  }
}
