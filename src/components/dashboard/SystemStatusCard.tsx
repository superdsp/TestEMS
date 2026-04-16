// System Status Card - Display individual system status

import { Activity, Thermometer, Zap, Gauge } from 'lucide-react'

interface SystemStatusCardProps {
  name: string
  type: 'pv' | 'battery' | 'pcs' | 'grid' | 'load'
  powerKW: number
  status: 'running' | 'standby' | 'fault' | 'offline'
  details?: {
    voltage?: number
    current?: number
    temperature?: number
    efficiency?: number
    soc?: number
  }
}

const typeColors = {
  pv: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', active: 'bg-green-100' },
  battery: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', active: 'bg-orange-100' },
  pcs: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', active: 'bg-blue-100' },
  grid: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', active: 'bg-yellow-100' },
  load: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', active: 'bg-red-100' },
}

const statusLabels = {
  running: { label: '运行中', color: 'bg-green-500' },
  standby: { label: '待机', color: 'bg-yellow-500' },
  fault: { label: '故障', color: 'bg-red-500' },
  offline: { label: '离线', color: 'bg-gray-400' },
}

export default function SystemStatusCard({
  name,
  type,
  powerKW,
  status,
  details,
}: SystemStatusCardProps) {
  const colors = typeColors[type]
  const statusInfo = statusLabels[status]

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-xl p-4 transition-all hover:shadow-md bg-white`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-semibold ${colors.text}`}>{name}</h3>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusInfo.color}`}></span>
          <span className="text-xs text-gray-500">{statusInfo.label}</span>
        </div>
      </div>

      <div className="space-y-2">
        {/* Power */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">功率</span>
          <span className={`font-bold ${colors.text}`}>
            {powerKW.toFixed(2)} <span className="text-xs font-normal text-gray-400">kW</span>
          </span>
        </div>

        {/* Details */}
        {details?.voltage && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Zap className="w-3 h-3" /> 电压
            </span>
            <span className="text-sm text-gray-700">
              {details.voltage.toFixed(0)} <span className="text-xs text-gray-400">V</span>
            </span>
          </div>
        )}

        {details?.current && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Activity className="w-3 h-3" /> 电流
            </span>
            <span className="text-sm text-gray-700">
              {details.current.toFixed(1)} <span className="text-xs text-gray-400">A</span>
            </span>
          </div>
        )}

        {details?.temperature !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Thermometer className="w-3 h-3" /> 温度
            </span>
            <span className="text-sm text-gray-700">
              {details.temperature.toFixed(1)} <span className="text-xs text-gray-400">°C</span>
            </span>
          </div>
        )}

        {details?.efficiency !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Gauge className="w-3 h-3" /> 效率
            </span>
            <span className="text-sm text-gray-700">
              {(details.efficiency * 100).toFixed(1)} <span className="text-xs text-gray-400">%</span>
            </span>
          </div>
        )}

        {details?.soc !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">SOC</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all"
                  style={{ width: `${details.soc}%` }}
                />
              </div>
              <span className="text-sm text-gray-700">{details.soc.toFixed(0)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
