import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import DashboardPage from './pages/DashboardPage'
import LoadManagementPage from './pages/LoadManagementPage'
import MonitoringPage from './pages/MonitoringPage'
import AlarmsPage from './pages/AlarmsPage'
import HistoricalPage from './pages/HistoricalPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="loads" element={<LoadManagementPage />} />
          <Route path="monitoring" element={<MonitoringPage />} />
          <Route path="alarms" element={<AlarmsPage />} />
          <Route path="historical" element={<HistoricalPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App