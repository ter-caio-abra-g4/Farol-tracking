import { Component } from 'react'
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
import ComparacaoPage from './pages/Comparacao'
import AnalyticsPage from './pages/Analytics'
import SEOPage from './pages/SEO'
import PaidPage from './pages/Paid'
import LiveMonitorPage from './pages/LiveMonitor'
import LiveGA4Page from './pages/LiveGA4'
import LiveMetaPage from './pages/LiveMeta'
import LiveDatabricksPage from './pages/LiveDatabricks'
import SettingsPage from './pages/Settings'
import AnomalyDetectionPage from './pages/AnomalyDetection'
import ClosingCohortPage from './pages/ClosingCohort'
import EventsExplorerPage from './pages/EventsExplorer'
import { TrackingProvider } from './context/TrackingContext'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: '#EF4444', fontFamily: 'monospace', fontSize: 13, background: '#050E17', height: '100%', overflow: 'auto' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Erro de render:</div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{String(this.state.error)}{'\n\n'}{this.state.error?.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <TrackingProvider>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#050E17' }}>
          <Titlebar />
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <Sidebar />
            <main style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#050E17' }}>
              <ErrorBoundary>
                <Routes>
                  <Route path="/"                element={<Dashboard />} />
                  <Route path="/explorer"        element={<Explorer />} />
                  <Route path="/gtm"             element={<GTMPage />} />
                  <Route path="/ga4"             element={<GA4Page />} />
                  <Route path="/meta"            element={<MetaPage />} />
                  <Route path="/databricks"      element={<DatabricksPage />} />
                  <Route path="/funil"           element={<FunilPage />} />
                  <Route path="/comparacao"      element={<ComparacaoPage />} />
                  <Route path="/analytics"       element={<AnalyticsPage />} />
                  <Route path="/seo"             element={<SEOPage />} />
                  <Route path="/paid"            element={<PaidPage />} />
                  <Route path="/live"            element={<LiveMonitorPage />} />
                  <Route path="/live/ga4"        element={<LiveGA4Page />} />
                  <Route path="/live/meta"       element={<LiveMetaPage />} />
                  <Route path="/live/databricks" element={<LiveDatabricksPage />} />
                  <Route path="/settings"        element={<SettingsPage />} />
                  <Route path="/anomaly"         element={<AnomalyDetectionPage />} />
                  <Route path="/cohort"          element={<ClosingCohortPage />} />
                  <Route path="/events-explorer" element={<EventsExplorerPage />} />
                </Routes>
              </ErrorBoundary>
            </main>
          </div>
        </div>
      </TrackingProvider>
    </BrowserRouter>
  )
}
