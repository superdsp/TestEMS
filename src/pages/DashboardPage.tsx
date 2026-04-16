// Dashboard Page - Main dashboard view with energy flow diagram

import { useState, useEffect, useRef } from 'react'
import { SimulationEngine } from '../simulation'
import type { SystemSnapshot } from '../lib/types'
import EnergyFlowDiagram from '../components/dashboard/EnergyFlowDiagram'
import PowerGauge from '../components/dashboard/PowerGauge'
import SOCIndicator from '../components/dashboard/SOCIndicator'
import SystemStatusCard from '../components/dashboard/SystemStatusCard'

export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null)
  const engineRef = useRef<SimulationEngine | null>(null)

  useEffect(() => {
    engineRef.current = new SimulationEngine()

    engineRef.current.onTick((newSnapshot) => {
      setSnapshot(newSnapshot)
    })

    setSnapshot(engineRef.current.getSnapshot())

    // Auto-start simulation
    engineRef.current.start()

    return () => {
      engineRef.current?.stop()
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">能源管理仪表盘</h1>
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
            <div className="flex justify-around items-center h-full">
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
          </div>

          {/* Battery SOC */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 flex-1">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">储能状态</h3>
            <div className="flex justify-center items-center h-full">
              <SOCIndicator
                socPercent={snapshot?.battery.socPercent || 0}
                temperatureC={snapshot?.battery.temperatureC}
                status={
                  (snapshot?.battery.powerKW || 0) > 0.1
                    ? 'charging'
                    : (snapshot?.battery.powerKW || 0) < -0.1
                    ? 'discharging'
                    : 'idle'
                }
                size="lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SystemStatusCard
          name="光伏系统"
          type="pv"
          powerKW={snapshot?.pv.powerKW || 0}
          status={snapshot?.pv.powerKW && snapshot.pv.powerKW > 0.1 ? 'running' : 'standby'}
          details={{
            voltage: snapshot?.pv.voltage,
            temperature: 35,
            efficiency: 0.18,
          }}
        />
        <SystemStatusCard
          name="储能电池"
          type="battery"
          powerKW={snapshot?.battery.powerKW || 0}
          status={
            (snapshot?.battery.powerKW || 0) > 0.1
              ? 'running'
              : (snapshot?.battery.powerKW || 0) < -0.1
              ? 'running'
              : 'standby'
          }
          details={{
            temperature: snapshot?.battery.temperatureC,
            soc: snapshot?.battery.socPercent,
          }}
        />
        <SystemStatusCard
          name="PCS转换"
          type="pcs"
          powerKW={snapshot?.pcs.powerKW || 0}
          status={snapshot?.pcs.status === 'running' ? 'running' : 'standby'}
          details={{
            voltage: 800,
            efficiency: snapshot?.pcs.efficiency,
          }}
        />
        <SystemStatusCard
          name="电网"
          type="grid"
          powerKW={snapshot?.grid.powerKW || 0}
          status={snapshot?.grid.powerKW !== 0 ? 'running' : 'standby'}
          details={{
            voltage: 380,
          }}
        />
      </div>

      {/* Room Loads Summary */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">房间负载</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {snapshot?.rooms.map((room) => (
            <div
              key={room.roomId}
              className={`p-4 rounded-lg border ${
                room.breakerStatus === 'closed'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{room.roomName}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    room.breakerStatus === 'closed' ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
              </div>
              <div className="text-2xl font-bold text-gray-800">
                {room.powerKW.toFixed(1)}
                <span className="text-xs font-normal text-gray-500 ml-1">kW</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                今日: {room.energyKWh.toFixed(1)} kWh
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
