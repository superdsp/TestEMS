// Battery Model - 50kWh Energy Storage with 16S Cell Balancing

export interface CellConfig {
  nominalVoltageV: number      // 3.2V per cell
  capacityAh: number           // 280Ah per cell
  internalResistanceMOhm: number  // 25mΩ per cell
  cellsInSeries: number        // 16S
  stringsInParallel: number    // 4P
  balanceThresholdMV: number   // 50mV imbalance threshold
  balanceResistanceOhm: number  // 10Ω bypass resistance
}

export interface CellState {
  index: number
  voltageMV: number           // Current voltage in mV
  socPercent: number           // Individual cell SOC
  temperatureC: number        // Cell temperature
  resistanceMOhm: number       // Cell internal resistance
  isBalancing: boolean        // Whether bypass resistor is active
  balanceDutyCycle: number     // 0-100%
}

export interface BMSState {
  cellCount: number
  stringCount: number
  voltages: number[]           // Per-cell voltage (mV)
  socValues: number[]          // Per-cell SOC (%)
  temps: number[]               // Per-cell temperature (°C)
  balanceStatus: boolean[]     // Per-cell balancing active
  maxCellDeltaMV: number       // Max voltage difference
  avgVoltage: number           // Average cell voltage
  totalVoltage: number          // Total pack voltage
  sohPercent: number           // State of health
  chargeCycles: number         // Cycle count
}

export interface BatteryConfig {
  capacityKWh: number          // 50 kWh
  maxChargeRateKW: number      // 10 kW
  maxDischargeRateKW: number   // 10 kW
  minSOC: number              // 10%
  maxSOC: number              // 90%
  roundTripEfficiency: number  // 95%
  initialSOC: number          // 50%
  cellConfig: Partial<CellConfig>
}

export interface BatteryState {
  socPercent: number           // 0-100
  powerKW: number              // Positive = charging, negative = discharging
  temperatureC: number
  availableChargeKWh: number
  availableDischargeKWh: number
  status: 'charging' | 'discharging' | 'idle' | 'fault'
  bms: BMSState
}

// Cell voltage vs SOC lookup (LiFePO4 characteristic curve)
const VOLTAGE_SOC_CURVE: [number, number][] = [
  [2700, 0],    // 2.7V - 0% SOC
  [3100, 10],   // 3.1V - 10%
  [3200, 20],   // 3.2V - 20%
  [3250, 30],   // 3.25V - 30%
  [3280, 40],   // 3.28V - 40%
  [3310, 50],   // 3.31V - 50%
  [3340, 60],   // 3.34V - 60%
  [3370, 70],   // 3.37V - 70%
  [3410, 80],   // 3.41V - 80%
  [3460, 90],   // 3.46V - 90%
  [3540, 100],  // 3.54V - 100%
]

export class BatteryModel {
  private config: BatteryConfig
  private cellConfig: CellConfig
  private socPercent: number
  private temperatureC: number
  private cumulativeChargeKWh: number = 0
  private cumulativeDischargeKWh: number = 0
  private chargeCycles: number = 0
  private sohPercent: number = 100

  // Cell states (16S × 4P simulated as individual cells for BMS view)
  private cells: CellState[]

  constructor(config: Partial<BatteryConfig> = {}) {
    const defaultCellConfig: CellConfig = {
      nominalVoltageV: 3200,     // 3.2V nominal
      capacityAh: 280,           // 280Ah per cell
      internalResistanceMOhm: 25, // 25mΩ per cell
      cellsInSeries: 16,         // 16S configuration
      stringsInParallel: 4,     // 4P for capacity
      balanceThresholdMV: 50,    // 50mV trigger
      balanceResistanceOhm: 10,  // 10Ω bypass
    }

    this.cellConfig = { ...defaultCellConfig, ...config.cellConfig }

    this.config = {
      capacityKWh: 50,
      maxChargeRateKW: 10,
      maxDischargeRateKW: 10,
      minSOC: 10,
      maxSOC: 90,
      roundTripEfficiency: 0.95,
      initialSOC: 50,
      cellConfig: this.cellConfig,
      ...config,
    }

    this.socPercent = this.config.initialSOC
    this.temperatureC = 25

    // Initialize cell states
    this.cells = []
    const totalCells = this.cellConfig.cellsInSeries * this.cellConfig.stringsInParallel
    for (let i = 0; i < totalCells; i++) {
      this.cells.push({
        index: i,
        voltageMV: this.socToVoltage(this.config.initialSOC),
        socPercent: this.config.initialSOC,
        temperatureC: 25 + Math.random() * 2,
        resistanceMOhm: this.cellConfig.internalResistanceMOhm * (0.9 + Math.random() * 0.2),
        isBalancing: false,
        balanceDutyCycle: 0,
      })
    }
  }

  // Convert SOC to voltage using LiFePO4 curve
  private socToVoltage(soc: number): number {
    const socClamped = Math.max(0, Math.min(100, soc))
    for (let i = 0; i < VOLTAGE_SOC_CURVE.length - 1; i++) {
      const [v1, s1] = VOLTAGE_SOC_CURVE[i]
      const [v2, s2] = VOLTAGE_SOC_CURVE[i + 1]
      if (socClamped >= s1 && socClamped <= s2) {
        const ratio = (socClamped - s1) / (s2 - s1)
        return v1 + (v2 - v1) * ratio
      }
    }
    return socClamped >= 100 ? 3540 : 2700
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

    // Update cycle count
    if (this.cumulativeDischargeKWh >= capacityKWh) {
      this.chargeCycles++
      this.cumulativeDischargeKWh -= capacityKWh
    }

    // SOH degradation (very simplified)
    this.sohPercent = Math.max(80, 100 - this.chargeCycles * 0.01)

    // Temperature update (simplified - heat from losses + self-heating)
    const heatLosses = Math.abs(clampedPower) * (1 - efficiency) * 0.1
    this.temperatureC = 25 + heatLosses * dtHours * 10 + Math.random() * 0.5

    // ========== Cell-level simulation ==========
    const totalCells = this.cellConfig.cellsInSeries * this.cellConfig.stringsInParallel
    const chargeCurrentA = isCharging ? Math.abs(clampedPower * 1000 / (this.cellConfig.cellsInSeries * this.cellConfig.nominalVoltageV)) : 0

    for (let i = 0; i < totalCells; i++) {
      const cell = this.cells[i]

      // Add slight random variation to simulate real cell differences
      const cellVariation = (Math.random() - 0.5) * 20 // ±10mV variation

      // Voltage change based on current
      const voltageDropMV = (chargeCurrentA * cell.resistanceMOhm) / 1000
      const socDelta = (clampedPower * dtHours * 1000) / (capacityKWh * 1000) * 100 / this.cellConfig.stringsInParallel

      if (isCharging) {
        cell.voltageMV += voltageDropMV + cellVariation
        cell.socPercent = Math.min(100, cell.socPercent + socDelta)
      } else if (clampedPower < 0) {
        cell.voltageMV -= voltageDropMV + cellVariation
        cell.socPercent = Math.max(0, cell.socPercent - socDelta)
      }

      // Temperature variation between cells
      cell.temperatureC = this.temperatureC + (Math.random() - 0.5) * 2

      // Cell balancing simulation
      const avgVoltage = this.cells.reduce((sum, c) => sum + c.voltageMV, 0) / totalCells
      const voltageDelta = cell.voltageMV - avgVoltage

      if (Math.abs(voltageDelta) > this.cellConfig.balanceThresholdMV) {
        cell.isBalancing = true
        // Higher voltage cells get more balancing
        cell.balanceDutyCycle = Math.min(100, Math.abs(voltageDelta) * 2)
        // Balancing drains voltage slightly
        cell.voltageMV -= voltageDelta * 0.01
      } else {
        cell.isBalancing = false
        cell.balanceDutyCycle = 0
      }

      // Clamp cell voltages to safe range
      cell.voltageMV = Math.max(2700, Math.min(3600, cell.voltageMV))
      cell.socPercent = Math.max(0, Math.min(100, cell.socPercent))
    }

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

    // Build BMS state
    const voltages = this.cells.map(c => c.voltageMV)
    const socValues = this.cells.map(c => c.socPercent)
    const temps = this.cells.map(c => c.temperatureC)
    const balanceStatus = this.cells.map(c => c.isBalancing)
    const maxCellDeltaMV = Math.max(...voltages) - Math.min(...voltages)
    const avgVoltage = voltages.reduce((a, b) => a + b, 0) / voltages.length

    const bms: BMSState = {
      cellCount: this.cellConfig.cellsInSeries,
      stringCount: this.cellConfig.stringsInParallel,
      voltages,
      socValues,
      temps,
      balanceStatus,
      maxCellDeltaMV,
      avgVoltage,
      totalVoltage: voltages.reduce((a, b) => a + b, 0) / 1000, // Convert to V
      sohPercent: this.sohPercent,
      chargeCycles: this.chargeCycles,
    }

    return {
      socPercent: this.socPercent,
      powerKW: clampedPower,
      temperatureC: this.temperatureC,
      availableChargeKWh: maxEnergyKWh - currentEnergyKWh,
      availableDischargeKWh: currentEnergyKWh - minEnergyKWh,
      status,
      bms,
    }
  }

  getState(): BatteryState {
    const { capacityKWh, minSOC, maxSOC } = this.config
    const currentEnergyKWh = (this.socPercent / 100) * capacityKWh
    const minEnergyKWh = (minSOC / 100) * capacityKWh
    const maxEnergyKWh = (maxSOC / 100) * capacityKWh

    const voltages = this.cells.map(c => c.voltageMV)
    const socValues = this.cells.map(c => c.socPercent)
    const temps = this.cells.map(c => c.temperatureC)
    const balanceStatus = this.cells.map(c => c.isBalancing)
    const maxCellDeltaMV = Math.max(...voltages) - Math.min(...voltages)
    const avgVoltage = voltages.reduce((a, b) => a + b, 0) / voltages.length

    const bms: BMSState = {
      cellCount: this.cellConfig.cellsInSeries,
      stringCount: this.cellConfig.stringsInParallel,
      voltages,
      socValues,
      temps,
      balanceStatus,
      maxCellDeltaMV,
      avgVoltage,
      totalVoltage: voltages.reduce((a, b) => a + b, 0) / 1000,
      sohPercent: this.sohPercent,
      chargeCycles: this.chargeCycles,
    }

    return {
      socPercent: this.socPercent,
      powerKW: 0,
      temperatureC: this.temperatureC,
      availableChargeKWh: maxEnergyKWh - currentEnergyKWh,
      availableDischargeKWh: currentEnergyKWh - minEnergyKWh,
      status: 'idle',
      bms,
    }
  }

  getCapacity(): number {
    return this.config.capacityKWh
  }

  getSOC(): number {
    return this.socPercent
  }
}
