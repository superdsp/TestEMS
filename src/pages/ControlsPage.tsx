// Controls Page - PCS and Battery Control Panel

import { useState } from 'react'
import { Zap, Battery, Power, Clock } from 'lucide-react'

export default function ControlsPage() {
  const [pcsStatus, setPcsStatus] = useState<'standby' | 'running'>('standby')
  const [chargePower, setChargePower] = useState(5)
  const [dischargePower, setDischargePower] = useState(5)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">控制面板</h1>
        <p className="text-sm text-gray-500 mt-1">PCS和储能系统的控制与参数设置</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PCS Control */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">PCS控制</h2>
              <p className="text-sm text-gray-500">功率转换系统 10kW</p>
            </div>
          </div>

          {/* Status */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">运行状态</span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    pcsStatus === 'running' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`}
                />
                <span className="font-medium text-gray-800">
                  {pcsStatus === 'running' ? '运行中' : '待机'}
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {pcsStatus === 'standby' ? (
              <button
                onClick={() => setPcsStatus('running')}
                className="w-full py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Power className="w-4 h-4" />
                启动PCS
              </button>
            ) : (
              <button
                onClick={() => setPcsStatus('standby')}
                className="w-full py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Power className="w-4 h-4" />
                停止PCS
              </button>
            )}

            <div className="pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600 space-y-1">
                <p>DC电压: 800V</p>
                <p>AC电压: 380V</p>
                <p>效率: 95%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Battery Control */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Battery className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">储能控制</h2>
              <p className="text-sm text-gray-500">电池容量 50kWh</p>
            </div>
          </div>

          {/* SOC Display */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">当前SOC</span>
              <span className="font-bold text-orange-600">50%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full" style={{ width: '50%' }} />
            </div>
          </div>

          {/* Power Settings */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                充电功率 (kW)
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={chargePower}
                onChange={(e) => setChargePower(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>0 kW</span>
                <span className="font-medium text-blue-600">{chargePower} kW</span>
                <span>10 kW</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                放电功率 (kW)
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={dischargePower}
                onChange={(e) => setDischargePower(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <span>0 kW</span>
                <span className="font-medium text-orange-600">{dischargePower} kW</span>
                <span>10 kW</span>
              </div>
            </div>

            <button className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm">
              应用设置
            </button>
          </div>
        </div>
      </div>

      {/* Scheduled Operations */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">定时任务</h2>
            <p className="text-sm text-gray-500">设置自动充放电计划</p>
          </div>
        </div>

        <div className="text-center py-8 text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>暂无定时任务</p>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm">
            创建定时任务
          </button>
        </div>
      </div>
    </div>
  )
}
