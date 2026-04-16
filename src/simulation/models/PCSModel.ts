// Power Conversion System (PCS) Model - 10KW, DC 800V / AC 380V

export interface PCSConfig {
  ratedPowerKW: number // 10 kW
  dcVoltageV: number // 800 V
  acVoltageV: number // 380 V
  baseEfficiency: number // 0.95
  startupTimeSec: number // 30 s
  shutdownTimeSec: number // 10 s
}

export interface PCSState {
  status: 'standby' | 'running' | 'fault' | 'starting' | 'stopping'
  powerKW: number // Positive = discharging (DC->AC), negative = charging (AC->DC)
  dcVoltageV: number
  acVoltageV: number
  efficiency: number
}

export class PCSModel {
  private config: PCSConfig
  private state: PCSState
  private targetPowerKW: number = 0
  private statusTransitionTime: number = 0

  constructor(config: Partial<PCSConfig> = {}) {
    this.config = {
      ratedPowerKW: 10,
      dcVoltageV: 800,
      acVoltageV: 380,
      baseEfficiency: 0.95,
      startupTimeSec: 30,
      shutdownTimeSec: 10,
      ...config,
    }

    this.state = {
      status: 'standby',
      powerKW: 0,
      dcVoltageV: this.config.dcVoltageV,
      acVoltageV: this.config.acVoltageV,
      efficiency: this.config.baseEfficiency,
    }
  }

  /**
   * Set target power setpoint
   */
  setTargetPower(powerKW: number): void {
    this.targetPowerKW = Math.max(-this.config.ratedPowerKW, Math.min(this.config.ratedPowerKW, powerKW))
  }

  /**
   * Start the PCS
   */
  start(): boolean {
    if (this.state.status === 'standby') {
      this.state.status = 'starting'
      this.statusTransitionTime = this.config.startupTimeSec * 1000
      return true
    }
    return false
  }

  /**
   * Stop the PCS
   */
  stop(): boolean {
    if (this.state.status === 'running') {
      this.state.status = 'stopping'
      this.statusTransitionTime = this.config.shutdownTimeSec * 1000
      return true
    }
    return false
  }

  /**
   * Update PCS state based on time elapsed
   * @param dtMs Time step in milliseconds
   */
  update(dtMs: number): PCSState {
    const { ratedPowerKW, baseEfficiency } = this.config

    // Handle status transitions
    if (this.state.status === 'starting') {
      this.statusTransitionTime -= dtMs
      if (this.statusTransitionTime <= 0) {
        this.state.status = 'running'
        this.state.powerKW = this.targetPowerKW
      }
    } else if (this.state.status === 'stopping') {
      this.statusTransitionTime -= dtMs
      if (this.statusTransitionTime <= 0) {
        this.state.status = 'standby'
        this.state.powerKW = 0
      }
    } else if (this.state.status === 'running') {
      // Smoothly ramp to target power
      const powerDiff = this.targetPowerKW - this.state.powerKW
      const maxRampRate = ratedPowerKW * 0.1 * (dtMs / 1000) // 10% per second max ramp
      this.state.powerKW += Math.max(-maxRampRate, Math.min(maxRampRate, powerDiff))

      // Calculate efficiency based on load ratio
      const loadRatio = Math.abs(this.state.powerKW) / ratedPowerKW
      this.state.efficiency = baseEfficiency * (0.98 + 0.02 * loadRatio)
    }

    return { ...this.state }
  }

  getState(): PCSState {
    return { ...this.state }
  }

  isReady(): boolean {
    return this.state.status === 'running' || this.state.status === 'standby'
  }
}
