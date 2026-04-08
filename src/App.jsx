import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Titlebar from './components/layout/Titlebar'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import Explorer from './pages/Explorer'
import GTMPage from './pages/GTM'
import GA4Page from './pages/GA4'
import MetaPage from './pages/Meta'
import SettingsPage from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
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
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
