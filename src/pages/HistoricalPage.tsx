// Historical Page - Historical data and reports

import { useState } from 'react'
import { BarChart3, Calendar, Download, FileText } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const generateDailyData = () => {
  const data = []
  for (let hour = 0; hour < 24; hour++) {
    const pvPower = hour >= 6 && hour <= 18 ? Math.sin(((hour - 6) / 12) * Math.PI) * 8 + Math.random() * 2 : 0
    const loadPower = 5 + Math.sin((hour / 24) * Math.PI * 2) * 2 + Math.random()
    data.push({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      pv: Math.max(0, pvPower),
      load: loadPower,
      grid: Math.random() * 3,
    })
  }
  return data
}

const roomData = [
  { name: 'Room 1', energy: 125.5 },
  { name: 'Room 2', energy: 98.3 },
  { name: 'Room 3', energy: 156.2 },
  { name: 'Room 4', energy: 87.6 },
  { name: 'Room 5', energy: 112.4 },
  { name: 'Room 6', energy: 94.8 },
]

export default function HistoricalPage() {
  const [dateRange, setDateRange] = useState('today')
  const dailyData = generateDailyData()

  const totalPV = dailyData.reduce((sum, d) => sum + d.pv, 0).toFixed(1)
  const totalLoad = dailyData.reduce((sum, d) => sum + d.load, 0).toFixed(1)
  const totalGrid = dailyData.reduce((sum, d) => sum + d.grid, 0).toFixed(1)
  const selfSufficiency = ((parseFloat(totalPV) / parseFloat(totalLoad)) * 100).toFixed(1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">历史数据</h1>
          <p className="text-sm text-gray-500 mt-1">能量统计和报表</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 shadow-sm"
          >
            <option value="today">今天</option>
            <option value="yesterday">昨天</option>
            <option value="week">本周</option>
            <option value="month">本月</option>
          </select>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2 shadow-sm">
            <Download className="w-4 h-4" />
            导出数据
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">光伏发电量</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {totalPV} <span className="text-sm font-normal text-gray-500">kWh</span>
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">总用电量</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {totalLoad} <span className="text-sm font-normal text-gray-500">kWh</span>
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">电网用电量</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">
            {totalGrid} <span className="text-sm font-normal text-gray-500">kWh</span>
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">自发自用率</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {selfSufficiency} <span className="text-sm font-normal text-gray-500">%</span>
          </p>
        </div>
      </div>

      {/* Daily Power Profile */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-800">24小时功率曲线</h2>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hour" stroke="#6b7280" fontSize={10} interval={3} />
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
              <Line type="monotone" dataKey="load" stroke="#ef4444" strokeWidth={2} dot={false} name="负载" />
              <Line type="monotone" dataKey="grid" stroke="#eab308" strokeWidth={2} dot={false} name="电网" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Room Energy Ranking */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-800">房间用电排名</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roomData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#6b7280" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={12} width={60} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="energy" fill="#3b82f6" radius={[0, 4, 4, 0]} name="用电量 (kWh)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Report Generation */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-800">报表生成</h2>
          </div>
          <div className="space-y-4">
            <button className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">日报</p>
                  <p className="text-sm text-gray-500">每日能量统计报表</p>
                </div>
                <FileText className="w-5 h-5 text-gray-400" />
              </div>
            </button>
            <button className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">周报</p>
                  <p className="text-sm text-gray-500">每周能量统计报表</p>
                </div>
                <FileText className="w-5 h-5 text-gray-400" />
              </div>
            </button>
            <button className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">月报</p>
                  <p className="text-sm text-gray-500">每月能量统计报表</p>
                </div>
                <FileText className="w-5 h-5 text-gray-400" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
