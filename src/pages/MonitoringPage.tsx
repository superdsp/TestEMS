// Monitoring Page - Real-time MQTT data packets

import { useState, useEffect, useRef } from 'react'
import { Package, RefreshCw } from 'lucide-react'

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

interface DataPacket {
  id: number
  timestamp: number
  topic: string
  data: Record<string, any>
  raw: string
}

export default function MonitoringPage() {
  const [packets, setPackets] = useState<DataPacket[]>([])
  const [selectedPacket, setSelectedPacket] = useState<DataPacket | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [packetCount, setPacketCount] = useState(0)
  const counterRef = useRef(0)
  const lastFetchRef = useRef<number>(0)

  useEffect(() => {
    const fetchSimulation = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/simulation`)
        const data = await res.json()

        // Create packets from current simulation state
        const now = Date.now()
        if (now - lastFetchRef.current >= 500) { // Throttle to 2fps for display
          lastFetchRef.current = now
          counterRef.current++

          const newPackets: DataPacket[] = []

          // PV packet
          newPackets.push({
            id: counterRef.current,
            timestamp: data.timestamp || now,
            topic: 'ems/pv',
            data: { powerKW: data.pv?.powerKW, voltage: data.pv?.voltage, irradiance: data.pv?.irradiance },
            raw: JSON.stringify({ powerKW: data.pv?.powerKW, voltage: data.pv?.voltage, irradiance: data.pv?.irradiance })
          })

          // Battery packet
          newPackets.push({
            id: ++counterRef.current,
            timestamp: data.timestamp || now,
            topic: 'ems/battery',
            data: { powerKW: data.battery?.powerKW, socPercent: data.battery?.socPercent, temperatureC: data.battery?.temperatureC },
            raw: JSON.stringify({ powerKW: data.battery?.powerKW, socPercent: data.battery?.socPercent, temperatureC: data.battery?.temperatureC })
          })

          // BMS packet
          newPackets.push({
            id: ++counterRef.current,
            timestamp: data.timestamp || now,
            topic: 'ems/battery/bms',
            data: {
              cellCount: data.battery?.bms?.cellCount,
              stringCount: data.battery?.bms?.stringCount,
              voltages: data.battery?.bms?.voltages?.slice(0, 4),
              temps: data.battery?.bms?.temps?.slice(0, 4),
              balanceStatus: data.battery?.bms?.balanceStatus?.slice(0, 4),
              maxCellDeltaMV: data.battery?.bms?.maxCellDeltaMV,
              avgVoltage: data.battery?.bms?.avgVoltage,
              totalVoltage: data.battery?.bms?.totalVoltage
            },
            raw: JSON.stringify(data.battery?.bms)
          })

          // PCS packet
          newPackets.push({
            id: ++counterRef.current,
            timestamp: data.timestamp || now,
            topic: 'ems/pcs',
            data: { status: data.pcs?.status, powerKW: data.pcs?.powerKW, efficiency: data.pcs?.efficiency },
            raw: JSON.stringify(data.pcs)
          })

          // Grid packet
          newPackets.push({
            id: ++counterRef.current,
            timestamp: data.timestamp || now,
            topic: 'ems/grid',
            data: { powerKW: data.grid?.powerKW, voltage: data.grid?.voltage },
            raw: JSON.stringify(data.grid)
          })

          // Balance packet
          newPackets.push({
            id: ++counterRef.current,
            timestamp: data.timestamp || now,
            topic: 'ems/balance',
            data: {
              totalLoadKW: data.balance?.totalLoadKW,
              pvPowerKW: data.balance?.pvPowerKW,
              batteryPowerKW: data.balance?.batteryPowerKW,
              gridPowerKW: data.balance?.gridPowerKW
            },
            raw: JSON.stringify(data.balance)
          })

          // Rooms packet
          newPackets.push({
            id: ++counterRef.current,
            timestamp: data.timestamp || now,
            topic: 'ems/rooms',
            data: data.rooms?.slice(0, 6).map((r: any) => ({
              roomId: r.roomId,
              roomName: r.roomName,
              powerKW: r.powerKW,
              breakerStatus: r.breakerStatus
            })),
            raw: JSON.stringify(data.rooms)
          })

          // SimTime packet
          newPackets.push({
            id: ++counterRef.current,
            timestamp: data.timestamp || now,
            topic: 'ems/simtime',
            data: data.simTime,
            raw: JSON.stringify(data.simTime)
          })

          if (!isPaused) {
            setPackets(prev => [...prev, ...newPackets].slice(-200)) // Keep last 200 packets
            setPacketCount(prev => prev + newPackets.length)
          }
        }
      } catch (err) {
        console.error('Failed to fetch:', err)
      }
    }

    fetchSimulation()
    const interval = setInterval(fetchSimulation, 500) // 2fps

    return () => clearInterval(interval)
  }, [isPaused])

  const clearPackets = () => {
    setPackets([])
    setPacketCount(0)
    counterRef.current = 0
  }

  const topicColors: Record<string, string> = {
    'ems/pv': 'bg-green-100 text-green-800',
    'ems/battery': 'bg-orange-100 text-orange-800',
    'ems/battery/bms': 'bg-yellow-100 text-yellow-800',
    'ems/pcs': 'bg-blue-100 text-blue-800',
    'ems/grid': 'bg-purple-100 text-purple-800',
    'ems/balance': 'bg-indigo-100 text-indigo-800',
    'ems/rooms': 'bg-pink-100 text-pink-800',
    'ems/simtime': 'bg-gray-100 text-gray-800',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">实时监控</h1>
          <p className="text-sm text-gray-500 mt-1">MQTT 数据包实时解析</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            共接收 <span className="font-bold text-blue-600">{packetCount}</span> 个数据包
          </span>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 ${
              isPaused
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-amber-500 text-white hover:bg-amber-600'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isPaused ? '' : 'animate-spin'}`} />
            {isPaused ? '继续' : '暂停'}
          </button>
          <button
            onClick={clearPackets}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            清空
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">数据来源</p>
          <p className="text-lg font-bold text-gray-800 mt-1">MQTT</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">当前数据包</p>
          <p className="text-lg font-bold text-blue-600 mt-1">{packets.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Broker</p>
          <p className="text-lg font-bold text-gray-800 mt-1">106.14.31.17:1883</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">刷新频率</p>
          <p className="text-lg font-bold text-green-600 mt-1">2 FPS</p>
        </div>
      </div>

      {/* Packet List */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <Package className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-800">数据包列表</h2>
        </div>

        {/* Topic Legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(topicColors).map(([topic, color]) => (
            <span key={topic} className={`px-2 py-1 rounded text-xs font-medium ${color}`}>
              {topic}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Packet Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">#</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">时间</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Topic</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">预览</th>
                </tr>
              </thead>
              <tbody>
                {packets.map((packet) => (
                  <tr
                    key={packet.id}
                    onClick={() => setSelectedPacket(packet)}
                    className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50 ${
                      selectedPacket?.id === packet.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-gray-500">{packet.id}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {new Date(packet.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${topicColors[packet.topic] || 'bg-gray-100 text-gray-800'}`}>
                        {packet.topic}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 truncate max-w-[150px]">
                      {packet.raw.slice(0, 40)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {packets.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                {isPaused ? '已暂停' : '等待数据...'}
              </div>
            )}
          </div>

          {/* Packet Detail */}
          <div className="border border-gray-200 rounded-lg p-4 max-h-[600px] overflow-y-auto">
            <h3 className="font-semibold text-gray-800 mb-3">数据包详情</h3>
            {selectedPacket ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Topic</p>
                  <p className={`px-2 py-1 rounded text-sm font-medium inline-block ${topicColors[selectedPacket.topic] || 'bg-gray-100 text-gray-800'}`}>
                    {selectedPacket.topic}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">时间戳</p>
                  <p className="text-sm text-gray-800">{new Date(selectedPacket.timestamp).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">解析数据</p>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <pre className="whitespace-pre-wrap break-all">
                      {JSON.stringify(selectedPacket.data, null, 2)}
                    </pre>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">原始 JSON</p>
                  <div className="bg-gray-50 rounded-lg p-3 text-xs">
                    <pre className="whitespace-pre-wrap break-all text-gray-600">
                      {selectedPacket.raw}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                点击左侧数据包查看详情
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
