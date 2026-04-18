// Load Management Page - Room circuit breaker control with power curves

import { useState, useEffect } from 'react'
import type { SystemSnapshot, RoomLoadSnapshot } from '../lib/types'
import { Building2, Power, Zap, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

export default function LoadManagementPage() {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null)
  const [isRunning, setIsRunning] = useState(true)
  const [roomHistory, setRoomHistory] = useState<Record<string, number[]>>({})
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)

  useEffect(() => {
    if (!isRunning) return

    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/simulation`)
        const data = await res.json()
        setSnapshot(data)
        // Record room history for charts
        const newHistory: Record<string, number[]> = {}
        data.rooms.forEach((room: RoomLoadSnapshot) => {
          const existing = roomHistory[room.roomId] || []
          const updated = [...existing, room.powerKW].slice(-60)
          newHistory[room.roomId] = updated
        })
        setRoomHistory(newHistory)
      } catch (err) {
        console.error('Failed to fetch:', err)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 1000)

    return () => clearInterval(interval)
  }, [isRunning, roomHistory])

  const handleToggleBreaker = async (roomId: string, currentStatus: 'closed' | 'open') => {
    const newStatus = currentStatus === 'closed' ? 'open' : 'closed'
    try {
      await fetch(`${API_BASE}/api/breaker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, status: newStatus }),
      })
      // Refetch data
      const res = await fetch(`${API_BASE}/api/simulation`)
      const data = await res.json()
      setSnapshot(data)
    } catch (err) {
      console.error('Failed to toggle breaker:', err)
    }
  }

  const handleOpenAll = async () => {
    try {
      await fetch(`${API_BASE}/api/breaker/all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'open' }),
      })
      const res = await fetch(`${API_BASE}/api/simulation`)
      const data = await res.json()
      setSnapshot(data)
    } catch (err) {
      console.error('Failed to open all breakers:', err)
    }
  }

  const handleCloseAll = async () => {
    try {
      await fetch(`${API_BASE}/api/breaker/all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' }),
      })
      const res = await fetch(`${API_BASE}/api/simulation`)
      const data = await res.json()
      setSnapshot(data)
    } catch (err) {
      console.error('Failed to close all breakers:', err)
    }
  }

  const sortedRooms = [...(snapshot?.rooms || [])].sort((a, b) => b.powerKW - a.powerKW)

  // Get chart data for selected room
  const getChartData = (roomId: string) => {
    const history = roomHistory[roomId] || []
    return history.map((power, i) => ({
      time: i,
      power: power,
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">负载管理</h1>
          <p className="text-sm text-gray-500 mt-1">监控和控制6个房间的智能断路器</p>
        </div>

        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors shadow-sm ${
            isRunning
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          {isRunning ? '暂停仿真' : '启动仿真'}
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">房间总数</p>
              <p className="text-xl font-bold text-gray-800">6</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Power className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">在线断路器</p>
              <p className="text-xl font-bold text-gray-800">
                {snapshot?.rooms.filter((r) => r.breakerStatus === 'closed').length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">总负载功率</p>
              <p className="text-xl font-bold text-gray-800">
                {(snapshot?.balance.totalLoadKW || 0).toFixed(2)} <span className="text-sm font-normal text-gray-500">kW</span>
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">今日总用电</p>
              <p className="text-xl font-bold text-gray-800">
                {(
                  (snapshot?.rooms.reduce((sum, r) => sum + r.energyKWh, 0) || 0)
                ).toFixed(2)}{' '}
                <span className="text-sm font-normal text-gray-500">kWh</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Controls */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-700">批量控制</h3>
          <div className="flex gap-2">
            <button
              onClick={handleCloseAll}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm shadow-sm"
            >
              全部闭合
            </button>
            <button
              onClick={handleOpenAll}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm shadow-sm"
            >
              全部断开
            </button>
          </div>
        </div>
      </div>

      {/* Room Cards + Selected Room Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Room Cards */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedRooms.map((room, index) => (
              <RoomCard
                key={room.roomId}
                room={room}
                rank={index + 1}
                isSelected={selectedRoom === room.roomId}
                onToggle={() => handleToggleBreaker(room.roomId, room.breakerStatus)}
                onSelect={() => setSelectedRoom(selectedRoom === room.roomId ? null : room.roomId)}
              />
            ))}
          </div>
        </div>

        {/* Selected Room Chart */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 h-full">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-800">房间用电曲线</h3>
            </div>
            {selectedRoom ? (
              <>
                <p className="text-sm text-gray-500 mb-2">
                  {snapshot?.rooms.find((r) => r.roomId === selectedRoom)?.roomName}
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getChartData(selectedRoom)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="time" stroke="#6b7280" fontSize={10} hide />
                      <YAxis stroke="#6b7280" fontSize={10} domain={[0, 'auto']} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                        }}
                      />
                      <Line type="monotone" dataKey="power" stroke="#3b82f6" strokeWidth={2} dot={false} name="功率 (kW)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500">当前功率</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {snapshot?.rooms.find((r) => r.roomId === selectedRoom)?.powerKW.toFixed(2) || '0.00'} kW
                  </p>
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400">
                <p className="text-sm">点击房间卡片查看用电曲线</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface RoomCardProps {
  room: RoomLoadSnapshot
  rank: number
  isSelected: boolean
  onToggle: () => void
  onSelect: () => void
}

function RoomCard({ room, rank, isSelected, onToggle, onSelect }: RoomCardProps) {
  const isOnline = room.breakerStatus === 'closed'

  return (
    <div
      className={`bg-white rounded-xl p-5 shadow-sm border-2 transition-all hover:shadow-md cursor-pointer ${
        isSelected ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isOnline ? 'bg-blue-100' : 'bg-gray-100'
            }`}
          >
            <Building2 className={`w-5 h-5 ${isOnline ? 'text-blue-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{room.roomName}</h3>
            <p className="text-xs text-gray-500">
              {isOnline ? (
                <span className="text-green-600">在线</span>
              ) : (
                <span className="text-gray-400">离线</span>
              )}
            </p>
          </div>
        </div>

        {rank <= 3 && (
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              rank === 1 ? 'bg-yellow-400 text-yellow-900' : rank === 2 ? 'bg-gray-300 text-gray-700' : 'bg-orange-400 text-orange-900'
            }`}
          >
            {rank}
          </div>
        )}
      </div>

      {/* Power Display */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${isOnline ? 'text-gray-800' : 'text-gray-400'}`}>
            {isOnline ? room.powerKW.toFixed(2) : '0.00'}
          </span>
          <span className="text-sm text-gray-500">kW</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          今日用电: {room.energyKWh.toFixed(2)} kWh
        </p>
      </div>

      {/* Power Bar */}
      <div className="mb-4">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isOnline ? 'bg-blue-500' : 'bg-gray-300'
            }`}
            style={{ width: isOnline ? `${Math.min(100, (room.powerKW / 5) * 100)}%` : '0%' }}
          />
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className={`w-full py-2 rounded-lg font-medium transition-colors ${
          isOnline
            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            : 'bg-green-50 text-green-700 hover:bg-green-100'
        }`}
      >
        {isOnline ? '断开' : '闭合'}
      </button>
    </div>
  )
}
