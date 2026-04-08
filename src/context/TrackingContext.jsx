/**
 * TrackingContext — seleção global de container GTM e propriedade GA4.
 * Todas as páginas leem daqui. O Header atualiza via setSelectedGTM / setSelectedGA4.
 */

import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../services/api'

const TrackingContext = createContext(null)

export function TrackingProvider({ children }) {
  // GTM
  const [gtmContainers, setGtmContainers] = useState([])
  const [selectedGTM, setSelectedGTM] = useState('all') // 'all' | publicId

  // GA4
  const [ga4Properties, setGa4Properties] = useState([
    { id: '521780491', name: 'G4 Educacao - Principal' },
  ])
  const [selectedGA4, setSelectedGA4] = useState('521780491')

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
