// Room Load Model - 6 rooms with realistic office load scenarios

export interface RoomConfig {
  id: string
  name: string
  areaM2: number
  ratedPowerKW: number // Max power consumption
  roomType: 'open_office' | 'closed_office' | 'meeting_room' | 'server_room' | 'reception'
}

export interface RoomLoadState {
  roomId: string
  roomName: string
  powerKW: number
  energyKWh: number
  breakerStatus: 'closed' | 'open'
}

interface RoomState {
  roomId: string
  roomName: string
  areaM2: number
  ratedPowerKW: number
  roomType: RoomConfig['roomType']
  currentPowerKW: number
  energyKWh: number
  breakerStatus: 'closed' | 'open'
}

export class RoomLoadModel {
  private rooms: Map<string, RoomState>

  constructor(roomConfigs: RoomConfig[]) {
    this.rooms = new Map()

    for (const config of roomConfigs) {
      this.rooms.set(config.id, {
        roomId: config.id,
        roomName: config.name,
        areaM2: config.areaM2,
        ratedPowerKW: config.ratedPowerKW,
        roomType: config.roomType || 'open_office',
        currentPowerKW: 0,
        energyKWh: 0,
        breakerStatus: 'closed',
      })
    }
  }

  setBreakerStatus(roomId: string, status: 'closed' | 'open'): void {
    const room = this.rooms.get(roomId)
    if (room) {
      room.breakerStatus = status
      if (status === 'open') {
        room.currentPowerKW = 0
      }
    }
  }

  getBreakerStatus(roomId: string): 'closed' | 'open' {
    const room = this.rooms.get(roomId)
    return room?.breakerStatus || 'open'
  }

  /**
   * Calculate realistic office load based on time
   * Office scenarios simulate:
   * - Early morning pre-conditioning (HVAC)
   * - Morning ramp-up with workstation boot
   * - Mid-day peak (full occupancy)
   * - Lunch dip in some areas
   * - Late afternoon sustained load
   * - Evening ramp-down
   */
  private calculateOfficeLoad(state: RoomState, hour: number, dayOfWeek: number): number {
    if (state.breakerStatus === 'open') return 0

    const { areaM2, ratedPowerKW, roomType } = state

    // Base load densities per room type (W/m²)
    const basePowerDensity: Record<RoomConfig['roomType'], number> = {
      open_office: 45,    // Computers, monitors, task lighting
      closed_office: 55,  // Individual offices with more equipment
      meeting_room: 35,  // Projector, laptop charging, variable occupancy
      server_room: 200,  // Server racks, always-on
      reception: 25,     // Lighting, display screens
    }

    const baseDensity = basePowerDensity[roomType] || 45
    let targetPowerKW = (areaM2 * baseDensity) / 1000

    // Weekly pattern
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isFriday = dayOfWeek === 5

    if (isWeekend) {
      // Weekend: minimal load for server room, very low for others
      if (roomType === 'server_room') {
        targetPowerKW *= 0.9  // Server room still running
      } else if (roomType === 'reception') {
        targetPowerKW *= 0.2  // Just standby lighting
      } else {
        targetPowerKW *= 0.1  // Nearly empty
      }
    } else {
      // Weekday hourly pattern
      targetPowerKW *= this.getHourlyMultiplier(hour, roomType, isFriday)
    }

    // Add realistic noise: equipment doesn't all turn on/off at once
    // Random variation ±15% with some temporal correlation
    const noise = 0.85 + Math.random() * 0.3
    targetPowerKW *= noise

    // Occasional high-load events (vacuum cleaner, HVAC boost, etc.)
    if (Math.random() < 0.02) {
      targetPowerKW *= 1.3  // Occasional spike
    }

    return Math.max(0.1, Math.min(ratedPowerKW, targetPowerKW))
  }

  private getHourlyMultiplier(
    hour: number,
    roomType: RoomConfig['roomType'],
    isFriday: boolean
  ): number {
    // Special handling for server room (24/7)
    if (roomType === 'server_room') {
      return hour >= 7 && hour <= 22 ? 1.0 : 0.85
    }

    // Reception follows business hours
    if (roomType === 'reception') {
      if (hour < 7 || hour > 20) return 0.15
      if (hour >= 7 && hour < 8) return 0.3
      if (hour >= 8 && hour < 18) return 0.9 + Math.sin((hour - 8) * 0.3) * 0.1
      if (hour >= 18 && hour <= 20) return 0.5
      return 0.15
    }

    // Meeting rooms: peak during scheduled meeting hours
    if (roomType === 'meeting_room') {
      if (hour < 7 || hour > 21) return 0.1
      if (hour >= 9 && hour <= 17) {
        // Meeting schedule probability
        const hasMeeting = Math.random() > 0.3
        if (hasMeeting) {
          // Equipment + occupancy
          return 0.7 + Math.random() * 0.3
        }
        return 0.2  // Empty room, just standby
      }
      return 0.15
    }

    // Open office - typical workday pattern
    if (roomType === 'open_office') {
      if (hour < 6) return 0.1  // Night mode
      if (hour >= 6 && hour < 8) return 0.3 + (hour - 6) * 0.15  // Early arrival
      if (hour >= 8 && hour < 9) return 0.7 + Math.random() * 0.2  // Boot storm
      if (hour >= 9 && hour < 12) return 0.85 + Math.random() * 0.15  // Morning work
      if (hour >= 12 && hour < 13) return 0.6  // Lunch break (some leave, AC reduces)
      if (hour >= 13 && hour < 17) return 0.9 + Math.random() * 0.1  // Afternoon peak
      if (isFriday && hour >= 14 && hour < 16) return 0.7  // Friday afternoon early leave
      if (hour >= 17 && hour < 19) return 0.5 - (hour - 17) * 0.1  // Evening wind-down
      if (hour >= 19 && hour <= 22) return 0.15  // Night mode
      return 0.1
    }

    // Closed office - similar to open office but slightly higher per capita
    if (roomType === 'closed_office') {
      if (hour < 6) return 0.1
      if (hour >= 6 && hour < 8) return 0.4 + (hour - 6) * 0.2
      if (hour >= 8 && hour < 9) return 0.8 + Math.random() * 0.15
      if (hour >= 9 && hour < 12) return 0.9 + Math.random() * 0.1
      if (hour >= 12 && hour < 14) return 0.65  // Longer lunch
      if (hour >= 14 && hour < 17) return 0.95 + Math.random() * 0.05
      if (isFriday && hour >= 15) return 0.6
      if (hour >= 17 && hour < 19) return 0.45 - (hour - 17) * 0.1
      return 0.1
    }

    return 0.5
  }

  updateAll(hour: number, dayOfWeek: number, dtHours: number): RoomLoadState[] {
    const states: RoomLoadState[] = []

    for (const room of this.rooms.values()) {
      const power = this.calculateOfficeLoad(room, hour, dayOfWeek)
      room.currentPowerKW = power
      room.energyKWh += power * dtHours

      states.push({
        roomId: room.roomId,
        roomName: room.roomName,
        powerKW: power,
        energyKWh: room.energyKWh,
        breakerStatus: room.breakerStatus,
      })
    }

    return states
  }

  getRoomStates(): RoomLoadState[] {
    return Array.from(this.rooms.values()).map((room) => ({
      roomId: room.roomId,
      roomName: room.roomName,
      powerKW: room.currentPowerKW,
      energyKWh: room.energyKWh,
      breakerStatus: room.breakerStatus,
    }))
  }

  getTotalLoad(): number {
    let total = 0
    for (const room of this.rooms.values()) {
      if (room.breakerStatus === 'closed') {
        total += room.currentPowerKW
      }
    }
    return total
  }

  resetDailyEnergy(): void {
    for (const room of this.rooms.values()) {
      room.energyKWh = 0
    }
  }
}
