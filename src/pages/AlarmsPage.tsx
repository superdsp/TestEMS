// Alarms Page - Alarm list and threshold configuration

import { useState } from 'react'
import { Bell, AlertTriangle, AlertCircle, Info, Check, Settings } from 'lucide-react'

const mockAlarms = [
  {
    id: 1,
    severity: 'warning',
    message: '电池SOC过低，当前SOC: 15%',
    trigger_value: 15,
    threshold_value: 20,
    acknowledged: false,
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
    system_name: '储能电池',
  },
  {
    id: 2,
    severity: 'critical',
    message: 'PCS功率超限，当前功率: 11.5 kW',
    trigger_value: 11.5,
    threshold_value: 10,
    acknowledged: false,
    created_at: new Date(Date.now() - 2 * 60000).toISOString(),
    system_name: 'PCS',
  },
  {
    id: 3,
    severity: 'warning',
    message: 'Room 3 负载超载',
    trigger_value: 3.8,
    threshold_value: 3.5,
    acknowledged: true,
    created_at: new Date(Date.now() - 30 * 60000).toISOString(),
    system_name: 'Room 3',
  },
]

export default function AlarmsPage() {
  const [alarms, setAlarms] = useState(mockAlarms)
  const [filter, setFilter] = useState<'all' | 'active' | 'acknowledged'>('all')

  const filteredAlarms = alarms.filter((alarm) => {
    if (filter === 'active') return !alarm.acknowledged
    if (filter === 'acknowledged') return alarm.acknowledged
    return true
  })

  const handleAcknowledge = (id: number) => {
    setAlarms(
      alarms.map((alarm) =>
        alarm.id === id ? { ...alarm, acknowledged: true, acknowledged_at: new Date().toISOString() } : alarm
      )
    )
  }

  const handleAcknowledgeAll = () => {
    setAlarms(alarms.map((alarm) => ({ ...alarm, acknowledged: true })))
  }

  const activeCount = alarms.filter((a) => !a.acknowledged).length

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />
      default:
        return <Info className="w-5 h-5 text-blue-600" />
    }
  }

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}小时前`
    return date.toLocaleDateString('zh-CN')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">报警管理</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeCount > 0 ? (
              <span className="text-red-600 font-medium">{activeCount} 个未确认报警</span>
            ) : (
              '暂无未确认报警'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAcknowledgeAll}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm shadow-sm"
          >
            全部确认
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2 shadow-sm">
            <Settings className="w-4 h-4" />
            阈值配置
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl p-1 shadow-sm border border-gray-200 inline-flex">
        {(['all', 'active', 'acknowledged'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f === 'all' ? '全部' : f === 'active' ? '未确认' : '已确认'}
            {f === 'active' && activeCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {activeCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alarm List */}
      <div className="space-y-3">
        {filteredAlarms.length === 0 ? (
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">暂无报警记录</p>
          </div>
        ) : (
          filteredAlarms.map((alarm) => (
            <div
              key={alarm.id}
              className={`rounded-xl p-4 border ${getSeverityClass(alarm.severity)} ${
                alarm.acknowledged ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getSeverityIcon(alarm.severity)}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-800">{alarm.system_name}</h3>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          alarm.severity === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : alarm.severity === 'warning'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {alarm.severity === 'critical'
                          ? '严重'
                          : alarm.severity === 'warning'
                          ? '警告'
                          : '信息'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{alarm.message}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      触发值: {alarm.trigger_value} | 阈值: {alarm.threshold_value} |{' '}
                      {formatTime(alarm.created_at)}
                    </p>
                  </div>
                </div>

                {!alarm.acknowledged && (
                  <button
                    onClick={() => handleAcknowledge(alarm.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    确认
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Alarm Thresholds */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="font-semibold text-gray-800 mb-4">报警阈值配置</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b border-gray-200">
                <th className="pb-3 font-medium">报警类型</th>
                <th className="pb-3 font-medium">系统</th>
                <th className="pb-3 font-medium">下限</th>
                <th className="pb-3 font-medium">上限</th>
                <th className="pb-3 font-medium">严重程度</th>
                <th className="pb-3 font-medium">状态</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-b border-gray-100">
                <td className="py-3">SOC过低</td>
                <td>储能电池</td>
                <td>10%</td>
                <td>-</td>
                <td><span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">严重</span></td>
                <td className="text-green-600">启用</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3">SOC警告</td>
                <td>储能电池</td>
                <td>20%</td>
                <td>-</td>
                <td><span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">警告</span></td>
                <td className="text-green-600">启用</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3">功率超限</td>
                <td>PCS</td>
                <td>-</td>
                <td>10 kW</td>
                <td><span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">严重</span></td>
                <td className="text-green-600">启用</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3">房间过载</td>
                <td>房间</td>
                <td>-</td>
                <td>3.5 kW</td>
                <td><span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">警告</span></td>
                <td className="text-green-600">启用</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
