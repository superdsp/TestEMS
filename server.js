const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = '/var/www/test-ems/data.json';

app.use(cors());
app.use(express.json());

// Simulation state
let simState = {
  pv: { powerKW: 5.2, voltage: 800, irradiance: 850 },
  battery: { socPercent: 65, powerKW: 2.1, temperatureC: 28 },
  pcs: { status: 'running', powerKW: 2.1, efficiency: 0.95 },
  grid: { powerKW: -1.5, voltage: 380 },
  rooms: [
    { roomId: 'room-1', roomName: '开放办公区', powerKW: 3.2, breakerStatus: 'closed' },
    { roomId: 'room-2', roomName: '独立办公室', powerKW: 1.5, breakerStatus: 'closed' },
    { roomId: 'room-3', roomName: '会议室', powerKW: 2.0, breakerStatus: 'closed' },
    { roomId: 'room-4', roomName: '机房', powerKW: 4.5, breakerStatus: 'closed' },
    { roomId: 'room-5', roomName: '开放办公区2', powerKW: 2.8, breakerStatus: 'closed' },
    { roomId: 'room-6', roomName: '前台接待', powerKW: 0.8, breakerStatus: 'closed' },
  ],
  balance: { totalLoadKW: 14.8, pvPowerKW: 5.2, batteryPowerKW: 2.1, gridPowerKW: 7.5 }
};

// Persistent storage for historical data
let realtimeDB = [];
const MAX_REALTIME_POINTS = 86400 * 2; // 2 days worth

// Historical aggregates (generated once and stored)
let historicalData = {
  day: [],
  week: [],
  month: [],
  year: []
};

// Load data from file on startup
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      realtimeDB = data.realtimeDB || [];
      historicalData = data.historicalData || { day: [], week: [], month: [], year: [] };
      console.log(`Loaded ${realtimeDB.length} realtime points from file`);
      console.log(`Loaded historical: day=${historicalData.day.length}, week=${historicalData.week.length}, month=${historicalData.month.length}, year=${historicalData.year.length}`);
    } else {
      console.log('No existing data file, generating initial data...');
      generateInitialData();
    }
  } catch (err) {
    console.error('Error loading data:', err);
    generateInitialData();
  }
}

// Generate initial historical data (only called once when no data exists)
function generateInitialData() {
  const now = Date.now();

  // Generate day data (1440 points, 1 per minute)
  for (let i = 1440 - 1; i >= 0; i--) {
    const timestamp = now - i * 60000;
    const hour = new Date(timestamp).getHours();
    const solarFactor = hour >= 8 && hour <= 18 ? Math.sin((hour - 8) * Math.PI / 10) : 0;
    const cloudNoise = 0.7 + Math.random() * 0.6;

    const pv = Math.max(0, 8 * solarFactor * cloudNoise + (Math.random() - 0.5) * 0.5);
    const load = 12 + Math.sin(i / 60) * 4 + Math.random() * 2;
    const battery = 50 + Math.sin(i / 60) * 20 + (Math.random() - 0.5) * 5;
    const grid = load - pv - (Math.random() - 0.5) * 2;

    historicalData.day.push({ timestamp, pv, battery, load, grid });
    realtimeDB.push({ timestamp, pv, battery, load, grid });
  }

  // Week data
  for (let i = 168 - 1; i >= 0; i--) {
    const timestamp = now - i * 3600000;
    const hour = new Date(timestamp).getHours();
    const dayOfWeek = new Date(timestamp).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const loadFactor = isWeekend ? 0.4 : 1;
    const solarFactor = hour >= 8 && hour <= 18 ? Math.sin((hour - 8) * Math.PI / 10) : 0;

    historicalData.week.push({
      timestamp,
      pv: Math.max(0, 7 * solarFactor + (Math.random() - 0.5)),
      battery: 55 + Math.sin(i / 12) * 15 + (Math.random() - 0.5) * 3,
      load: (10 + Math.random() * 4) * loadFactor,
      grid: 2 + Math.random() * 3
    });
  }

  // Month data
  for (let i = 720 - 1; i >= 0; i--) {
    const timestamp = now - i * 3600000;
    const dayOfWeek = new Date(timestamp).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    historicalData.month.push({
      timestamp,
      pv: Math.max(0, 6 + Math.sin(i / 12) * 2 + (Math.random() - 0.5)),
      battery: 50 + Math.sin(i / 48) * 20 + (Math.random() - 0.5) * 5,
      load: (11 + Math.sin(i / 24) * 3 + Math.random() * 2) * (isWeekend ? 0.5 : 1),
      grid: 4 + Math.random() * 3
    });
  }

  // Year data
  for (let i = 365 - 1; i >= 0; i--) {
    const timestamp = now - i * 86400000;
    const month = new Date(timestamp).getMonth();
    const seasonalFactor = 0.6 + 0.4 * Math.sin((month - 3) * Math.PI / 6);

    historicalData.year.push({
      timestamp,
      pv: Math.max(0, 150 * seasonalFactor + (Math.random() - 0.5) * 20),
      battery: 50 + Math.sin(i / 30) * 15 + (Math.random() - 0.5) * 5,
      load: 280 + Math.sin(i / 60) * 50 + (Math.random() - 0.5) * 20,
      grid: 100 + Math.random() * 50
    });
  }

  saveData();
}

// Save data to file periodically
function saveData() {
  try {
    const dataToSave = {
      realtimeDB: realtimeDB.slice(-MAX_REALTIME_POINTS),
      historicalData: historicalData
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave));
  } catch (err) {
    console.error('Error saving data:', err);
  }
}

// Last save time for periodic saves
let lastSaveTime = Date.now();

// Update simulation
setInterval(() => {
  const now = Date.now();
  const hour = new Date(now).getHours();

  // PV fluctuation
  const solarFactor = hour >= 8 && hour <= 18 ? Math.sin((hour - 8) * Math.PI / 10) : 0;
  simState.pv.powerKW = Math.max(0, 8 * solarFactor * (0.7 + Math.random() * 0.6));
  simState.pv.irradiance = Math.max(0, 850 * solarFactor);

  // Battery fluctuation
  simState.battery.powerKW = (Math.random() - 0.5) * 6;
  simState.battery.socPercent = Math.max(10, Math.min(90, simState.battery.socPercent + (Math.random() - 0.5) * 0.1));
  simState.battery.temperatureC = 25 + Math.random() * 5;

  // PCS
  simState.pcs.powerKW = simState.battery.powerKW;
  simState.pcs.efficiency = 0.93 + Math.random() * 0.04;

  // Room loads
  simState.rooms.forEach(room => {
    room.powerKW = Math.max(0.1, room.powerKW + (Math.random() - 0.5) * 0.3);
  });

  // Calculate totals
  const totalLoad = simState.rooms.reduce((sum, r) => sum + r.powerKW, 0);
  simState.balance.totalLoadKW = totalLoad;
  simState.balance.pvPowerKW = simState.pv.powerKW;
  simState.balance.batteryPowerKW = simState.battery.powerKW;
  simState.balance.gridPowerKW = totalLoad - simState.pv.powerKW - simState.battery.powerKW;
  simState.grid.powerKW = simState.balance.gridPowerKW;

  // Store in realtime DB - ONLY APPEND, NEVER MODIFY OLD DATA
  const newPoint = {
    timestamp: now,
    pv: simState.pv.powerKW,
    battery: simState.battery.socPercent,
    load: totalLoad,
    grid: simState.grid.powerKW
  };

  // Only add if this timestamp is newer than the last point
  if (realtimeDB.length === 0 || newPoint.timestamp > realtimeDB[realtimeDB.length - 1].timestamp) {
    realtimeDB.push(newPoint);

    // Trim old data (keep only last MAX_REALTIME_POINTS)
    if (realtimeDB.length > MAX_REALTIME_POINTS) {
      realtimeDB = realtimeDB.slice(-MAX_REALTIME_POINTS);
    }
  }

  // Save data every 30 seconds
  if (now - lastSaveTime > 30000) {
    saveData();
    lastSaveTime = now;
  }
}, 1000);

// API Routes
app.get('/api/simulation', (req, res) => {
  res.json({
    timestamp: Date.now(),
    ...simState
  });
});

app.get('/api/history', (req, res) => {
  const { range = 'day' } = req.query;
  const data = historicalData[range] || historicalData.day;
  res.json(data);
});

app.get('/api/realtime', (req, res) => {
  const { range = '15min' } = req.query;

  const now = Date.now();
  let startTime;

  switch (range) {
    case '15min':
      startTime = now - 15 * 60 * 1000;
      break;
    case '1hour':
      startTime = now - 60 * 60 * 1000;
      break;
    case '24hour':
      startTime = now - 24 * 60 * 60 * 1000;
      break;
    default:
      startTime = now - 15 * 60 * 1000;
  }

  const data = realtimeDB.filter(d => d.timestamp >= startTime);
  res.json(data);
});

// Save on shutdown
process.on('SIGINT', () => {
  console.log('Saving data before shutdown...');
  saveData();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Saving data before shutdown...');
  saveData();
  process.exit(0);
});

// Load data and start server
loadData();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`EMS Backend running on http://0.0.0.0:${PORT}`);
});
