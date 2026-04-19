// Historical Page - Historical data with zoom support

import { useState, useEffect, useCallback } from 'react'
import { BarChart3, ZoomIn, RotateCcw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Brush, ReferenceArea } from 'recharts'

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

interface DataPoint {
  timestamp: number
  time: string
  pv: number
  battery: number
  load: number
  grid: number
}

const RANGE_OPTIONS = [
  { value: 'day', label: '今天', aggregation: '10min' },
  { value: 'week', label: '本周', aggregation: '30min' },
  { value: 'month', label: '本月', aggregation: '2hour' },
  { value: 'year', label: '本年', aggregation: 'day' },
  { value: '3years', label: '3年', aggregation: 'week' },
]

export default function HistoricalPage() {
  const [data, setData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [range, setRange] = useState('day')
  const [leftRef, setLeftRef] = useState<number | null>(null)
  const [rightRef, setRightRef] = useState<number | null>(null)
  const [refAreaLeft, setRefAreaLeft] = useState<string>('')
  const [refAreaRight, setRefAreaRight] = useState<string>('')
  const [zoomMode, setZoomMode] = useState(false)
  const [zoomData, setZoomData] = useState<DataPoint[]>([])
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/history?range=${range}`)
      const rawData = await res.json()
      if (Array.isArray(rawData) && rawData.length > 0) {
        const points: DataPoint[] = rawData.map((d: any) => ({
          timestamp: d.timestamp,
          time: new Date(d.timestamp).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          }),
          pv: parseFloat(d.pv) || 0,
          battery: parseFloat(d.battery) || 0,
          load: parseFloat(d.load) || 0,
          grid: parseFloat(d.grid) || 0,
        }))
        setData(points)
        setZoomData(points)
      } else {
        setData([])
        setZoomData([])
      }
    } catch (err) {
      console.error('Failed to fetch history:', err)
    }
    setLoading(false)
  }, [range])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Calculate totals
  const totals = data.reduce((acc, d) => ({
    pv: acc.pv + d.pv,
    load: acc.load + d.load,
    grid: acc.grid + d.grid,
  }), { pv: 0, load: 0, grid: 0 })

  const selfSufficiency = totals.load > 0 ? ((totals.pv / totals.load) * 100).toFixed(1) : '0.0'

  // Zoom handlers
  const handleMouseDown = (e: any) => {
    if (e && e.activeLabel && zoomMode) {
      setRefAreaLeft(e.activeLabel)
    }
  }

  const handleMouseMove = (e: any) => {
    if (refAreaLeft && e && e.activeLabel && zoomMode) {
      setRefAreaRight(e.activeLabel)
    }
  }

  const handleMouseUp = () => {
    if (refAreaLeft && refAreaRight) {
      const leftIndex = data.findIndex(d => d.time === refAreaLeft)
      const rightIndex = data.findIndex(d => d.time === refAreaRight)
      if (leftIndex !== -1 && rightIndex !== -1 && leftIndex < rightIndex) {
        setZoomData(data.slice(leftIndex, rightIndex + 1))
        setLeftRef(leftIndex)
        setRightRef(rightIndex)
      }
    }
    setRefAreaLeft('')
    setRefAreaRight('')
  }

  const handleZoomOut = () => {
    setZoomData(data)
    setLeftRef(null)
    setRightRef(null)
  }

  const displayData = zoomMode && zoomData.length > 0 ? zoomData : data

  return (
    <div className="h-screen overflow-hidden p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-800">历史数据</h1>
          {/* Time Range */}
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 shadow-sm"
          >
            {RANGE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className="text-xs text-gray-500">点击图例切换曲线</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            <button
              onClick={() => setZoomMode(!zoomMode)}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
                zoomMode ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <ZoomIn className="w-3 h-3" />
              {zoomMode ? '退出' : '缩放'}
            </button>
            <button
              onClick={handleZoomOut}
              className="px-2 py-1 rounded text-xs flex items-center gap-1 hover:bg-gray-100 text-gray-700 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              重置
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-2 mb-2 flex-shrink-0">
        <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-200">
          <p className="text-xs text-gray-500">光伏</p>
          <p className="text-lg font-bold text-green-600">
            {totals.pv.toFixed(1)} <span className="text-xs font-normal text-gray-500">kWh</span>
          </p>
        </div>
        <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-200">
          <p className="text-xs text-gray-500">负载</p>
          <p className="text-lg font-bold text-red-600">
            {totals.load.toFixed(1)} <span className="text-xs font-normal text-gray-500">kWh</span>
          </p>
        </div>
        <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-200">
          <p className="text-xs text-gray-500">电网</p>
          <p className="text-lg font-bold text-yellow-600">
            {totals.grid.toFixed(1)} <span className="text-xs font-normal text-gray-500">kWh</span>
          </p>
        </div>
        <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-200">
          <p className="text-xs text-gray-500">自用率</p>
          <p className="text-lg font-bold text-blue-600">
            {selfSufficiency} <span className="text-xs font-normal text-gray-500">%</span>
          </p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-800">功率曲线 {zoomMode && zoomData.length > 0 && `(${zoomData.length}点)`}</h2>
          </div>
          {zoomMode && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              拖拽放大
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            加载中...
          </div>
        ) : displayData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            暂无数据
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={displayData}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="time"
                  stroke="#6b7280"
                  fontSize={10}
                  interval="preserveStartEnd"
                  minTickGap={50}
                />
                <YAxis stroke="#6b7280" fontSize={12} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(label) => `时间: ${label}`}
                />
                <Legend onClick={(e) => {
                  const dataKey = e.dataKey as string
                  setHiddenLines(prev => {
                    const next = new Set(prev)
                    if (next.has(dataKey)) next.delete(dataKey)
                    else next.add(dataKey)
                    return next
                  })
                }} />
                <Line type="monotone" dataKey="pv" stroke="#22c55e" strokeWidth={2} dot={false} name="光伏 (kW)" hide={hiddenLines.has('pv')} />
                <Line type="monotone" dataKey="battery" stroke="#f59e0b" strokeWidth={2} dot={false} name="储能 (kW)" hide={hiddenLines.has('battery')} />
                <Line type="monotone" dataKey="load" stroke="#ef4444" strokeWidth={2} dot={false} name="负载 (kW)" hide={hiddenLines.has('load')} />
                <Line type="monotone" dataKey="grid" stroke="#eab308" strokeWidth={2} dot={false} name="电网 (kW)" hide={hiddenLines.has('grid')} />
                {refAreaLeft && refAreaRight && (
                  <ReferenceArea
                    x1={refAreaLeft}
                    x2={refAreaRight}
                    strokeOpacity={0.3}
                    fill="#3b82f6"
                    fillOpacity={0.2}
                  />
                )}
                <Brush
                  dataKey="time"
                  height={30}
                  stroke="#3b82f6"
                  fill="#f8fafc"
                  startIndex={leftRef || 0}
                  endIndex={rightRef || displayData.length - 1}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Data Info */}
        <div className="flex items-center justify-between text-sm text-gray-500 mt-2 flex-shrink-0">
          <span>共 {data.length} 个数据点</span>
          <span>时间范围: {data.length > 0 ? `${data[0].time} 至 ${data[data.length - 1].time}` : '无数据'}</span>
        </div>
      </div>
    </div>
  )
}
