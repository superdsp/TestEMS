// Dashboard Page - Main dashboard view with energy flow diagram

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { SystemSnapshot } from '../lib/types'
import EnergyFlowDiagram from '../components/dashboard/EnergyFlowDiagram'
import PowerGauge from '../components/dashboard/PowerGauge'
import SOCIndicator from '../components/dashboard/SOCIndicator'

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

interface DataPoint {
  time: string
  timestamp: number
  pv: number
  battery: number
  load: number
  grid: number
}

export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null)
  const [chartData, setChartData] = useState<DataPoint[]>([])
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set())
  const lastFetchRef = { current: 0 }

  useEffect(() => {
    // Fetch 24-hour history from database
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/history?range=day`)
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          const historyPoints: DataPoint[] = data.map((d: any) => ({
            time: new Date(d.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            timestamp: d.timestamp,
            pv: d.pv || 0,
            battery: d.battery || 0,
            load: d.load || 0,
            grid: d.grid || 0,
          }))
          setChartData(historyPoints)
        }
      } catch (err) {
        console.error('Failed to fetch history:', err)
      }
    }

    fetchHistory()

    // Fetch realtime data every second
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/simulation`)
        const data = await res.json()
        setSnapshot(data)

        // Only add if enough time has passed (1 simulated hour = 1 real minute)
        const now = Date.now()
        if (now - lastFetchRef.current >= 60000) {
          lastFetchRef.current = now
          const timeStr = data.simTime?.hourStr?.substring(0, 5) || `${String(data.simTime?.hour || 0).padStart(2,'0')}:00`
          const newPoint: DataPoint = {
            time: timeStr,
            timestamp: now,
            pv: data.pv.powerKW,
            battery: data.battery.powerKW,
            load: data.balance.totalLoadKW,
            grid: data.grid.powerKW,
          }
          setChartData(prev => {
            const updated = [...prev, newPoint]
            // Keep only 1440 points (24 hours at 1/min)
            return updated.slice(-1440)
          })
        }
      } catch (err) {
        console.error('Failed to fetch simulation data:', err)
      }
    }

    const interval = setInterval(fetchData, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="h-screen overflow-hidden p-2 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-800">
          能源管理仪表盘
          {snapshot?.simTime && (
            <span className="text-green-600 ml-2">第{snapshot.simTime.day}天 {snapshot.simTime.hour}时</span>
          )}
        </h1>
      </div>

      {/* Top Half - Energy Flow + Right Panel */}
      <div className="flex gap-2">
        {/* Left 2/3 - Energy Flow Diagram */}
        <div className="w-[66%] max-h-[50vh] overflow-hidden">
          <EnergyFlowDiagram snapshot={snapshot} />
        </div>

        {/* Right 1/3 - Top: Power+Room merged, Bottom: Battery */}
        <div className="w-[34%] max-h-[50vh] flex flex-col gap-2 overflow-hidden">
          <div className="flex-1 bg-white rounded-xl p-3 shadow-sm border border-gray-200 overflow-hidden">
            <h3 className="text-xs font-semibold text-gray-600 mb-2">功率概览</h3>
            <div className="flex justify-around items-center" style={{ marginTop: '8%' }}>
              <PowerGauge value={snapshot?.pv.powerKW || 0} maxValue={10} label="光伏" color="#22c55e" size="lg" />
              <PowerGauge value={snapshot?.balance.gridPowerKW || 0} maxValue={20} label="电网" color="#eab308" size="lg" />
              <PowerGauge value={snapshot?.balance.totalLoadKW || 0} maxValue={20} label="负载" color="#ef4444" size="lg" />
            </div>
          </div>

          <div className="flex-1 bg-white rounded-xl p-3 shadow-sm border border-gray-200 overflow-hidden">
            <h3 className="text-xs font-semibold text-gray-600 mb-2">
              储能 {(snapshot?.battery.powerKW || 0) > 0.1 ? '充电' : (snapshot?.battery.powerKW || 0) < -0.1 ? '放电' : '待机'}
            </h3>
            <div className="h-[calc(100%-24px)]">
              <SOCIndicator socPercent={snapshot?.battery.socPercent || 0} bms={snapshot?.battery.bms} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Half - Power Chart (full width) */}
      <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-200 mt-2" style={{ height: 'calc(40vh)' }}>
        <h3 className="text-xs font-semibold text-gray-600 mb-1">24小时功率曲线</h3>
        <div className="h-[calc(100%-20px)]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" stroke="#6b7280" fontSize={9} interval="preserveStartEnd" minTickGap={30} />
              <YAxis stroke="#6b7280" fontSize={9} width={25} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: 10 }} />
              <Legend wrapperStyle={{ fontSize: 9 }} onClick={(e) => {
                const dataKey = e.dataKey as string
                setHiddenLines(prev => {
                  const next = new Set(prev)
                  if (next.has(dataKey)) next.delete(dataKey)
                  else next.add(dataKey)
                  return next
                })
              }} />
              <Line type="monotone" dataKey="pv" name="光伏" stroke="#22c55e" strokeWidth={1.5} dot={false} hide={hiddenLines.has('pv')} />
              <Line type="monotone" dataKey="battery" name="储能" stroke="#f59e0b" strokeWidth={1.5} dot={false} hide={hiddenLines.has('battery')} />
              <Line type="monotone" dataKey="load" name="负载" stroke="#ef4444" strokeWidth={1.5} dot={false} hide={hiddenLines.has('load')} />
              <Line type="monotone" dataKey="grid" name="电网" stroke="#eab308" strokeWidth={1.5} dot={false} hide={hiddenLines.has('grid')} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
