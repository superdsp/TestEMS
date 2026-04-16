// Energy System Types

export type SystemType = 'pv' | 'battery' | 'pcs' | 'grid' | 'load'

export interface EnergySystem {
  id: string
  system_type: SystemType
  name: string
  capacity_kw: number
  capacity_kwh: number | null
  rated_voltage_dc: number | null
  rated_voltage_ac: number | null
  efficiency: number
  min_soc: number | null
  max_soc: number | null
  operational_status: 'standby' | 'running' | 'fault' | 'offline'
  created_at: string
  updated_at: string
}

export interface TelemetryData {
  id: number
  system_id: string
  recorded_at: string
  power_kw: number
  voltage_dc: number | null
  voltage_ac: number | null
  current_amp: number | null
  soc_percent: number | null
  temperature_c: number | null
  irradiance_wm2: number | null
  cumulative_energy_kwh: number
  metadata: Record<string, unknown>
}

export interface Room {
  id: string
  name: string
  area_m2: number
  created_at: string
}

export interface CircuitBreaker {
  id: string
  room_id: string
  name: string
  rated_current_amp: number
  status: 'online' | 'offline'
  breaker_status: 'closed' | 'open'
  created_at: string
}

export interface RoomTelemetry {
  id: number
  room_id: string
  circuit_breaker_id: string
  recorded_at: string
  power_kw: number
  voltage_v: number
  current_amp: number
  energy_kwh: number
}

export type CommandType =
  | 'pcs_start'
  | 'pcs_stop'
  | 'set_charge_power'
  | 'set_discharge_power'
  | 'emergency_stop'
  | 'breaker_close'
  | 'breaker_open'

export interface ControlCommand {
  id: string
  system_id: string | null
  breaker_id: string | null
  command_type: CommandType
  command_payload: Record<string, unknown>
  issued_by: string
  issued_at: string
  executed_at: string | null
  status: 'pending' | 'executing' | 'completed' | 'failed'
  result_message: string | null
}

export interface AlarmEvent {
  id: number
  system_id: string | null
  room_id: string | null
  alarm_type: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  trigger_value: number
  threshold_value: number
  acknowledged: boolean
  acknowledged_by: string | null
  acknowledged_at: string | null
  created_at: string
}

export interface EnergyBalance {
  id: number
  recorded_at: string
  pv_power_kw: number
  battery_power_kw: number
  battery_soc: number
  grid_power_kw: number
  load_power_kw: number
  system_efficiency: number
}

export interface RoomLoadSnapshot {
  roomId: string
  roomName: string
  powerKW: number
  energyKWh: number
  breakerStatus: 'closed' | 'open'
}

export interface SystemSnapshot {
  timestamp: number
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
  balance: {
    totalLoadKW: number
    pvPowerKW: number
    batteryPowerKW: number
    gridPowerKW: number
    systemEfficiency: number
  }
}
