// Main App with routing
import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout'
import { 
  DashboardPage, 
  AgentsPage, 
  ProvidersPage,
  CapturesPage,
  CostPage,
  StreamPage,
  SettingsPage,
} from './pages'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="providers" element={<ProvidersPage />} />
        <Route path="captures" element={<CapturesPage />} />
        <Route path="cost" element={<CostPage />} />
        <Route path="stream" element={<StreamPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
