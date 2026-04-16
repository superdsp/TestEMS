// Photovoltaic (PV) Model - 10KW system

export interface PVModelConfig {
  peakPowerKW: number // 10 kW
  systemEfficiency: number // Panel efficiency (0.18 = 18%)
  temperatureCoefficient: number // -0.004 per °C above 25°C
  ambientTempC: number // Ambient temperature
}

export interface PVModelState {
  powerKW: number
  irradianceWM2: number
  temperatureC: number
  dailyEnergyKWh: number
}

export class PVModel {
  private config: PVModelConfig
  private state: PVModelState
  private dailyEnergyKWh: number = 0

  constructor(config: Partial<PVModelConfig> = {}) {
    this.config = {
      peakPowerKW: 10,
      systemEfficiency: 0.18,
      temperatureCoefficient: -0.004,
      ambientTempC: 25,
      ...config,
    }

    this.state = {
      powerKW: 0,
      irradianceWM2: 0,
      temperatureC: this.config.ambientTempC,
      dailyEnergyKWh: 0,
    }
  }

  /**
   * Calculate PV power output based on irradiance and temperature
   */
  calculate(irradianceWM2: number, ambientTempC: number, dtHours: number): number {
    const { peakPowerKW, systemEfficiency, temperatureCoefficient } = this.config

    // Temperature effect on panel temperature
    // Panel temp ≈ ambient temp + (irradiance / 800) * 25
    const panelTempC = ambientTempC + (irradianceWM2 / 800) * 25

    // Temperature derating: -0.4% per °C above 25°C
    const tempDerating = 1 + temperatureCoefficient * Math.max(0, panelTempC - 25)

    // Normalized irradiance (STC = 1000 W/m²)
    const STC_IRRADIANCE = 1000

    // Actual power output
    const powerKW =
      peakPowerKW * (irradianceWM2 / STC_IRRADIANCE) * systemEfficiency * tempDerating

    const clampedPower = Math.max(0, Math.min(peakPowerKW, powerKW))

    // Update state
    this.state = {
      powerKW: clampedPower,
      irradianceWM2,
      temperatureC: panelTempC,
      dailyEnergyKWh: this.dailyEnergyKWh,
    }

    // Accumulate daily energy
    this.dailyEnergyKWh += clampedPower * dtHours

    return clampedPower
  }

  getState(): PVModelState {
    return { ...this.state, dailyEnergyKWh: this.dailyEnergyKWh }
  }

  resetDailyEnergy(): void {
    this.dailyEnergyKWh = 0
  }

  getPeakPower(): number {
    return this.config.peakPowerKW
  }
}
