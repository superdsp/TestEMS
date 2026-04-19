const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
let pool;
async function initDatabase() {
  pool = mysql.createPool({
    host: 'localhost',
    user: 'ems_user',
    password: 'ems_password_2024',
    database: 'ems_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  console.log('MySQL connected');
}

// ===== Simulation Config =====
const SPEED_MULTIPLIER = 24; // 1 hour = 1 day
const PEAK_PV_KW = 10;       // 10kW peak PV

// Room configs for 100 people office
const ROOM_CONFIGS = [
  { roomId: 'room-1', roomName: '开放办公区1', areaM2: 300, people: 40, baseLoadPerPerson: 0.08 },
  { roomId: 'room-2', roomName: '开放办公区2', areaM2: 300, people: 40, baseLoadPerPerson: 0.08 },
  { roomId: 'room-3', roomName: '独立办公室', areaM2: 100, people: 10, baseLoadPerPerson: 0.1 },
  { roomId: 'room-4', roomName: '会议室', areaM2: 80, people: 0, baseLoadPerPerson: 0 },
  { roomId: 'room-5', roomName: '机房', areaM2: 60, people: 2, baseLoadPerPerson: 2.5 },
  { roomId: 'room-6', roomName: '前台接待', areaM2: 40, people: 4, baseLoadPerPerson: 0.06 },
  { roomId: 'room-7', roomName: '茶水间', areaM2: 30, people: 0, baseLoadPerPerson: 0 },
  { roomId: 'room-8', roomName: '休息区', areaM2: 50, people: 4, baseLoadPerPerson: 0.05 },
];

// ===== Battery Model Config =====
const BATTERY_CONFIG = {
  capacityKWh: 50,
  maxSOC: 90,
  minSOC: 10,
  maxChargeKW: 10,
  maxDischargeKW: 10,
  efficiency: 0.95,
  initialSOC: 50,
};

const CELL_COUNT = 16;      // 串联数
const STRING_COUNT = 4;     // 并联数
const TOTAL_CELLS = CELL_COUNT * STRING_COUNT;
const INTERNAL_RESISTANCE_MOHM = 25;
const BALANCE_THRESHOLD_MV = 50;

// LiFePO4 SOC-Voltage curve: [voltage_mV, soc_percent]
const SOC_VOLTAGE_CURVE = [
  [2700, 0],
  [3100, 10],
  [3200, 20],
  [3250, 30],
  [3280, 40],
  [3310, 50],
  [3340, 60],
  [3370, 70],
  [3410, 80],
  [3460, 90],
  [3540, 100],
];

// ===== Battery State =====
let batteryState = {
  socPercent: BATTERY_CONFIG.initialSOC,
  powerKW: 0,
  temperatureC: 28,
  chargeCycles: 150,
  sohPercent: 98,
};

// Cell states
let cellVoltages = [];
let cellSOCs = [];
let cellTemps = [];
let cellBalanceStatus = [];
let cellBalanceDutyCycle = [];
let cellBaseVoltages = []; // SOC对应的基准电压

// Initialize cells
function initializeCells() {
  for (let s = 0; s < STRING_COUNT; s++) {
    for (let c = 0; c < CELL_COUNT; c++) {
      const idx = s * CELL_COUNT + c;
      const baseVoltage = interpolateSOCVoltage(batteryState.socPercent);
      // 初始电压 = 基准电压 + 小随机偏移
      cellVoltages.push(baseVoltage + (Math.random() - 0.5) * 30);
      cellSOCs.push(batteryState.socPercent + (Math.random() - 0.5) * 2);
      cellTemps.push(28 + (Math.random() - 0.5) * 2);
      cellBalanceStatus.push(false);
      cellBalanceDutyCycle.push(0);
      cellBaseVoltages.push(baseVoltage);
    }
  }
}

// SOC to Voltage interpolation
function interpolateSOCVoltage(soc) {
  soc = Math.max(0, Math.min(100, soc));
  for (let i = 0; i < SOC_VOLTAGE_CURVE.length - 1; i++) {
    const [v1, s1] = SOC_VOLTAGE_CURVE[i];
    const [v2, s2] = SOC_VOLTAGE_CURVE[i + 1];
    if (soc >= s1 && soc <= s2) {
      const ratio = (soc - s1) / (s2 - s1);
      return v1 + (v2 - v1) * ratio;
    }
  }
  return soc >= 100 ? 3540 : 2700;
}

// ===== Solar irradiance model (Shanghai) =====
function calculateSolarIrradiance(simHour) {
  const sunriseHour = 5.5;
  const sunsetHour = 18.5;
  if (simHour < sunriseHour || simHour > sunsetHour) {
    return 0;
  }
  const daylightHours = sunsetHour - sunriseHour;
  const normalizedHour = (simHour - sunriseHour) / daylightHours;
  const sunElevation = Math.sin(normalizedHour * Math.PI);
  const maxIrradiance = 850;
  const cloudFactor = 0.6 + Math.random() * 0.35;
  return Math.max(0, maxIrradiance * sunElevation * cloudFactor);
}

// ===== Room load model =====
function calculateRoomLoad(roomConfig, simHour, isWorkday) {
  if (roomConfig.breakerStatus === 'open') return 0;
  const { areaM2, people, baseLoadPerPerson } = roomConfig;
  let loadKW = 0;

  if (roomConfig.roomId === 'room-5') {
    return 5 + Math.random() * 0.5;
  }
  if (roomConfig.roomId === 'room-7') {
    if (simHour >= 6 && simHour <= 21) {
      return 1.5 + Math.random() * 0.5;
    }
    return 0.3;
  }

  if (!isWorkday) {
    return people * 0.02 + Math.random() * 0.2;
  }

  if (simHour < 6) {
    loadKW = people * 0.01;
  } else if (simHour < 8) {
    const factor = (simHour - 6) / 2;
    loadKW = people * baseLoadPerPerson * factor + Math.random() * 0.3;
  } else if (simHour < 12) {
    const factor = 0.85 + Math.sin((simHour - 8) * Math.PI / 8) * 0.15;
    loadKW = people * baseLoadPerPerson * factor + Math.random() * 0.5;
  } else if (simHour < 13) {
    loadKW = people * baseLoadPerPerson * 0.6 + Math.random() * 0.3;
  } else if (simHour < 18) {
    const factor = 0.9 + Math.sin((simHour - 13) * Math.PI / 10) * 0.1;
    loadKW = people * baseLoadPerPerson * factor + Math.random() * 0.5;
  } else if (simHour < 21) {
    const factor = Math.max(0, 1 - (simHour - 18) / 6);
    loadKW = people * baseLoadPerPerson * factor + Math.random() * 0.3;
  } else {
    loadKW = people * 0.02;
  }
  loadKW += areaM2 * 0.01;
  loadKW += areaM2 * 0.015;
  return Math.max(0.1, loadKW);
}

// ===== Battery Management =====
function manageBattery(dtHours, pvPower, totalLoad) {
  const netPower = pvPower - totalLoad;
  const { capacityKWh, maxSOC, minSOC, maxChargeKW, maxDischargeKW, efficiency } = BATTERY_CONFIG;
  let targetPower = 0;

  if (netPower > 0.5) {
    // Excess PV, charge battery
    targetPower = -Math.min(netPower * 0.8, maxChargeKW);
  } else if (netPower < -0.5) {
    // Deficit, discharge battery
    targetPower = Math.min(Math.abs(netPower) * 0.8, maxDischargeKW);
  }

  // SOC limit checks
  if (targetPower < 0 && batteryState.socPercent >= maxSOC) {
    targetPower = 0; // Full, can't charge more
  }
  if (targetPower > 0 && batteryState.socPercent <= minSOC) {
    targetPower = 0; // Empty, can't discharge
  }

  batteryState.powerKW = targetPower;

  // Update SOC based on energy change
  const energyChangeKWh = targetPower * dtHours * efficiency;
  const currentEnergyKWh = (batteryState.socPercent / 100) * capacityKWh;
  const newEnergyKWh = currentEnergyKWh + energyChangeKWh;
  batteryState.socPercent = Math.max(minSOC, Math.min(maxSOC, (newEnergyKWh / capacityKWh) * 100));

  // Update temperature
  batteryState.temperatureC = 25 + Math.abs(batteryState.powerKW) * 0.5 + Math.random() * 2;
}

// ===== Cell Voltage Update =====
function updateCells(dtHours) {
  if (cellVoltages.length === 0) {
    initializeCells();
  }

  const totalVoltage = cellVoltages.slice(0, CELL_COUNT).reduce((a, b) => a + b, 0) / 1000;
  const currentA = Math.abs(batteryState.powerKW * 1000 / totalVoltage);
  const isCharging = batteryState.powerKW < 0;

  // Base voltage from current SOC
  const baseVoltage = interpolateSOCVoltage(batteryState.socPercent);

  for (let i = 0; i < TOTAL_CELLS; i++) {
    // IR drop (voltage rise when charging, drop when discharging)
    const irDropMV = isCharging ? (currentA * INTERNAL_RESISTANCE_MOHM) / 1000 : -(currentA * INTERNAL_RESISTANCE_MOHM) / 1000;

    // Small random variation for realism
    const noise = (Math.random() - 0.5) * 10;

    // Update voltage based on SOC direction and IR drop
    if (isCharging) {
      cellVoltages[i] = baseVoltage + irDropMV + noise;
    } else if (batteryState.powerKW > 0) {
      cellVoltages[i] = baseVoltage + irDropMV + noise;
    } else {
      // Idle - voltage returns to base
      cellVoltages[i] = baseVoltage + (Math.random() - 0.5) * 5;
    }

    // Update SOC per cell (all cells in parallel string have same SOC direction)
    const socDelta = (batteryState.powerKW * dtHours * 1000) / BATTERY_CONFIG.capacityKWh * 100 / STRING_COUNT;
    if (isCharging) {
      cellSOCs[i] = Math.min(100, cellSOCs[i] + Math.abs(socDelta) * 0.1);
    } else if (batteryState.powerKW > 0) {
      cellSOCs[i] = Math.max(0, cellSOCs[i] - Math.abs(socDelta) * 0.1);
    }

    // Temperature variation
    cellTemps[i] = batteryState.temperatureC + (Math.random() - 0.5) * 2;

    // Cell balancing
    const avgVoltage = cellVoltages.reduce((a, b) => a + b, 0) / TOTAL_CELLS;
    const voltageDelta = cellVoltages[i] - avgVoltage;

    if (Math.abs(voltageDelta) > BALANCE_THRESHOLD_MV) {
      cellBalanceStatus[i] = true;
      cellBalanceDutyCycle[i] = Math.min(100, Math.abs(voltageDelta) * 2);
      // High voltage cells discharge slightly
      cellVoltages[i] -= voltageDelta * 0.005;
    } else {
      cellBalanceStatus[i] = false;
      cellBalanceDutyCycle[i] = 0;
    }

    // Clamp values
    cellVoltages[i] = Math.max(2700, Math.min(3600, cellVoltages[i]));
    cellSOCs[i] = Math.max(0, Math.min(100, cellSOCs[i]));
  }

  // Update charge cycles
  if (Math.abs(batteryState.powerKW) > 0.1) {
    // Simplified cycle tracking
  }
}

// ===== Simulation State =====
let simState = {
  pv: { powerKW: 0, voltage: 800, irradiance: 0 },
  battery: {
    socPercent: batteryState.socPercent,
    powerKW: batteryState.powerKW,
    temperatureC: batteryState.temperatureC,
    bms: {
      cellCount: CELL_COUNT,
      stringCount: STRING_COUNT,
      voltages: [],
      socValues: [],
      temps: [],
      balanceStatus: [],
      maxCellDeltaMV: 0,
      avgVoltage: 3.28,
      totalVoltage: 52.5,
      sohPercent: batteryState.sohPercent,
      chargeCycles: batteryState.chargeCycles,
    },
  },
  pcs: { status: 'idle', powerKW: 0, efficiency: 0.95 },
  grid: { powerKW: 0, voltage: 380 },
  rooms: ROOM_CONFIGS.map(r => ({ roomId: r.roomId, roomName: r.roomName, powerKW: 0, breakerStatus: 'closed' })),
  balance: { totalLoadKW: 0, pvPowerKW: 0, batteryPowerKW: 0, gridPowerKW: 0, systemEfficiency: 0.95 },
};

// ===== Main simulation update =====
let lastUpdateTime = Date.now();
let simDayCounter = 0;

function updateSimulation() {
  const now = Date.now();
  const dtMs = now - lastUpdateTime;
  const dtHours = dtMs / 3600000 * SPEED_MULTIPLIER;
  lastUpdateTime = now;

  const simHour = (simDayCounter % 24000) / 1000;
  simDayCounter += dtMs * SPEED_MULTIPLIER;

  const realDate = new Date();
  const dayOfWeek = realDate.getDay();
  const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;

  // Solar
  const irradiance = calculateSolarIrradiance(simHour);
  simState.pv.irradiance = irradiance;
  const pvFactor = irradiance / 850;
  simState.pv.powerKW = Math.max(0, PEAK_PV_KW * pvFactor * 0.18 * 5.5);

  // Room loads
  let totalLoad = 0;
  ROOM_CONFIGS.forEach((config, idx) => {
    const load = calculateRoomLoad({...config, breakerStatus: simState.rooms[idx]?.breakerStatus || 'closed'}, simHour, isWorkday);
    simState.rooms[idx].powerKW = load;
    totalLoad += load;
  });

  // Battery management
  manageBattery(dtHours, simState.pv.powerKW, totalLoad);

  // Update cells
  updateCells(dtHours);

  // Update BMS state
  const bms = simState.battery.bms;
  bms.voltages = [...cellVoltages];
  bms.socValues = [...cellSOCs];
  bms.temps = [...cellTemps];
  bms.balanceStatus = [...cellBalanceStatus];
  bms.maxCellDeltaMV = Math.max(...cellVoltages) - Math.min(...cellVoltages);
  bms.avgVoltage = cellVoltages.reduce((a, b) => a + b, 0) / TOTAL_CELLS / 1000;
  bms.totalVoltage = cellVoltages.slice(0, CELL_COUNT).reduce((a, b) => a + b, 0) / 1000;

  // Update battery state in simState
  simState.battery.socPercent = batteryState.socPercent;
  simState.battery.powerKW = batteryState.powerKW;
  simState.battery.temperatureC = batteryState.temperatureC;
  bms.sohPercent = batteryState.sohPercent;
  bms.chargeCycles = batteryState.chargeCycles;

  // Grid balance
  simState.grid.powerKW = totalLoad - simState.pv.powerKW - batteryState.powerKW;

  // Balance
  simState.balance.totalLoadKW = totalLoad;
  simState.balance.pvPowerKW = simState.pv.powerKW;
  simState.balance.batteryPowerKW = batteryState.powerKW;
  simState.balance.gridPowerKW = simState.grid.powerKW;
  simState.balance.systemEfficiency = 0.95;

  // PCS
  simState.pcs.powerKW = batteryState.powerKW;
  simState.pcs.status = Math.abs(batteryState.powerKW) > 0.1 ? 'running' : 'idle';
  simState.pcs.efficiency = 0.93 + Math.random() * 0.04;
}

// ===== Database storage =====
async function storeToDatabase() {
  if (!pool) return;
  const now = new Date();
  const bms = simState.battery.bms;
  try {
    const conn = await pool.getConnection();
    await conn.query('INSERT INTO telemetry_data (system_id, power_kw, voltage_dc, soc_percent, temperature_c, irradiance_wm2) VALUES (?, ?, ?, ?, ?, ?)', ['pv', simState.pv.powerKW, simState.pv.voltage, null, null, simState.pv.irradiance]);
    await conn.query('INSERT INTO telemetry_data (system_id, power_kw, voltage_dc, soc_percent, temperature_c) VALUES (?, ?, ?, ?, ?)', ['battery', batteryState.powerKW, bms.totalVoltage, batteryState.socPercent, batteryState.temperatureC]);
    await conn.query('INSERT INTO telemetry_data (system_id, power_kw, voltage_ac) VALUES (?, ?, ?)', ['pcs', simState.pcs.powerKW, 380]);
    await conn.query('INSERT INTO telemetry_data (system_id, power_kw, voltage_ac) VALUES (?, ?, ?)', ['grid', simState.grid.powerKW, simState.grid.voltage]);
    for (const room of simState.rooms) { await conn.query('INSERT INTO room_loads (room_id, room_name, power_kw, breaker_status) VALUES (?, ?, ?, ?)', [room.roomId, room.roomName, room.powerKW, room.breakerStatus]); }
    const maxTemp = bms.temps.filter(t => !isNaN(t)).length > 0 ? Math.max(...bms.temps.filter(t => !isNaN(t))) : 25; const avgTemp = bms.temps.filter(t => !isNaN(t)).length > 0 ? bms.temps.filter(t => !isNaN(t)).reduce((a, b) => a + b, 0) / bms.temps.filter(t => !isNaN(t)).length : 25; await conn.query('INSERT INTO bms_summary (total_voltage, soc_percent, soh_percent, max_cell_delta_mv, max_temperature_c, avg_temperature_c, charge_cycles, charge_power_kw, discharge_power_kw) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [bms.totalVoltage || 52.5, batteryState.socPercent || 50, bms.sohPercent || 98, bms.maxCellDeltaMV || 0, maxTemp, avgTemp, bms.chargeCycles || 0, batteryState.powerKW > 0 ? batteryState.powerKW : 0, batteryState.powerKW < 0 ? Math.abs(batteryState.powerKW) : 0]);
    await conn.query('INSERT INTO energy_balance (pv_power_kw, battery_power_kw, battery_soc, grid_power_kw, load_power_kw, system_efficiency) VALUES (?, ?, ?, ?, ?, ?)', [simState.balance.pvPowerKW, simState.balance.batteryPowerKW, batteryState.socPercent, simState.balance.gridPowerKW, simState.balance.totalLoadKW, simState.balance.systemEfficiency]);
    conn.release();
  } catch (err) { console.error('DB error:', err.message); }
}

// ===== API routes =====
app.get('/api/simulation', (req, res) => { res.json({ timestamp: Date.now(), ...simState }); });
app.get('/api/realtime', (req, res) => { res.json({ timestamp: Date.now(), ...simState, rooms: simState.rooms }); });
app.get('/api/history', async (req, res) => {
  const range = req.query.range || 'day';
  try {
    const conn = await pool.getConnection();
    const interval = range === 'week' ? '7 DAY' : range === 'month' ? '30 DAY' : range === 'year' ? '365 DAY' : '1 DAY';
    const [rows] = await conn.query('SELECT recorded_at as timestamp, AVG(pv_power_kw) as pv, AVG(battery_soc) as battery, AVG(load_power_kw) as load, AVG(grid_power_kw) as grid FROM energy_balance WHERE recorded_at > DATE_SUB(NOW(), INTERVAL ' + interval + ') GROUP BY HOUR(recorded_at), MINUTE(recorded_at) DIV 10 ORDER BY recorded_at');
    conn.release();
    res.json(rows);
  } catch (err) { res.json([]); }
});
app.get('/api/bms/cells', async (req, res) => { try { const conn = await pool.getConnection(); const [rows] = await conn.query('SELECT string_index, cell_index, voltage_mv, soc_percent, temperature_c, is_balancing, balance_duty_cycle FROM bms_cell_data ORDER BY recorded_at DESC LIMIT 64'); conn.release(); res.json(rows); } catch (err) { res.json([]); } });
app.get('/api/bms/summary', async (req, res) => { try { const conn = await pool.getConnection(); const [rows] = await conn.query('SELECT * FROM bms_summary ORDER BY recorded_at DESC LIMIT 1'); conn.release(); res.json(rows[0] || null); } catch (err) { res.json(null); } });
app.get('/api/health', (req, res) => { res.json({ status: 'ok', timestamp: Date.now() }); });

app.post('/api/breaker', (req, res) => {
  const { roomId, status } = req.body;
  const room = simState.rooms.find(r => r.roomId === roomId);
  if (!room) { return res.status(404).json({ error: 'Room not found' }); }
  room.breakerStatus = status;
  if (status === 'open') { room.powerKW = 0; }
  res.json({ success: true, room });
});

app.post('/api/breaker/all', (req, res) => {
  const { status } = req.body;
  simState.rooms.forEach(room => {
    room.breakerStatus = status;
    if (status === 'open') { room.powerKW = 0; }
  });
  res.json({ success: true, rooms: simState.rooms });
});

// ===== Start server =====
async function start() {
  await initDatabase();
  initializeCells();
  setInterval(() => { updateSimulation(); }, 1000);
  setInterval(() => { storeToDatabase(); }, 10000);
  app.listen(PORT, '0.0.0.0', () => { console.log('EMS Backend running on port ' + PORT + ' (1 hour = 1 day)'); });
}
start().catch(console.error);
