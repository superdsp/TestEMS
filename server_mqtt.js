const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const mqtt = require('mqtt');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
let pool;

// ===== Configuration =====
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://106.14.31.17:1883';
const DATA_MODE = process.env.DATA_MODE || 'simulation'; // 'simulation' or 'mqtt'

// ===== MySQL Database =====
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
<<<<<<< Updated upstream
const SPEED_MULTIPLIER = 24;
=======
const SPEED_MULTIPLIER = 3600;  // 1 real second = 1 simulated hour
>>>>>>> Stashed changes
const PEAK_PV_KW = 10;

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

// Battery Model Config
const BATTERY_CONFIG = {
  capacityKWh: 50,
  maxSOC: 90,
  minSOC: 10,
  maxChargeKW: 10,
  maxDischargeKW: 10,
  efficiency: 0.95,
  initialSOC: 50,
};

const CELL_COUNT = 16;
const STRING_COUNT = 4;
const TOTAL_CELLS = CELL_COUNT * STRING_COUNT;
const INTERNAL_RESISTANCE_MOHM = 25;
const BALANCE_THRESHOLD_MV = 50;

const SOC_VOLTAGE_CURVE = [
  [2700, 0], [3100, 10], [3200, 20], [3250, 30], [3280, 40],
  [3310, 50], [3340, 60], [3370, 70], [3410, 80], [3460, 90], [3540, 100],
];

// ===== Battery State =====
let batteryState = {
  socPercent: BATTERY_CONFIG.initialSOC,
  powerKW: 0,
  temperatureC: 28,
  chargeCycles: 150,
  sohPercent: 98,
};

let cellVoltages = [];
let cellSOCs = [];
let cellTemps = [];
let cellBalanceStatus = [];
let cellBalanceDutyCycle = [];

function initializeCells() {
  for (let s = 0; s < STRING_COUNT; s++) {
    for (let c = 0; c < CELL_COUNT; c++) {
      const idx = s * CELL_COUNT + c;
      const baseVoltage = interpolateSOCVoltage(batteryState.socPercent);
      cellVoltages.push(baseVoltage + (Math.random() - 0.5) * 30);
      cellSOCs.push(batteryState.socPercent + (Math.random() - 0.5) * 2);
      cellTemps.push(28 + (Math.random() - 0.5) * 2);
      cellBalanceStatus.push(false);
      cellBalanceDutyCycle.push(0);
    }
  }
}

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

// ===== Solar Model =====
function calculateSolarIrradiance(simHour) {
  const sunriseHour = 5.5, sunsetHour = 18.5;
  if (simHour < sunriseHour || simHour > sunsetHour) return 0;
  const daylightHours = sunsetHour - sunriseHour;
  const normalizedHour = (simHour - sunriseHour) / daylightHours;
  const sunElevation = Math.sin(normalizedHour * Math.PI);
  const maxIrradiance = 850;
  const cloudFactor = 0.6 + Math.random() * 0.35;
  return Math.max(0, maxIrradiance * sunElevation * cloudFactor);
}

// ===== Room Load Model =====
function calculateRoomLoad(roomConfig, simHour, isWorkday) {
  if (roomConfig.breakerStatus === 'open') return 0;
  const { areaM2, people, baseLoadPerPerson } = roomConfig;
  let loadKW = 0;

  if (roomConfig.roomId === 'room-5') return 5 + Math.random() * 0.5;
  if (roomConfig.roomId === 'room-7') {
    return (simHour >= 6 && simHour <= 21) ? 1.5 + Math.random() * 0.5 : 0.3;
  }

  if (!isWorkday) return people * 0.02 + Math.random() * 0.2;

  if (simHour < 6) loadKW = people * 0.01;
  else if (simHour < 8) {
    const factor = (simHour - 6) / 2;
    loadKW = people * baseLoadPerPerson * factor + Math.random() * 0.3;
  } else if (simHour < 12) {
    const factor = 0.85 + Math.sin((simHour - 8) * Math.PI / 8) * 0.15;
    loadKW = people * baseLoadPerPerson * factor + Math.random() * 0.5;
  } else if (simHour < 13) loadKW = people * baseLoadPerPerson * 0.6 + Math.random() * 0.3;
  else if (simHour < 18) {
    const factor = 0.9 + Math.sin((simHour - 13) * Math.PI / 10) * 0.1;
    loadKW = people * baseLoadPerPerson * factor + Math.random() * 0.5;
  } else if (simHour < 21) {
    const factor = Math.max(0, 1 - (simHour - 18) / 6);
    loadKW = people * baseLoadPerPerson * factor + Math.random() * 0.3;
  } else loadKW = people * 0.02;

  loadKW += areaM2 * 0.01 + areaM2 * 0.015;
  return Math.max(0.1, loadKW);
}

// ===== Battery Management =====
function manageBattery(dtHours, pvPower, totalLoad) {
  const netPower = pvPower - totalLoad;
  const { capacityKWh, maxSOC, minSOC, maxChargeKW, maxDischargeKW, efficiency } = BATTERY_CONFIG;
  let targetPower = 0;

  if (netPower > 0.5) targetPower = -Math.min(netPower * 0.8, maxChargeKW);
  else if (netPower < -0.5) targetPower = Math.min(Math.abs(netPower) * 0.8, maxDischargeKW);

  if (targetPower < 0 && batteryState.socPercent >= maxSOC) targetPower = 0;
  if (targetPower > 0 && batteryState.socPercent <= minSOC) targetPower = 0;

  batteryState.powerKW = targetPower;
  const energyChangeKWh = targetPower * dtHours * efficiency;
  const currentEnergyKWh = (batteryState.socPercent / 100) * capacityKWh;
  const newEnergyKWh = currentEnergyKWh + energyChangeKWh;
  batteryState.socPercent = Math.max(minSOC, Math.min(maxSOC, (newEnergyKWh / capacityKWh) * 100));
  batteryState.temperatureC = 25 + Math.abs(batteryState.powerKW) * 0.5 + Math.random() * 2;
}

// ===== Cell Update =====
function updateCells(dtHours) {
  if (cellVoltages.length === 0) initializeCells();

  const totalVoltage = cellVoltages.slice(0, CELL_COUNT).reduce((a, b) => a + b, 0) / 1000;
  const currentA = Math.abs(batteryState.powerKW * 1000 / totalVoltage);
  const isCharging = batteryState.powerKW < 0;
  const baseVoltage = interpolateSOCVoltage(batteryState.socPercent);

  for (let i = 0; i < TOTAL_CELLS; i++) {
    const irDropMV = isCharging ? (currentA * INTERNAL_RESISTANCE_MOHM) / 1000 : -(currentA * INTERNAL_RESISTANCE_MOHM) / 1000;
    const noise = (Math.random() - 0.5) * 10;

    if (isCharging) cellVoltages[i] = baseVoltage + irDropMV + noise;
    else if (batteryState.powerKW > 0) cellVoltages[i] = baseVoltage + irDropMV + noise;
    else cellVoltages[i] = baseVoltage + (Math.random() - 0.5) * 5;

    const socDelta = (batteryState.powerKW * dtHours * 1000) / BATTERY_CONFIG.capacityKWh * 100 / STRING_COUNT;
    if (isCharging) cellSOCs[i] = Math.min(100, cellSOCs[i] + Math.abs(socDelta) * 0.1);
    else if (batteryState.powerKW > 0) cellSOCs[i] = Math.max(0, cellSOCs[i] - Math.abs(socDelta) * 0.1);

    cellTemps[i] = batteryState.temperatureC + (Math.random() - 0.5) * 2;

    const avgVoltage = cellVoltages.reduce((a, b) => a + b, 0) / TOTAL_CELLS;
    const voltageDelta = cellVoltages[i] - avgVoltage;

    if (Math.abs(voltageDelta) > BALANCE_THRESHOLD_MV) {
      cellBalanceStatus[i] = true;
      cellBalanceDutyCycle[i] = Math.min(100, Math.abs(voltageDelta) * 2);
      cellVoltages[i] -= voltageDelta * 0.005;
    } else {
      cellBalanceStatus[i] = false;
      cellBalanceDutyCycle[i] = 0;
    }

    cellVoltages[i] = Math.max(2700, Math.min(3600, cellVoltages[i]));
    cellSOCs[i] = Math.max(0, Math.min(100, cellSOCs[i]));
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
      cellCount: CELL_COUNT, stringCount: STRING_COUNT,
      voltages: [], socValues: [], temps: [], balanceStatus: [],
      maxCellDeltaMV: 0, avgVoltage: 3.28, totalVoltage: 52.5,
      sohPercent: batteryState.sohPercent, chargeCycles: batteryState.chargeCycles,
    },
  },
  pcs: { status: 'idle', powerKW: 0, efficiency: 0.95 },
  grid: { powerKW: 0, voltage: 380 },
  rooms: ROOM_CONFIGS.map(r => ({ roomId: r.roomId, roomName: r.roomName, powerKW: 0, breakerStatus: 'closed' })),
  balance: { totalLoadKW: 0, pvPowerKW: 0, batteryPowerKW: 0, gridPowerKW: 0, systemEfficiency: 0.95 },
};

// ===== MQTT =====
let mqttClient = null;
let dataMode = DATA_MODE;

function connectMQTT() {
  console.log('Connecting to MQTT broker:', MQTT_BROKER);
  mqttClient = mqtt.connect(MQTT_BROKER);

  mqttClient.on('connect', () => {
    console.log('MQTT connected');
    mqttClient.subscribe('ems/#', (err) => {
      if (!err) console.log('Subscribed to ems/#');
    });
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      console.log('MQTT received:', topic);
      updateFromMQTT(topic, payload);
    } catch (e) {
      console.error('MQTT parse error:', e.message);
    }
  });

  mqttClient.on('error', (err) => {
    console.error('MQTT error:', err.message);
  });
}

function updateFromMQTT(topic, payload) {
  dataMode = 'mqtt';

<<<<<<< Updated upstream
=======
  // 处理模拟时间
  if (topic === 'ems/simtime') {
    if (payload.simHour !== undefined && payload.simDay !== undefined) {
      const day = payload.simDay || 1;
      const hour = payload.simHour;
      simDayCounter = (day - 1) * 24 + hour;  // 转换为小时
    }
    return;
  }

>>>>>>> Stashed changes
  if (topic === 'ems/pv' || topic.startsWith('ems/pv/')) {
    if (payload.powerKW !== undefined) simState.pv.powerKW = payload.powerKW;
    if (payload.voltage !== undefined) simState.pv.voltage = payload.voltage;
    if (payload.irradiance !== undefined) simState.pv.irradiance = payload.irradiance;
  }

  if (topic === 'ems/battery' || topic.startsWith('ems/battery/')) {
    if (payload.socPercent !== undefined) {
      batteryState.socPercent = payload.socPercent;
      simState.battery.socPercent = payload.socPercent;
    }
    if (payload.powerKW !== undefined) {
      batteryState.powerKW = payload.powerKW;
      simState.battery.powerKW = payload.powerKW;
    }
    if (payload.temperatureC !== undefined) {
      batteryState.temperatureC = payload.temperatureC;
      simState.battery.temperatureC = payload.temperatureC;
    }
    if (payload.bms) {
      const bms = simState.battery.bms;
      if (payload.bms.voltages) bms.voltages = payload.bms.voltages;
      if (payload.bms.socValues) bms.socValues = payload.bms.socValues;
      if (payload.bms.temps) bms.temps = payload.bms.temps;
      if (payload.bms.balanceStatus) bms.balanceStatus = payload.bms.balanceStatus;
    }
  }

<<<<<<< Updated upstream
=======
  // 处理 ems/battery/bms 独立topic
  if (topic === 'ems/battery/bms') {
    const bms = simState.battery.bms;
    if (payload.cellCount) bms.cellCount = payload.cellCount;
    if (payload.stringCount) bms.stringCount = payload.stringCount;
    if (payload.voltages) bms.voltages = payload.voltages;
    if (payload.socValues) bms.socValues = payload.socValues;
    if (payload.temps) bms.temps = payload.temps;
    if (payload.balanceStatus) bms.balanceStatus = payload.balanceStatus;
    if (payload.balanceDutyCycle) bms.balanceDutyCycle = payload.balanceDutyCycle;
    if (payload.maxCellDeltaMV !== undefined) bms.maxCellDeltaMV = payload.maxCellDeltaMV;
    if (payload.avgVoltage !== undefined) bms.avgVoltage = payload.avgVoltage;
    if (payload.totalVoltage !== undefined) bms.totalVoltage = payload.totalVoltage;
  }

  // 处理 ems/pcs topic
  if (topic === 'ems/pcs' || topic.startsWith('ems/pcs/')) {
    if (payload.status !== undefined) simState.pcs.status = payload.status;
    if (payload.powerKW !== undefined) simState.pcs.powerKW = payload.powerKW;
    if (payload.efficiency !== undefined) simState.pcs.efficiency = payload.efficiency;
  }

>>>>>>> Stashed changes
  if (topic === 'ems/grid' || topic.startsWith('ems/grid/')) {
    if (payload.powerKW !== undefined) simState.grid.powerKW = payload.powerKW;
    if (payload.voltage !== undefined) simState.grid.voltage = payload.voltage;
  }

  if (topic === 'ems/rooms' || topic.startsWith('ems/rooms/')) {
    if (Array.isArray(payload)) {
      payload.forEach((room, i) => {
        if (simState.rooms[i]) {
          simState.rooms[i].powerKW = room.powerKW || 0;
        }
      });
    }
  }

<<<<<<< Updated upstream
  // Recalculate balance
  const totalLoad = simState.rooms.reduce((sum, r) => sum + r.powerKW, 0);
  simState.balance.totalLoadKW = totalLoad;
  simState.balance.pvPowerKW = simState.pv.powerKW;
  simState.balance.batteryPowerKW = batteryState.powerKW;
  simState.balance.gridPowerKW = totalLoad - simState.pv.powerKW - batteryState.powerKW;
  simState.grid.powerKW = simState.balance.gridPowerKW;
=======
  if (topic === 'ems/balance' || topic.startsWith('ems/balance/')) {
    if (payload.totalLoadKW !== undefined) simState.balance.totalLoadKW = payload.totalLoadKW;
    if (payload.pvPowerKW !== undefined) simState.balance.pvPowerKW = payload.pvPowerKW;
    if (payload.batteryPowerKW !== undefined) {
      simState.balance.batteryPowerKW = payload.batteryPowerKW;
    }
    if (payload.gridPowerKW !== undefined) {
      simState.balance.gridPowerKW = payload.gridPowerKW;
      simState.grid.powerKW = payload.gridPowerKW;
    }
    if (payload.systemEfficiency !== undefined) simState.balance.systemEfficiency = payload.systemEfficiency;
  }

  // 如果没有收到 pcs 数据，根据 battery.powerKW 计算
  if (!simState.pcs || simState.pcs.powerKW === 0) {
    if (batteryState.powerKW > 0) {
      // 放电: DC→AC
      simState.pcs = {
        status: 'discharging',
        powerKW: batteryState.powerKW * 0.95,
        efficiency: 0.95
      };
    } else if (batteryState.powerKW < 0) {
      // 充电: AC→DC
      simState.pcs = {
        status: 'charging',
        powerKW: batteryState.powerKW / 0.95,
        efficiency: 0.95
      };
    } else {
      simState.pcs = {
        status: 'idle',
        powerKW: 0,
        efficiency: 0.95
      };
    }
  }
>>>>>>> Stashed changes
}

// ===== Simulation Update =====
let lastUpdateTime = Date.now();
let simDayCounter = 0;

function updateSimulation() {
<<<<<<< Updated upstream
  if (dataMode === 'mqtt') return; // Skip simulation if receiving MQTT data

  const now = Date.now();
  const dtMs = now - lastUpdateTime;
  const dtHours = dtMs / 3600000 * SPEED_MULTIPLIER;
  lastUpdateTime = now;

  const simHour = (simDayCounter % 24000) / 1000;
  simDayCounter += dtMs * SPEED_MULTIPLIER;
=======
  const now = Date.now();
  const dtMs = now - lastUpdateTime;
  lastUpdateTime = now;

  let dtHours = 0;

  // Only update simDayCounter from real time in simulation mode
  // In mqtt mode, simDayCounter is set from MQTT messages
  if (dataMode !== 'mqtt') {
    dtHours = dtMs / 3600000 * SPEED_MULTIPLIER;
    simDayCounter += dtHours;
  }

  if (dataMode === 'mqtt') return; // Skip simulation model if receiving MQTT data

  const simHour = (simDayCounter % 24);
>>>>>>> Stashed changes

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

  // Battery
  manageBattery(dtHours, simState.pv.powerKW, totalLoad);
  updateCells(dtHours);

  // Update BMS
  const bms = simState.battery.bms;
  bms.voltages = [...cellVoltages];
  bms.socValues = [...cellSOCs];
  bms.temps = [...cellTemps];
  bms.balanceStatus = [...cellBalanceStatus];
  bms.maxCellDeltaMV = Math.max(...cellVoltages) - Math.min(...cellVoltages);
  bms.avgVoltage = cellVoltages.reduce((a, b) => a + b, 0) / TOTAL_CELLS / 1000;
  bms.totalVoltage = cellVoltages.slice(0, CELL_COUNT).reduce((a, b) => a + b, 0) / 1000;

  simState.battery.socPercent = batteryState.socPercent;
  simState.battery.powerKW = batteryState.powerKW;
  simState.battery.temperatureC = batteryState.temperatureC;
  bms.sohPercent = batteryState.sohPercent;
  bms.chargeCycles = batteryState.chargeCycles;

  // Balance
  simState.grid.powerKW = totalLoad - simState.pv.powerKW - batteryState.powerKW;
  simState.balance.totalLoadKW = totalLoad;
  simState.balance.pvPowerKW = simState.pv.powerKW;
  simState.balance.batteryPowerKW = batteryState.powerKW;
  simState.balance.gridPowerKW = simState.grid.powerKW;

  simState.pcs.powerKW = batteryState.powerKW;
  simState.pcs.status = Math.abs(batteryState.powerKW) > 0.1 ? 'running' : 'idle';
  simState.pcs.efficiency = 0.93 + Math.random() * 0.04;
}

// ===== Database Storage =====
async function storeToDatabase() {
  if (!pool) return;
  const now = new Date();
  const bms = simState.battery.bms;
  try {
    const conn = await pool.getConnection();
    await conn.query('INSERT INTO telemetry_data (system_id, power_kw, voltage_dc, soc_percent, temperature_c, irradiance_wm2) VALUES (?, ?, ?, ?, ?, ?)',
      ['pv', simState.pv.powerKW, simState.pv.voltage, null, null, simState.pv.irradiance]);
    await conn.query('INSERT INTO telemetry_data (system_id, power_kw, voltage_dc, soc_percent, temperature_c) VALUES (?, ?, ?, ?, ?)',
      ['battery', batteryState.powerKW, bms.totalVoltage, batteryState.socPercent, batteryState.temperatureC]);
    await conn.query('INSERT INTO telemetry_data (system_id, power_kw, voltage_ac) VALUES (?, ?, ?)',
      ['pcs', simState.pcs.powerKW, 380]);
    await conn.query('INSERT INTO telemetry_data (system_id, power_kw, voltage_ac) VALUES (?, ?, ?)',
      ['grid', simState.grid.powerKW, simState.grid.voltage]);
    for (const room of simState.rooms) {
      await conn.query('INSERT INTO room_loads (room_id, room_name, power_kw, breaker_status) VALUES (?, ?, ?, ?)',
        [room.roomId, room.roomName, room.powerKW, room.breakerStatus]);
    }
    const maxTemp = bms.temps.filter(t => !isNaN(t)).length > 0 ? Math.max(...bms.temps.filter(t => !isNaN(t))) : 25;
    const avgTemp = bms.temps.filter(t => !isNaN(t)).length > 0 ? bms.temps.filter(t => !isNaN(t)).reduce((a, b) => a + b, 0) / bms.temps.filter(t => !isNaN(t)).length : 25;
    await conn.query('INSERT INTO bms_summary (total_voltage, soc_percent, soh_percent, max_cell_delta_mv, max_temperature_c, avg_temperature_c, charge_cycles, charge_power_kw, discharge_power_kw) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [bms.totalVoltage || 52.5, batteryState.socPercent || 50, bms.sohPercent || 98, bms.maxCellDeltaMV || 0, maxTemp, avgTemp, bms.chargeCycles || 0, batteryState.powerKW > 0 ? batteryState.powerKW : 0, batteryState.powerKW < 0 ? Math.abs(batteryState.powerKW) : 0]);
    await conn.query('INSERT INTO energy_balance (pv_power_kw, battery_power_kw, battery_soc, grid_power_kw, load_power_kw, system_efficiency) VALUES (?, ?, ?, ?, ?, ?)',
      [simState.balance.pvPowerKW, simState.balance.batteryPowerKW, batteryState.socPercent, simState.balance.gridPowerKW, simState.balance.totalLoadKW, simState.balance.systemEfficiency]);
    conn.release();
  } catch (err) { console.error('DB error:', err.message); }
}

// ===== API Routes =====
app.get('/api/simulation', (req, res) => {
<<<<<<< Updated upstream
  res.json({ timestamp: Date.now(), source: dataMode, ...simState });
});

app.get('/api/realtime', (req, res) => {
  res.json({ timestamp: Date.now(), source: dataMode, ...simState, rooms: simState.rooms });
});

=======
  res.json({ timestamp: Date.now(), source: dataMode, simTime: getSimTime(), ...simState });
});

app.get('/api/realtime', (req, res) => {
  res.json({ timestamp: Date.now(), source: dataMode, simTime: getSimTime(), ...simState, rooms: simState.rooms });
});

function getSimTime() {
  const totalHours = simDayCounter;  // simDayCounter is in simulated hours now
  const day = Math.floor(totalHours / 24) + 1;
  const hour = Math.floor(totalHours % 24);
  const minute = Math.floor((totalHours % 1) * 60);
  const second = Math.floor(((totalHours % 1) * 60 % 1) * 60);
  return { day, hour, minute, second, hourStr: `${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}:${second.toString().padStart(2,'0')}` };
}

>>>>>>> Stashed changes
app.get('/api/history', async (req, res) => {
  const range = req.query.range || 'day';
  try {
    const conn = await pool.getConnection();
<<<<<<< Updated upstream
    const interval = range === 'week' ? '7 DAY' : range === 'month' ? '30 DAY' : range === 'year' ? '365 DAY' : '1 DAY';
    const [rows] = await conn.query('SELECT recorded_at as timestamp, AVG(pv_power_kw) as pv, AVG(battery_soc) as battery, AVG(load_power_kw) as load, AVG(grid_power_kw) as grid FROM energy_balance WHERE recorded_at > DATE_SUB(NOW(), INTERVAL ' + interval + ') GROUP BY HOUR(recorded_at), MINUTE(recorded_at) DIV 10 ORDER BY recorded_at');
    conn.release();
    res.json(rows);
  } catch (err) { res.json([]); }
=======
    let interval, groupBy, orderBy;

    switch (range) {
      case 'week':
        interval = '7 DAY';
        groupBy = 'HOUR(recorded_at), MINUTE(recorded_at) DIV 30';
        orderBy = 'MIN(recorded_at)';
        break;
      case 'month':
        interval = '30 DAY';
        groupBy = 'HOUR(recorded_at) DIV 2, DAY(recorded_at)';
        orderBy = 'MIN(recorded_at)';
        break;
      case 'year':
        interval = '365 DAY';
        groupBy = 'DAY(recorded_at)';
        orderBy = 'MIN(recorded_at)';
        break;
      case '3years':
        interval = '1095 DAY';
        groupBy = 'WEEK(recorded_at), YEAR(recorded_at)';
        orderBy = 'MIN(recorded_at)';
        break;
      default: // day
        interval = '1 DAY';
        groupBy = 'HOUR(recorded_at), MINUTE(recorded_at) DIV 10';
        orderBy = 'MIN(recorded_at)';
    }

    const [rows] = await conn.query(
      'SELECT UNIX_TIMESTAMP(MIN(recorded_at)) * 1000 as timestamp, AVG(pv_power_kw) as pv, AVG(battery_power_kw) as battery, AVG(`load_power_kw`) as `load`, AVG(grid_power_kw) as grid FROM energy_balance WHERE recorded_at > DATE_SUB(NOW(), INTERVAL ' + interval + ') GROUP BY ' + groupBy + ' ORDER BY ' + orderBy
    );
    conn.release();
    res.json(rows);
  } catch (err) { console.error('History error:', err.message); res.json([]); }
>>>>>>> Stashed changes
});

app.get('/api/bms/cells', async (req, res) => { try { const conn = await pool.getConnection(); const [rows] = await conn.query('SELECT * FROM bms_cell_data ORDER BY recorded_at DESC LIMIT 64'); conn.release(); res.json(rows); } catch (err) { res.json([]); } });
app.get('/api/bms/summary', async (req, res) => { try { const conn = await pool.getConnection(); const [rows] = await conn.query('SELECT * FROM bms_summary ORDER BY recorded_at DESC LIMIT 1'); conn.release(); res.json(rows[0] || null); } catch (err) { res.json(null); } });
app.get('/api/health', (req, res) => { res.json({ status: 'ok', timestamp: Date.now(), dataMode }); });
app.get('/api/mode', (req, res) => { res.json({ dataMode }); });

app.post('/api/breaker', (req, res) => {
  const { roomId, status } = req.body;
  const room = simState.rooms.find(r => r.roomId === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  room.breakerStatus = status;
  if (status === 'open') room.powerKW = 0;
  res.json({ success: true, room });
});

app.post('/api/breaker/all', (req, res) => {
  const { status } = req.body;
  simState.rooms.forEach(room => {
    room.breakerStatus = status;
    if (status === 'open') room.powerKW = 0;
  });
  res.json({ success: true, rooms: simState.rooms });
});

app.post('/api/mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'simulation' || mode === 'mqtt') {
    dataMode = mode;
    res.json({ success: true, mode: dataMode });
  } else {
    res.status(400).json({ error: 'Invalid mode' });
  }
});

// ===== Start =====
async function start() {
  await initDatabase();
  initializeCells();
  connectMQTT();
  setInterval(() => { updateSimulation(); }, 1000);
  setInterval(() => { storeToDatabase(); }, 10000);
  console.log('Data mode:', DATA_MODE);
  console.log('MQTT Broker:', MQTT_BROKER);
  app.listen(PORT, '0.0.0.0', () => {
    console.log('EMS Backend running on port', PORT, '(1 hour = 1 day)');
  });
}
start().catch(console.error);
