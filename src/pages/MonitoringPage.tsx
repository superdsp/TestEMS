// Monitoring Page - Real-time telemetry data

import { useState, useEffect } from 'react'
import type { SystemSnapshot } from '../lib/types'
import { Activity, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

export default function MonitoringPage() {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null)
  const [isRunning, setIsRunning] = useState(true)
  const [history, setHistory] = useState<SystemSnapshot[]>([])

  useEffect(() => {
    if (!isRunning) return

    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/simulation`)
        const data = await res.json()
        setSnapshot(data)
        setHistory((prev) => {
          const updated = [...prev, data]
          return updated.slice(-60)
        })
      } catch (err) {
        console.error('Failed to fetch:', err)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 1000)

    return () => clearInterval(interval)
  }, [isRunning])

  const chartData = history.map((s, i) => ({
    time: i,
    pv: s.pv.powerKW,
    battery: s.battery.powerKW,
    grid: s.grid.powerKW,
    load: s.balance.totalLoadKW,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">实时监控</h1>
          <p className="text-sm text-gray-500 mt-1">实时数据和功率曲线</p>
        </div>
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors shadow-sm ${
            isRunning
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          {isRunning ? '暂停' : '启动'}
        </button>
      </div>

      {/* Real-time Values */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <TelemetryCard label="光伏功率" value={snapshot?.pv.powerKW || 0} unit="kW" color="green" />
        <TelemetryCard label="电池功率" value={snapshot?.battery.powerKW || 0} unit="kW" color="orange" />
        <TelemetryCard label="电网功率" value={snapshot?.grid.powerKW || 0} unit="kW" color="yellow" />
        <TelemetryCard label="负载功率" value={snapshot?.balance.totalLoadKW || 0} unit="kW" color="red" />
        <TelemetryCard label="PCS效率" value={(snapshot?.pcs.efficiency || 0) * 100} unit="%" color="blue" />
      </div>

      {/* Power Chart */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-800">功率曲线</h2>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="pv" stroke="#22c55e" strokeWidth={2} dot={false} name="光伏" />
              <Line type="monotone" dataKey="battery" stroke="#f97316" strokeWidth={2} dot={false} name="电池" />
              <Line type="monotone" dataKey="grid" stroke="#eab308" strokeWidth={2} dot={false} name="电网" />
              <Line type="monotone" dataKey="load" stroke="#ef4444" strokeWidth={2} dot={false} name="负载" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Telemetry Table */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-800">实时遥测数据</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-600 border-b border-gray-200">
                <th className="pb-3 font-medium">时间</th>
                <th className="pb-3 font-medium">光伏 (kW)</th>
                <th className="pb-3 font-medium">电池 (kW)</th>
                <th className="pb-3 font-medium">SOC (%)</th>
                <th className="pb-3 font-medium">电网 (kW)</th>
                <th className="pb-3 font-medium">负载 (kW)</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {history.slice(-10).reverse().map((s, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 text-gray-600">
                    {new Date(s.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2 text-green-600 font-medium">{s.pv.powerKW.toFixed(2)}</td>
                  <td className={`py-2 font-medium ${s.battery.powerKW >= 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                    {s.battery.powerKW.toFixed(2)}
                  </td>
                  <td className="py-2 text-gray-800">{s.battery.socPercent.toFixed(1)}</td>
                  <td className={`py-2 font-medium ${s.grid.powerKW >= 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {s.grid.powerKW >= 0 ? '+' : ''}{s.grid.powerKW.toFixed(2)}
                  </td>
                  <td className="py-2 text-red-600 font-medium">{s.balance.totalLoadKW.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

interface TelemetryCardProps {
  label: string
  value: number
  unit: string
  color: 'green' | 'orange' | 'yellow' | 'red' | 'blue'
}

function TelemetryCard({ label, value, unit, color }: TelemetryCardProps) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
  }

  return (
    <div className={`rounded-xl p-4 border ${colorClasses[color]}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">
        {value.toFixed(2)}
        <span className="text-sm font-normal ml-1">{unit}</span>
      </p>
    </div>
  )
}
