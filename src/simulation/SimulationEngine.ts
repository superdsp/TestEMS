// Main Simulation Engine - Orchestrates all energy system models

import { SolarIrradiance } from './models/SolarIrradiance'
import { PVModel } from './models/PVModel'
import { BatteryModel } from './models/BatteryModel'
import { PCSModel } from './models/PCSModel'
import { RoomLoadModel, RoomConfig } from './models/RoomLoadModel'
import type { SystemSnapshot, RoomLoadSnapshot } from '../lib/types'

export interface SimulationConfig {
  latitude: number
  pvConfig: Partial<PVModel['config']>
  batteryConfig: Partial<BatteryModel['config']>
  pcsConfig: Partial<PCSModel['config']>
  roomConfigs: RoomConfig[]
}

export class SimulationEngine {
  private solarIrradiance: SolarIrradiance
  private pvModel: PVModel
  private batteryModel: BatteryModel
  private pcsModel: PCSModel
  private roomLoadModel: RoomLoadModel

  private tickIntervalMs: number = 1000
  private isRunning: boolean = false
  private lastTickTime: number = 0
  private intervalId: number | null = null
  private tickCallback: ((snapshot: SystemSnapshot) => void) | null = null

  // Simulation speed multiplier (1 = real-time, 10 = 10x faster)
  private speedMultiplier: number = 1

  constructor(config: Partial<SimulationConfig> = {}) {
    // Default configurations
    const defaultConfig: SimulationConfig = {
      latitude: 35.0,
      pvConfig: { peakPowerKW: 10, systemEfficiency: 0.18 },
      batteryConfig: { capacityKWh: 50, maxChargeRateKW: 10, maxDischargeRateKW: 10 },
      pcsConfig: { ratedPowerKW: 10, dcVoltageV: 800, acVoltageV: 380 },
      roomConfigs: this.createDefaultRooms(),
    }

    const finalConfig = { ...defaultConfig, ...config }

    // Initialize models
    this.solarIrradiance = new SolarIrradiance(finalConfig.latitude)
    this.pvModel = new PVModel(finalConfig.pvConfig)
    this.batteryModel = new BatteryModel(finalConfig.batteryConfig)
    this.pcsModel = new PCSModel(finalConfig.pcsConfig)
    this.roomLoadModel = new RoomLoadModel(finalConfig.roomConfigs)
  }

  private createDefaultRooms(): RoomConfig[] {
    // 6 offices totaling ~30kW rated
    // Realistic office scenarios with different room types
    return [
      { id: 'room-1', name: '开放办公区', areaM2: 150, ratedPowerKW: 7, roomType: 'open_office' },
      { id: 'room-2', name: '独立办公室', areaM2: 35, ratedPowerKW: 3, roomType: 'closed_office' },
      { id: 'room-3', name: '会议室', areaM2: 60, ratedPowerKW: 5, roomType: 'meeting_room' },
      { id: 'room-4', name: '机房', areaM2: 40, ratedPowerKW: 8, roomType: 'server_room' },
      { id: 'room-5', name: '开放办公区2', areaM2: 120, ratedPowerKW: 6, roomType: 'open_office' },
      { id: 'room-6', name: '前台接待', areaM2: 45, ratedPowerKW: 2, roomType: 'reception' },
    ]
  }

  /**
   * Set callback for simulation tick
   */
  onTick(callback: (snapshot: SystemSnapshot) => void): void {
    this.tickCallback = callback
  }

  /**
   * Set simulation speed multiplier
   */
  setSpeed(multiplier: number): void {
    this.speedMultiplier = Math.max(0.1, Math.min(60, multiplier))
  }

  /**
   * Get current speed multiplier
   */
  getSpeed(): number {
    return this.speedMultiplier
  }

  /**
   * Start the simulation
   */
  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.lastTickTime = Date.now()

    this.intervalId = window.setInterval(() => {
      this.tick()
    }, this.tickIntervalMs)
  }

  /**
   * Stop the simulation
   */
  stop(): void {
    this.isRunning = false
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Reset simulation to initial state
   */
  reset(): void {
    this.stop()
    this.pvModel = new PVModel()
    this.batteryModel = new BatteryModel({ initialSOC: 50 })
    this.pcsModel = new PCSModel()
    this.roomLoadModel = new RoomLoadModel(this.createDefaultRooms())
  }

  /**
   * Execute one simulation tick
   */
  tick(): void {
    const now = Date.now()
    const realDtMs = now - this.lastTickTime
    const dtMs = realDtMs * this.speedMultiplier
    const dtHours = dtMs / 3600000

    this.lastTickTime = now

    const date = new Date(now)
    const hour = date.getHours() + date.getMinutes() / 60
    const dayOfYear = Math.floor(
      (now - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
    )
    const dayOfWeek = date.getDay()

    // Use simulated hour for solar (10 AM to 14 PM for demo) to ensure PV is always available
    const simulatedHour = 10 + (Math.sin(now / 10000) + 1) * 2 // Oscillates between 10-14

    // Calculate solar irradiance
    const irradiance = this.solarIrradiance.calculate(simulatedHour, dayOfYear, dtMs)

    // Ambient temperature (simplified - could be more detailed)
    const ambientTempC = 25 + 5 * Math.sin((hour - 6) * (Math.PI / 12))

    // Calculate PV generation
    const pvPowerKW = this.pvModel.calculate(irradiance, ambientTempC, dtHours)

    // Update room loads
    const roomStates = this.roomLoadModel.updateAll(hour, dayOfWeek, dtHours)
    const totalLoadKW = this.roomLoadModel.getTotalLoad()

    // Energy management logic with fluctuation
    const netPower = pvPowerKW - totalLoadKW
    let batteryTargetPower = 0

    // Add natural fluctuation to battery
    const fluctuation = (Math.random() - 0.5) * 2 // -1 to 1 kW random fluctuation

    if (netPower > 0.5) {
      // Excess PV - charge battery
      const maxCharge = this.batteryModel.getState().availableChargeKWh / dtHours
      batteryTargetPower = Math.min(netPower + fluctuation, maxCharge, 10) // Max 10kW charge
    } else if (netPower < -0.5) {
      // Deficit - discharge battery
      const deficit = -netPower
      const maxDischarge = this.batteryModel.getState().availableDischargeKWh / dtHours
      batteryTargetPower = -(Math.min(deficit, maxDischarge, 10) + fluctuation)
    } else {
      // Near balance - small oscillation to keep battery active
      batteryTargetPower = fluctuation * 0.5 // Small +/- 0.5kW oscillation
    }

    // Update PCS with battery power
    this.pcsModel.setTargetPower(batteryTargetPower)
    this.pcsModel.update(dtMs)

    // Update battery with actual PCS power
    const actualBatteryPower = this.pcsModel.getState().powerKW
    this.batteryModel.update(actualBatteryPower, dtHours)

    // Grid power (balance)
    const gridPowerKW = totalLoadKW - pvPowerKW - actualBatteryPower

    // Build snapshot
    const snapshot: SystemSnapshot = {
      timestamp: now,
      pv: {
        powerKW: pvPowerKW,
        irradiance,
        voltage: 800,
      },
      battery: {
        socPercent: this.batteryModel.getSOC(),
        powerKW: actualBatteryPower,
        temperatureC: this.batteryModel.getState().temperatureC,
      },
      pcs: {
        status: this.pcsModel.getState().status,
        powerKW: actualBatteryPower,
        efficiency: this.pcsModel.getState().efficiency,
      },
      grid: {
        powerKW: gridPowerKW,
        voltage: 380,
      },
      rooms: roomStates as RoomLoadSnapshot[],
      balance: {
        totalLoadKW,
        pvPowerKW,
        batteryPowerKW: actualBatteryPower,
        gridPowerKW,
        systemEfficiency: this.pcsModel.getState().efficiency,
      },
    }

    // Notify callback
    if (this.tickCallback) {
      this.tickCallback(snapshot)
    }
  }

  /**
   * Control a circuit breaker
   */
  setBreakerStatus(roomId: string, status: 'closed' | 'open'): void {
    this.roomLoadModel.setBreakerStatus(roomId, status)
  }

  /**
   * Get current snapshot (synchronous)
   */
  getSnapshot(): SystemSnapshot {
    const now = Date.now()
    const date = new Date(now)
    const hour = date.getHours() + date.getMinutes() / 60
    const dayOfYear = Math.floor(
      (now - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
    )

    const irradiance = this.solarIrradiance.calculate(hour, dayOfYear)
    const pvPowerKW = this.pvModel.getState().powerKW
    const roomStates = this.roomLoadModel.getRoomStates()
    const totalLoadKW = this.roomLoadModel.getTotalLoad()
    const batteryState = this.batteryModel.getState()
    const pcsState = this.pcsModel.getState()
    const gridPowerKW = totalLoadKW - pvPowerKW - batteryState.powerKW

    return {
      timestamp: now,
      pv: {
        powerKW: pvPowerKW,
        irradiance,
        voltage: 800,
      },
      battery: {
        socPercent: batteryState.socPercent,
        powerKW: batteryState.powerKW,
        temperatureC: batteryState.temperatureC,
      },
      pcs: {
        status: pcsState.status,
        powerKW: pcsState.powerKW,
        efficiency: pcsState.efficiency,
      },
      grid: {
        powerKW: gridPowerKW,
        voltage: 380,
      },
      rooms: roomStates,
      balance: {
        totalLoadKW,
        pvPowerKW,
        batteryPowerKW: batteryState.powerKW,
        gridPowerKW,
        systemEfficiency: pcsState.efficiency,
      },
    }
  }

  isSimulating(): boolean {
    return this.isRunning
  }
}
