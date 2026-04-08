import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Titlebar from './components/layout/Titlebar'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import Explorer from './pages/Explorer'
import GTMPage from './pages/GTM'
import GA4Page from './pages/GA4'
import MetaPage from './pages/Meta'
import DatabricksPage from './pages/Databricks'
import FunilPage from './pages/Funil'
import SettingsPage from './pages/Settings'
import SetupWizard from './pages/Setup'
import { TrackingProvider } from './context/TrackingContext'
import { api } from './services/api'

export default function App() {
  const [setupDone, setSetupDone] = useState(null) // null = verificando

  useEffect(() => {
    // Verificar se já está configurado
    api.health().then((health) => {
      if (health?.configured) {
        setSetupDone(true)
      } else {
        // Verificar se o usuário já fez o setup antes (localStorage)
        const skipped = localStorage.getItem('farol_setup_done')
        setSetupDone(!!skipped)
      }
    }).catch(() => {
      // Servidor ainda não subiu — verifica localStorage antes de mostrar setup
      const skipped = localStorage.getItem('farol_setup_done')
      if (skipped) {
        setSetupDone(true)
      } else {
        setTimeout(() => {
          setSetupDone(prev => prev === null ? false : prev)
        }, 2000)
      }
    })
  }, [])

  if (setupDone === null) {
    return (
      <div style={{ height: '100vh', background: '#031A26', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#8A9BAA', fontSize: 13 }}>Iniciando Farol...</div>
      </div>
    )
  }

  if (!setupDone) {
    return (
      <div style={{ height: '100vh', background: '#031A26' }}>
        <SetupWizard onComplete={() => {
          localStorage.setItem('farol_setup_done', '1')
          setSetupDone(true)
        }} />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <TrackingProvider>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            overflow: 'hidden',
            background: '#031A26',
          }}
        >
          <Titlebar />

          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <Sidebar />

            <main
              style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                background: '#031A26',
              }}
            >
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/explorer" element={<Explorer />} />
                <Route path="/gtm" element={<GTMPage />} />
                <Route path="/ga4" element={<GA4Page />} />
                <Route path="/meta" element={<MetaPage />} />
                <Route path="/databricks" element={<DatabricksPage />} />
                <Route path="/funil" element={<FunilPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </main>
          </div>
        </div>
      </TrackingProvider>
    </BrowserRouter>
  )
}
