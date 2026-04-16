// Battery Model - 50kWh Energy Storage

export interface BatteryConfig {
  capacityKWh: number // 50 kWh
  maxChargeRateKW: number // 10 kW
  maxDischargeRateKW: number // 10 kW
  minSOC: number // 10%
  maxSOC: number // 90%
  roundTripEfficiency: number // 95%
  initialSOC: number // 50%
}

export interface BatteryState {
  socPercent: number // 0-100
  powerKW: number // Positive = charging, negative = discharging
  temperatureC: number
  availableChargeKWh: number
  availableDischargeKWh: number
  status: 'charging' | 'discharging' | 'idle' | 'fault'
}

export class BatteryModel {
  private config: BatteryConfig
  private socPercent: number
  private temperatureC: number
  private cumulativeChargeKWh: number = 0
  private cumulativeDischargeKWh: number = 0

  constructor(config: Partial<BatteryConfig> = {}) {
    this.config = {
      capacityKWh: 50,
      maxChargeRateKW: 10,
      maxDischargeRateKW: 10,
      minSOC: 10,
      maxSOC: 90,
      roundTripEfficiency: 0.95,
      initialSOC: 50,
      ...config,
    }

    this.socPercent = this.config.initialSOC
    this.temperatureC = 25
  }

  /**
   * Update battery state based on power flow
   * @param targetPowerKW Positive = charge, negative = discharge
   * @param dtHours Time step in hours
   */
  update(targetPowerKW: number, dtHours: number): BatteryState {
    const {
      capacityKWh,
      maxChargeRateKW,
      maxDischargeRateKW,
      minSOC,
      maxSOC,
      roundTripEfficiency,
    } = this.config

    // Clamp power to limits
    const clampedPower = Math.max(
      -maxDischargeRateKW,
      Math.min(maxChargeRateKW, targetPowerKW)
    )

    // Determine if charging or discharging
    const isCharging = clampedPower > 0

    // Efficiency factor (square root for round-trip efficiency split between charge/discharge)
    const efficiency = isCharging
      ? Math.sqrt(roundTripEfficiency)
      : 1 / Math.sqrt(roundTripEfficiency)

    // Energy change considering efficiency
    const energyChangeKWh = clampedPower * dtHours * efficiency

    // Current available energy in kWh
    const currentEnergyKWh = (this.socPercent / 100) * capacityKWh

    // Calculate new SOC
    let newEnergyKWh = currentEnergyKWh + energyChangeKWh
    let newSOC = (newEnergyKWh / capacityKWh) * 100

    // Clamp SOC to limits
    newSOC = Math.max(minSOC, Math.min(maxSOC, newSOC))
    this.socPercent = newSOC

    // Recalculate actual energy change after clamping
    const actualEnergyKWh = (newSOC / 100) * capacityKWh - currentEnergyKWh

    // Update cumulative energy
    if (actualEnergyKWh > 0) {
      this.cumulativeChargeKWh += actualEnergyKWh
    } else {
      this.cumulativeDischargeKWh += Math.abs(actualEnergyKWh)
    }

    // Temperature update (simplified - heat from losses)
    const heatLosses = Math.abs(clampedPower) * (1 - efficiency) * 0.1
    this.temperatureC = 25 + heatLosses * dtHours * 10

    // Determine status
    let status: BatteryState['status'] = 'idle'
    if (Math.abs(clampedPower) < 0.1) {
      status = 'idle'
    } else if (isCharging) {
      status = 'charging'
    } else {
      status = 'discharging'
    }

    // Calculate available charge/discharge
    const minEnergyKWh = (minSOC / 100) * capacityKWh
    const maxEnergyKWh = (maxSOC / 100) * capacityKWh

    return {
      socPercent: this.socPercent,
      powerKW: clampedPower,
      temperatureC: this.temperatureC,
      availableChargeKWh: maxEnergyKWh - currentEnergyKWh,
      availableDischargeKWh: currentEnergyKWh - minEnergyKWh,
      status,
    }
  }

  getState(): BatteryState {
    const { capacityKWh, minSOC, maxSOC } = this.config
    const currentEnergyKWh = (this.socPercent / 100) * capacityKWh
    const minEnergyKWh = (minSOC / 100) * capacityKWh
    const maxEnergyKWh = (maxSOC / 100) * capacityKWh

    return {
      socPercent: this.socPercent,
      powerKW: 0,
      temperatureC: this.temperatureC,
      availableChargeKWh: maxEnergyKWh - currentEnergyKWh,
      availableDischargeKWh: currentEnergyKWh - minEnergyKWh,
      status: 'idle',
    }
  }

  getCapacity(): number {
    return this.config.capacityKWh
  }

  getSOC(): number {
    return this.socPercent
  }
}
