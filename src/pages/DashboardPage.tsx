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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            能源管理仪表盘
            {snapshot?.simTime && (
              <span className="text-green-600 ml-2">第{snapshot.simTime.day}天 {snapshot.simTime.hour}时</span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-1">实时监控光伏、储能、负载运行状态</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Energy Flow Diagram */}
        <div className="lg:col-span-2 h-full">
          <EnergyFlowDiagram snapshot={snapshot} />
        </div>

        {/* Right Column - Summary Gauges */}
        <div className="flex flex-col gap-6 h-full">
          {/* Quick Stats */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex-1">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">功率概览</h3>
            <div className="flex justify-around items-center">
              <PowerGauge
                value={snapshot?.pv.powerKW || 0}
                maxValue={10}
                label="光伏"
                color="#22c55e"
                size="md"
              />
              <PowerGauge
                value={snapshot?.balance.gridPowerKW || 0}
                maxValue={20}
                label="电网"
                color="#eab308"
                size="md"
              />
              <PowerGauge
                value={snapshot?.balance.totalLoadKW || 0}
                maxValue={20}
                label="负载"
                color="#ef4444"
                size="md"
              />
            </div>

            {/* Room Power Bars */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <h4 className="text-xs font-medium text-gray-500 mb-3">房间负载</h4>
              <div className="flex items-end justify-between gap-1">
                {snapshot?.rooms?.slice(0, 6).map((room) => {
                  const maxRoomPower = 8
                  const heightPercent = Math.min(100, (room.powerKW / maxRoomPower) * 100)
                  return (
                    <div key={room.roomId} className="flex flex-col items-center flex-1 min-w-0">
                      <div className="w-5 bg-gray-100 rounded-t relative" style={{ height: '80px' }}>
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-red-400 to-red-500 rounded-t transition-all duration-300"
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <div className="text-[10px] font-medium text-gray-700 mt-1">{room.powerKW.toFixed(1)}</div>
                      <div className="text-[10px] text-gray-500 truncate max-w-full">{room.roomName.slice(0, 4)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Battery SOC */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex-1">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">
              储能状态
              {snapshot?.battery.bms && (
                <span className="ml-2 text-xs">
                  <span className={
                    snapshot.battery.bms.balanceStatus?.some((s: boolean) => s)
                      ? 'text-blue-500'
                      : (snapshot.battery.powerKW || 0) > 0.1
                      ? 'text-green-500'
                      : (snapshot.battery.powerKW || 0) < -0.1
                      ? 'text-orange-500'
                      : 'text-gray-400'
                  }>
                    {snapshot.battery.bms.balanceStatus?.some((s: boolean) => s)
                      ? '均衡中'
                      : (snapshot.battery.powerKW || 0) > 0.1
                      ? '充电中'
                      : (snapshot.battery.powerKW || 0) < -0.1
                      ? '放电中'
                      : '待机'}
                  </span>
                </span>
              )}
            </h3>
            <SOCIndicator
              socPercent={snapshot?.battery.socPercent || 0}
              bms={snapshot?.battery.bms}
            />
          </div>
        </div>
      </div>

      {/* Power Chart */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-600 mb-4">24小时功率曲线</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="time"
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
              />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="pv" name="光伏(kW)" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="battery" name="储能(kW)" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="load" name="负载(kW)" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="grid" name="电网(kW)" stroke="#eab308" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
