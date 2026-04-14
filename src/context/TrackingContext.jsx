/**
 * TrackingContext — seleção global de container GTM, propriedade GA4 e período.
 * Todas as páginas leem daqui. O Header atualiza via setSelectedGTM / setSelectedGA4.
 * selectedDays persiste o último período escolhido enquanto o app está aberto —
 * ao navegar entre páginas, o seletor de período lembra o último valor usado.
 */

import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../services/api'

const TrackingContext = createContext(null)

export function TrackingProvider({ children }) {
  // GTM
  const [gtmContainers, setGtmContainers] = useState([])
  const [selectedGTM, setSelectedGTM] = useState('all') // 'all' | publicId

  // GA4 — seed com as properties conhecidas (sobrescritas pela API quando disponível)
  const [ga4Properties, setGa4Properties] = useState([
    { id: '521780491', name: 'G4 Educações - Global' },
    { id: '381992026', name: 'G4 Educação [PROD]' },
    { id: '506905667', name: 'G4 Forms' },
    { id: '300192855', name: 'G4 Skills - Plataforma' },
    { id: '480343979', name: 'G4 Sales Analytics' },
    { id: '525799105', name: 'g4tools - plataforma' },
  ])
  const [selectedGA4, setSelectedGA4] = useState('521780491')

  // Período global — compartilhado entre GA4, Funil, Comparação, Analytics
  // Páginas usam esse valor como initial state; ao trocar localmente, sincronizam de volta.
  const [selectedDays, setSelectedDays] = useState(30)

  const [loadingContainers, setLoadingContainers] = useState(true)

  useEffect(() => {
    // Carrega containers GTM
    api.gtmContainers().then((res) => {
      const containers = res?.containers || []
      if (containers.length > 0) setGtmContainers(containers)
      setLoadingContainers(false)
    })

    // Carrega propriedades GA4 + property ativa salva
    api.ga4Properties().then((res) => {
      if (res?.activePropertyId) setSelectedGA4(res.activePropertyId)
      if (res?.properties?.length > 0) {
        const apiProps = res.properties.map(p => ({ id: p.id, name: p.name }))
        setGa4Properties(prev => {
          const merged = [...prev]
          apiProps.forEach(p => {
            if (!merged.find(k => k.id === p.id)) merged.push(p)
          })
          return merged
        })
      }
    })
  }, [])

  // Muda GA4 e persiste
  function changeGA4(id) {
    setSelectedGA4(id)
    api.ga4SetProperty(id)
  }

  return (
    <TrackingContext.Provider value={{
      gtmContainers,
      selectedGTM,
      setSelectedGTM,
      ga4Properties,
      selectedGA4,
      setSelectedGA4: changeGA4,
      loadingContainers,
      selectedDays,
      setSelectedDays,
    }}>
      {children}
    </TrackingContext.Provider>
  )
}

export function useTracking() {
  const ctx = useContext(TrackingContext)
  if (!ctx) throw new Error('useTracking deve ser usado dentro de TrackingProvider')
  return ctx
}
