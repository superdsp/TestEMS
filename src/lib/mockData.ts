// Mock Data Generator for local development
// Simulates realistic energy management system data

import type { SystemSnapshot, RoomLoadSnapshot } from './types'

interface MockDataState {
  pv: {
    powerKW: number
    irradiance: number
    voltage: number
  }
  battery: {
    socPercent: number
    powerKW: number
    temperatureC: number
  }
  pcs: {
    status: 'running' | 'standby' | 'fault' | 'starting' | 'stopping'
    powerKW: number
    efficiency: number
  }
  grid: {
    powerKW: number
    voltage: number
  }
  rooms: RoomLoadSnapshot[]
  timestamp: number
}

class MockDataGenerator {
  private state: MockDataState
  private tickCount: number = 0

  constructor() {
    this.state = this.initState()
  }

  private initState(): MockDataState {
    const now = Date.now()
    const hour = new Date(now).getHours()

    return {
      timestamp: now,
      pv: {
        powerKW: this.calcPvPower(hour),
        irradiance: this.calcIrradiance(hour),
        voltage: 800,
      },
      battery: {
        socPercent: 65,
        powerKW: 0,
        temperatureC: 28,
      },
      pcs: {
        status: 'running',
        powerKW: 0,
        efficiency: 0.95,
      },
      grid: {
        powerKW: 0,
        voltage: 380,
      },
      rooms: [
        { roomId: 'room-1', roomName: '开放办公区', powerKW: 3.2, energyKWh: 0, breakerStatus: 'closed' },
        { roomId: 'room-2', roomName: '独立办公室', powerKW: 1.5, energyKWh: 0, breakerStatus: 'closed' },
        { roomId: 'room-3', roomName: '会议室', powerKW: 2.0, energyKWh: 0, breakerStatus: 'closed' },
        { roomId: 'room-4', roomName: '机房', powerKW: 4.5, energyKWh: 0, breakerStatus: 'closed' },
        { roomId: 'room-5', roomName: '开放办公区2', powerKW: 2.8, energyKWh: 0, breakerStatus: 'closed' },
        { roomId: 'room-6', roomName: '前台接待', powerKW: 0.8, energyKWh: 0, breakerStatus: 'closed' },
      ],
    }
  }

  private calcPvPower(hour: number): number {
    if (hour < 8 || hour > 18) return 0
    const solarFactor = Math.sin((hour - 8) * Math.PI / 10)
    return Math.max(0, 8 * solarFactor * (0.7 + Math.random() * 0.6))
  }

  private calcIrradiance(hour: number): number {
    if (hour < 8 || hour > 18) return 0
    const solarFactor = Math.sin((hour - 8) * Math.PI / 10)
    return Math.max(0, 850 * solarFactor)
  }

  private calcRoomLoad(hour: number, baseLoad: number): number {
    // Simulate daily load pattern
    if (hour < 6) return baseLoad * 0.1
    if (hour >= 6 && hour < 8) return baseLoad * 0.3 + baseLoad * (hour - 6) * 0.1
    if (hour >= 8 && hour < 12) return baseLoad * 0.9 + Math.random() * 0.5
    if (hour >= 12 && hour < 14) return baseLoad * 0.6 // Lunch
    if (hour >= 14 && hour < 18) return baseLoad * 0.95 + Math.random() * 0.5
    if (hour >= 18 && hour < 20) return baseLoad * 0.4
    return baseLoad * 0.15
  }

  tick(): SystemSnapshot {
    this.tickCount++
    const now = Date.now()
    const hour = new Date(now).getHours() + new Date(now).getMinutes() / 60

    // Update PV
    this.state.pv.powerKW = this.calcPvPower(hour) + (Math.random() - 0.5) * 0.5
    this.state.pv.irradiance = this.calcIrradiance(hour)

    // Update rooms with realistic patterns
    const roomBaseLoads = [3.2, 1.5, 2.0, 4.5, 2.8, 0.8]
    let totalLoad = 0
    this.state.rooms.forEach((room, i) => {
      if (room.breakerStatus === 'closed') {
        room.powerKW = Math.max(0.1, this.calcRoomLoad(hour, roomBaseLoads[i]) + (Math.random() - 0.5) * 0.3)
        room.energyKWh += room.powerKW / 3600 // kWh per second
      } else {
        room.powerKW = 0
      }
      totalLoad += room.powerKW
    })

    // Energy management: PV -> Load -> Battery -> Grid
    const pvPower = Math.max(0, this.state.pv.powerKW)
    const netPower = pvPower - totalLoad

    // Battery fluctuates naturally - ensure minimum activity for visualization
    // Use sine wave + noise for smooth, realistic oscillation between charge/discharge
    const oscillation = Math.sin(this.tickCount * 0.05) * 4 + 2 // +2 to +6 kW range

    // Force battery to always have noticeable power for visualization
    if (netPower > 0.5) {
      // Excess PV, charge battery (negative = charging)
      this.state.battery.powerKW = -(3 + oscillation)
    } else if (netPower < -0.5) {
      // Deficit, discharge battery (positive = discharging)
      this.state.battery.powerKW = 3 + oscillation
    } else {
      // Near balance - alternate between charge and discharge
      this.state.battery.powerKW = Math.sin(this.tickCount * 0.03) * 4
    }

    // Ensure minimum magnitude for visibility
    if (Math.abs(this.state.battery.powerKW) < 1) {
      this.state.battery.powerKW = this.state.battery.powerKW >= 0 ? 1.5 : -1.5
    }

    // Clamp battery power to realistic range
    this.state.battery.powerKW = Math.max(-8, Math.min(8, this.state.battery.powerKW))

    // Battery temperature
    this.state.battery.temperatureC = 25 + Math.abs(this.state.battery.powerKW) * 0.5 + Math.random() * 2

    // PCS mirrors battery power
    this.state.pcs.powerKW = this.state.battery.powerKW
    this.state.pcs.efficiency = 0.93 + Math.random() * 0.04

    // Grid balances the rest
    this.state.grid.powerKW = totalLoad - pvPower - this.state.battery.powerKW

    // Update timestamp
    this.state.timestamp = now

    return this.toSnapshot()
  }

  toSnapshot(): SystemSnapshot {
    return {
      timestamp: this.state.timestamp,
      pv: { ...this.state.pv },
      battery: {
        socPercent: this.state.battery.socPercent,
        powerKW: this.state.battery.powerKW,
        temperatureC: this.state.battery.temperatureC,
        bms: {
          cellCount: 16,
          stringCount: 4,
          voltages: Array(16).fill(3280),
          socValues: Array(16).fill(65),
          temps: Array(16).fill(28),
          balanceStatus: Array(16).fill(false),
          maxCellDeltaMV: 25,
          avgVoltage: 3.28,
          totalVoltage: 52.5,
          sohPercent: 98,
          chargeCycles: 150,
        },
      },
      pcs: {
        status: this.state.pcs.status,
        powerKW: this.state.pcs.powerKW,
        efficiency: this.state.pcs.efficiency,
      },
      grid: {
        powerKW: this.state.grid.powerKW,
        voltage: this.state.grid.voltage,
      },
      rooms: this.state.rooms.map(r => ({ ...r })),
      balance: {
        totalLoadKW: this.state.rooms.reduce((sum, r) => sum + r.powerKW, 0),
        pvPowerKW: this.state.pv.powerKW,
        batteryPowerKW: this.state.battery.powerKW,
        gridPowerKW: this.state.grid.powerKW,
        systemEfficiency: this.state.pcs.efficiency,
      },
    }
  }

  // Generate historical data for charts
  generateHistoricalData(range: 'day' | 'week' | 'month' | 'year', points: number = 100) {
    const data: Array<{ timestamp: number; pv: number; battery: number; load: number; grid: number }> = []
    const now = Date.now()

    for (let i = points - 1; i >= 0; i--) {
      let timestamp: number
      let hour: number

      switch (range) {
        case 'day':
          timestamp = now - i * 60 * 1000 // 1 minute intervals
          hour = new Date(timestamp).getHours() + new Date(timestamp).getMinutes() / 60
          break
        case 'week':
          timestamp = now - i * 3600 * 1000 // 1 hour intervals
          hour = new Date(timestamp).getHours()
          break
        case 'month':
          timestamp = now - i * 3600 * 1000 * 2 // 2 hour intervals
          hour = new Date(timestamp).getHours()
          break
        case 'year':
          timestamp = now - i * 86400 * 1000 // 1 day intervals
          hour = 12 // Use midday for solar calculations
          break
      }

      const solarFactor = hour >= 8 && hour <= 18 ? Math.sin((hour - 8) * Math.PI / 10) : 0
      const cloudNoise = range === 'day' ? (0.7 + Math.random() * 0.6) : 1

      const pv = Math.max(0, 8 * solarFactor * cloudNoise + (Math.random() - 0.5) * 0.5)
      const load = 12 + Math.sin(i / (range === 'day' ? 60 : range === 'week' ? 12 : 24)) * 4 + Math.random() * 2
      const battery = 50 + Math.sin(i / (range === 'day' ? 60 : 12)) * 20 + (Math.random() - 0.5) * 5
      const grid = load - pv - (Math.random() - 0.5) * 2

      data.push({ timestamp, pv, battery: Math.max(10, Math.min(90, battery)), load, grid })
    }

    return data
  }
}

// Singleton instance
export const mockDataGenerator = new MockDataGenerator()

// Mock API responses
export const mockApi = {
  getSimulation: () => mockDataGenerator.tick(),

  getRealtime: (range: '15min' | '1hour' | '24hour') => {
    const rangeMap = {
      '15min': 15,
      '1hour': 60,
      '24hour': 1440,
    }
    const minutes = rangeMap[range]
    return mockDataGenerator.generateHistoricalData('day', minutes)
  },

  getHistory: (range: 'day' | 'week' | 'month' | 'year') => {
    const pointsMap = {
      day: 1440,
      week: 168,
      month: 720,
      year: 365,
    }
    return mockDataGenerator.generateHistoricalData(range, pointsMap[range])
  },
}
