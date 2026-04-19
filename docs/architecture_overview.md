# EMS 能源管理系统 - 架构总结

## 一、系统概述

EMS (Energy Management System) 能源管理系统，部署于阿里云ECS服务器，支持：
- 实时数据监控 (光伏、储能、电网、负载)
- 16S4P 电池管理 (BMS)
- 房间负载管理与断路器控制
- 数据存储与历史查询
- 模拟器模式 / 真实传感器模式

---

## 二、当前架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        阿里云 ECS (106.14.31.17)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐  │
│   │   Nginx     │      │  Node.js    │      │   MySQL     │  │
│   │  (80/443)  │◄────►│  Express    │◄────►│  (ems_db)   │  │
│   │  静态托管   │      │  API Server │      │   数据库     │  │
│   └─────────────┘      └──────┬──────┘      └─────────────┘  │
│                               │                              │
│                               │                              │
│                    ┌──────────┴──────────┐                   │
│                    │                     │                    │
│              ┌─────┴─────┐         ┌────┴────┐             │
│              │ MQTT      │         │  模拟器   │             │
│              │ Broker    │         │ Simulator │             │
│              │ (Mosca)  │         │ (内置)   │             │
│              └─────┬─────┘         └──────────┘             │
│                    │                                          │
└────────────────────┼──────────────────────────────────────────┘
                     │ MQTT
                     ▼
          ┌─────────────────────┐
          │   传感器设备         │
          │  (ESP32/PLC/MQTT)   │
          └─────────────────────┘
```

---

## 三、组件说明

### 3.1 Nginx (端口 80/443)

**作用：**
- 静态文件托管 (前端网站)
- 反向代理 (API请求 → Node.js)
- SSL终止 (可选)

**配置路径：** `/etc/nginx/sites-available/ems`

```nginx
server {
    listen 80;
    server_name _;
    root /var/www/ems;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### 3.2 Node.js Express API Server (端口 3000)

**作用：**
- REST API 提供商
- 数据模拟器
- MQTT 消息消费者
- 数据库写入

**文件路径：** `/opt/ems-backend/server.js`

**API 接口：**

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/simulation` | 全系统实时快照 |
| GET | `/api/realtime` | 实时数据 |
| GET | `/api/history` | 历史数据 |
| GET | `/api/bms/summary` | BMS汇总 |
| GET | `/api/bms/cells` | 电芯数据 |
| POST | `/api/breaker` | 控制断路器 |
| POST | `/api/breaker/all` | 批量控制 |
| GET | `/api/health` | 健康检查 |

**数据流向：**
```
MQTT消息 ──► Express处理 ──► MySQL存储
                 │
                 ▼
          HTTP API响应 ◄── 前端轮询
```

### 3.3 MySQL 数据库 (端口 3306)

**数据库名：** `ems_db`

**主要表：**

| 表名 | 用途 | 数据示例 |
|------|------|---------|
| `telemetry_data` | 设备遥测数据 | 功率、电压、SOC |
| `bms_cell_data` | 电芯详细数据 | 64个电芯电压/温度 |
| `bms_summary` | BMS汇总 | 总电压、SOH、循环次数 |
| `room_loads` | 房间负载 | 各房间功率、断路器状态 |
| `energy_balance` | 能量平衡 | PV/储能/电网/负载 |
| `alarm_events` | 报警事件 | 告警记录 |

---

## 四、数据模型

### 4.1 SystemSnapshot (系统快照)

```typescript
interface SystemSnapshot {
  timestamp: number;
  pv: {
    powerKW: number;      // 光伏功率 (kW)
    voltage: number;       // 直流电压 (V)
    irradiance: number;    // 辐照度 (W/m²)
  };
  battery: {
    socPercent: number;    // 荷电状态 (%)
    powerKW: number;       // 功率 (kW, 负=充电)
    temperatureC: number;   // 温度 (°C)
    bms: BMSState;
  };
  pcs: {
    status: string;        // 运行状态
    powerKW: number;       // PCS功率
    efficiency: number;     // 转换效率
  };
  grid: {
    powerKW: number;       // 电网功率 (kW, 负=馈电)
    voltage: number;        // 电网电压 (V)
  };
  rooms: RoomState[];      // 房间状态数组
  balance: BalanceState;   // 能量平衡
}

interface BMSState {
  cellCount: number;       // 串联数 (16)
  stringCount: number;      // 并联数 (4)
  voltages: number[];       // 64个电芯电压 (mV)
  socValues: number[];      // 64个电芯SOC (%)
  temps: number[];         // 64个电芯温度 (°C)
  balanceStatus: boolean[];// 均衡状态
  maxCellDeltaMV: number;   // 最大压差 (mV)
  avgVoltage: number;       // 平均电压 (V)
  totalVoltage: number;     // 总电压 (V)
  sohPercent: number;       // 健康状态 (%)
  chargeCycles: number;     // 充放电循环
}
```

### 4.2 电池模型 (LiFePO4 16S4P)

**配置：**
- 总容量: 50 kWh
- 额定电压: 51.2V (16 × 3.2V)
- SOC范围: 10% - 90%
- 最大充放电功率: 10 kW

**SOC-Voltage 曲线：**

| SOC | 单芯电压 |
|-----|---------|
| 0% | 2.70V |
| 50% | 3.31V |
| 100% | 3.54V |

---

## 五、前端架构 (React + Vite)

### 5.1 技术栈

| 技术 | 用途 |
|------|------|
| React 18 | UI框架 |
| TypeScript | 类型安全 |
| Vite | 构建工具 |
| TailwindCSS | 样式 |
| Recharts | 图表库 |
| Lucide React | 图标 |

### 5.2 页面结构

```
src/pages/
├── DashboardPage.tsx     # 仪表盘主页
├── MonitoringPage.tsx   # 实时监控
├── LoadManagementPage.tsx # 负载管理

src/components/
├── dashboard/
│   ├── EnergyFlowDiagram.tsx  # 能量流向图
│   ├── PowerGauge.tsx         # 功率仪表
│   └── SOCIndicator.tsx       # SOC指示器 + 电芯网格

src/lib/
├── types.ts              # 类型定义
└── mockData.ts          # 本地模拟数据
```

### 5.3 API 集成

```typescript
// 环境变量
VITE_BACKEND_URL=http://106.14.31.17:3000

// DashboardPage.tsx
const API_BASE = import.meta.env.VITE_BACKEND_URL

// 1秒轮询获取数据
setInterval(async () => {
  const res = await fetch(`${API_BASE}/api/simulation`)
  const data = await res.json()
  setSnapshot(data)
}, 1000)
```

---

## 六、部署方式

### 6.1 当前部署

| 组件 | 地址 |
|------|------|
| 网站 | http://106.14.31.17/ |
| API | http://106.14.31.17:3000 |

### 6.2 Vercel 部署 (需要配置反向代理)

**问题：** Vercel服务器(美国)无法直接访问ECS

**解决：** 通过API代理或继续使用ECS托管

---

## 七、MQTT 传感器接入

### 7.1 MQTT Broker (可选组件)

当前服务器已集成 Mosca MQTT Broker，可选启用：

```javascript
// 在 server.js 中启用 MQTT
const mqtt = require('mqtt');
const mosca = require('mosca');

const moscaServer = new mosca.Server({ port: 1883 });
moscaServer.on('client.connected', (client) => {
  console.log('MQTT client connected:', client.id);
});

moscaServer.on('published', (packet, client) => {
  // 处理MQTT消息
  if (packet.topic === 'ems/telemetry') {
    const data = JSON.parse(packet.payload.toString());
    // 更新 simState
  }
});
```

### 7.2 MQTT Topic 结构

```
ems/
├── pv/power           # 光伏功率
├── battery/soc       # 电池SOC
├── battery/power     # 电池功率
├── battery/bms/voltages  # 电芯电压数组
├── grid/power        # 电网功率
└── rooms/room-1/power   # 房间功率
```

### 7.3 传感器代码示例 (ESP32)

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* mqtt_server = "106.14.31.17";
const int mqtt_port = 1883;

WiFiClient espClient;
PubSubClient client(espClient);

void publishTelemetry() {
  StaticJsonDocument<512> doc;
  doc["pv"]["powerKW"] = solarPower;
  doc["pv"]["voltage"] = solarVoltage;
  doc["battery"]["socPercent"] = batterySOC;
  doc["battery"]["powerKW"] = batteryPower;

  char buffer[512];
  serializeJson(doc, buffer);
  client.publish("ems/telemetry", buffer);
}
```

---

## 八、数据流程

### 8.1 模拟器模式 (当前)

```
Node.js 模拟器 (每1秒)
       │
       ▼
   生成模拟数据
       │
       ├──► 更新内存状态 (simState)
       │
       ├──► 存入 MySQL (每10秒)
       │
       └──► HTTP API 响应 ◄── 前端轮询
```

### 8.2 真实传感器模式

```
传感器 (ESP32/PLC)
       │
       │ MQTT
       ▼
EMQX/Mosca Broker
       │
       │ 消息
       ▼
Node.js MQTT Handler
       │
       ├──► 更新 simState
       │
       ├──► 存入 MySQL
       │
       └──► WebSocket/轮询 ◄── 前端
```

### 8.3 双模式共存

```javascript
// server.js
let dataSource = 'simulation'; // 'simulation' 或 'mqtt'

// MQTT消息处理
mqttClient.on('message', (topic, message) => {
  dataSource = 'mqtt';
  const data = JSON.parse(message);
  updateSimStateFromMQTT(data);
});

// 模拟器处理
setInterval(() => {
  if (dataSource === 'simulation') {
    updateSimulation(); // 仅在模拟模式更新
  }
}, 1000);

// API始终返回最新数据
app.get('/api/simulation', (req, res) => {
  res.json({ ...simState, source: dataSource });
});
```

---

## 九、目录结构

```
/opt/ems-backend/
├── server.js           # 主程序
├── package.json        # 依赖
└── node_modules/      # 依赖包

/var/www/ems/          # 前端静态文件
├── index.html
└── assets/

/etc/nginx/sites-available/
└── ems                # Nginx配置

~/ems-db/
└── ems_db.sql         # 数据库初始化脚本
```

---

## 十、环境变量

```bash
# Node.js
PORT=3000
NODE_ENV=production

# MySQL (应用中配置)
host: localhost
user: ems_user
password: ems_password_2024
database: ems_db

# MQTT (可选)
MQTT_ENABLED=true
MQTT_PORT=1883
```

---

## 十一、监控与日志

### 11.1 日志位置

```bash
# 应用日志
/tmp/ems.log

# Nginx访问日志
/var/log/nginx/access.log

# Nginx错误日志
/var/log/nginx/error.log
```

### 11.2 进程管理

```bash
# 查看进程
ps aux | grep node

# 重启服务
systemctl restart nginx
pm2 restart server
```

---

## 十二、安全建议

1. **防火墙**：仅开放 80, 443 端口 (HTTP/HTTPS)
2. **API认证**：添加 API Key 认证
3. **数据库**：限制 ems_user 仅本地访问
4. **MQTT**：添加用户名密码认证
5. **SSL**：配置 Let's Encrypt 证书
