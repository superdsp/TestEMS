# EMS 能源管理系统 - 国内部署方案

## 一、方案概述

**目标：** 在阿里云ECS上部署完整的EMS能源管理系统

**核心组件：**
- 前端：Nginx托管React静态网站
- 后端：Node.js Express API服务器
- 数据库：MySQL 8.0
- MQTT：Mosca (内置) 或 EMQX
- 模拟器：内置数据模拟器
- 真实传感器：支持MQTT协议接入

**网址：** http://106.14.31.17/

---

## 二、系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                    阿里云 ECS (106.14.31.17)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │                      Nginx (端口 80/443)                 │       │
│   │              静态托管 + 反向代理 + SSL                    │       │
│   └─────────────────────────────────────────────────────────┘       │
│                              │                                      │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │                  Node.js Express (端口 3000)             │       │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │       │
│   │  │ REST API  │  │ 模拟器   │  │ MQTT    │            │       │
│   │  │          │  │         │  │ Handler │            │       │
│   │  └──────────┘  └──────────┘  └──────────┘            │       │
│   │        │            │            │                     │       │
│   │        └────────────┼────────────┘                     │       │
│   │                     ▼                                   │       │
│   │              ┌──────────┐                            │       │
│   │              │ 状态管理  │ (simState)                 │       │
│   │              └──────────┘                            │       │
│   └──────────────────────────┬──────────────────────────────┘       │
│                              │                                      │
│              ┌───────────────┼───────────────┐                      │
│              ▼               ▼               ▼                      │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│   │   MySQL     │  │   Mosca     │  │   文件       │              │
│   │  (端口3306)  │  │  MQTT(1883)│  │   日志       │              │
│   └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ MQTT (可选)
                              ▼
               ┌──────────────────────────┐
               │      传感器设备           │
               │  (ESP32 / PLC / MQTT)   │
               └──────────────────────────┘
```

---

## 三、部署步骤

### 步骤1：服务器准备

```bash
# 更新系统
apt update && apt upgrade -y

# 安装基础软件
apt install -y nginx mysql-server mosquitto mosquitto-clients

# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 验证安装
node --version  # v18.x.x
npm --version   # 9.x.x
```

### 步骤2：MySQL 配置

```bash
# 启动MySQL
systemctl start mysql
systemctl enable mysql

# 安全配置
mysql_secure_installation

# 创建数据库和用户
mysql -u root -p << 'EOF'
CREATE DATABASE ems_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ems_user'@'localhost' IDENTIFIED BY 'ems_password_2024';
GRANT ALL PRIVILEGES ON ems_db.* TO 'ems_user'@'localhost';
FLUSH PRIVILEGES;
EOF

# 创建表
mysql -u ems_user -pems_password_2024 ems_db << 'EOF'
-- 遥测数据表
CREATE TABLE telemetry_data (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  system_id VARCHAR(50) NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  power_kw DECIMAL(10,3),
  voltage_dc DECIMAL(10,2),
  voltage_ac DECIMAL(10,2),
  current_amp DECIMAL(10,3),
  soc_percent DECIMAL(5,2),
  temperature_c DECIMAL(6,2),
  irradiance_wm2 DECIMAL(10,2),
  cumulative_energy_kwh DECIMAL(12,4) DEFAULT 0,
  INDEX idx_system_time (system_id, recorded_at DESC)
);

-- BMS单体电芯数据
CREATE TABLE bms_cell_data (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  string_index INT,
  cell_index INT,
  voltage_mv INT,
  soc_percent DECIMAL(5,2),
  temperature_c DECIMAL(6,2),
  is_balancing BOOLEAN,
  balance_duty_cycle INT,
  INDEX idx_time (recorded_at DESC)
);

-- BMS汇总
CREATE TABLE bms_summary (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_voltage DECIMAL(10,3),
  total_current_amp DECIMAL(10,3),
  soc_percent DECIMAL(5,2),
  soh_percent DECIMAL(5,2),
  max_cell_voltage_mv INT,
  min_cell_voltage_mv INT,
  max_cell_delta_mv INT,
  max_temperature_c DECIMAL(6,2),
  avg_temperature_c DECIMAL(6,2),
  charge_cycles INT,
  charge_power_kw DECIMAL(10,3),
  discharge_power_kw DECIMAL(10,3),
  INDEX idx_time (recorded_at DESC)
);

-- 房间负载
CREATE TABLE room_loads (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(50) NOT NULL,
  room_name VARCHAR(100),
  power_kw DECIMAL(10,3),
  breaker_status VARCHAR(20) DEFAULT 'closed',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_room_time (room_id, recorded_at DESC)
);

-- 能量平衡
CREATE TABLE energy_balance (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  pv_power_kw DECIMAL(10,3),
  battery_power_kw DECIMAL(10,3),
  battery_soc DECIMAL(5,2),
  grid_power_kw DECIMAL(10,3),
  load_power_kw DECIMAL(10,3),
  system_efficiency DECIMAL(5,4),
  INDEX idx_time (recorded_at DESC)
);

-- 报警事件
CREATE TABLE alarm_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  severity VARCHAR(20),
  source VARCHAR(50),
  message TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_time (created_at DESC)
);
EOF
```

### 步骤3：部署后端

```bash
# 创建目录
mkdir -p /opt/ems-backend
cd /opt/ems-backend

# 复制代码 (或git clone)
# scp -r local/path/* root@106.14.31.17:/opt/ems-backend/

# 安装依赖
npm install express cors mysql2 mosquitto mosquitto-clients

# 启动服务
node server.js &

# 开机自启 (systemd)
cat > /etc/systemd/system/ems-backend.service << 'EOF'
[Unit]
Description=EMS Backend Service
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ems-backend
ExecStart=/usr/bin/node /opt/ems-backend/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ems-backend
systemctl start ems-backend
```

### 步骤4：配置Nginx

```bash
cat > /etc/nginx/sites-available/ems << 'EOF'
server {
    listen 80;
    server_name _;

    root /var/www/ems;
    index index.html;

    # Gzip压缩
    gzip on;
    gzip_types text/plain application/javascript application/json;

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }

    # MQTT WebSocket代理 (可选)
    location /mqtt/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# 启用配置
ln -sf /etc/nginx/sites-available/ems /etc/nginx/sites-enabled/ems
rm -f /etc/nginx/sites-enabled/default

# 测试并重启
nginx -t
systemctl restart nginx
```

### 步骤5：部署前端

```bash
# 本地构建
cd ems-frontend
npm install
npm run build

# 上传到服务器
scp -r dist/* root@106.14.31.17:/var/www/ems/

# 或在服务器上直接clone构建
cd /var/www
git clone https://github.com/your-repo/ems-frontend.git ems
cd ems
npm install
npm run build
```

---

## 四、MQTT 传感器接入

### 4.1 启用内置MQTT Broker

在 `server.js` 中启用 Mosca：

```javascript
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const mqtt = require('mqtt');
const mosca = require('mosca');

// 创建MQTT Broker
const moscaServer = new mosca.Server({ port: 1883 });

moscaServer.on('ready', () => {
  console.log('MQTT Broker started on port 1883');
});

moscaServer.on('published', (packet, client) => {
  if (packet.topic === 'ems/telemetry') {
    const data = JSON.parse(packet.payload.toString());
    updateFromMQTT(data);
  }
});

const app = express();
app.use(cors());
app.use(express.json());
```

### 4.2 MQTT Topic 协议

| Topic | 描述 | 示例 |
|-------|------|------|
| `ems/pv/power` | 光伏功率 | `5.2` |
| `ems/pv/voltage` | 光伏电压 | `800` |
| `ems/pv/irradiance` | 辐照度 | `850` |
| `ems/battery/soc` | 电池SOC | `65` |
| `ems/battery/power` | 电池功率 | `-2.1` |
| `ems/battery/temp` | 电池温度 | `28` |
| `ems/battery/bms/cells` | 电芯电压JSON | `[3280,3290,...]` |
| `ems/grid/power` | 电网功率 | `1.5` |
| `ems/rooms/room-1/power` | 房间功率 | `3.2` |

### 4.3 完整Telemetry格式

```json
{
  "timestamp": 1713420000000,
  "pv": {
    "powerKW": 5.2,
    "voltage": 800,
    "irradiance": 850
  },
  "battery": {
    "socPercent": 65,
    "powerKW": 2.1,
    "temperatureC": 28,
    "bms": {
      "cellCount": 16,
      "stringCount": 4,
      "voltages": [3280, 3290, 3275, 3300, ...],
      "temps": [28, 29, 27, 30, ...],
      "balanceStatus": [false, false, true, ...]
    }
  },
  "grid": {
    "powerKW": -1.5,
    "voltage": 380
  },
  "rooms": [
    {"roomId": "room-1", "roomName": "开放办公区1", "powerKW": 3.2}
  ]
}
```

### 4.4 ESP32 传感器代码

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "YourWiFi";
const char* password = "YourPassword";
const char* mqtt_server = "106.14.31.17";
const int mqtt_port = 1883;

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    client.connect("ESP32 Client");
  }
  client.loop();
  publishTelemetry();
  delay(10000); // 10秒上传一次
}

void publishTelemetry() {
  StaticJsonDocument<512> doc;

  doc["pv"]["powerKW"] = readSolarPower();
  doc["pv"]["voltage"] = readSolarVoltage();
  doc["pv"]["irradiance"] = readIrradiance();

  doc["battery"]["socPercent"] = readBatterySOC();
  doc["battery"]["powerKW"] = readBatteryPower();
  doc["battery"]["temperatureC"] = readBatteryTemp();

  // 电芯电压数组
  JsonArray cells = doc["battery"]["bms"]["voltages"].to<JsonArray>();
  for (int i = 0; i < 16; i++) {
    cells.add(readCellVoltage(i));
  }

  doc["grid"]["powerKW"] = readGridPower();
  doc["grid"]["voltage"] = readGridVoltage();

  char buffer[512];
  serializeJson(doc, buffer);
  client.publish("ems/telemetry", buffer);
}
```

---

## 五、数据流程

### 5.1 模拟器模式 (当前)

```
┌─────────────┐
│  模拟器     │  (每1秒执行)
│  Simulation │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  simState   │────►│  HTTP API   │──► 前端轮询
│  (内存)     │     └─────────────┘
└──────┬──────┘
       │ 每10秒
       ▼
┌─────────────┐
│   MySQL     │──► 历史数据
│   数据库     │
└─────────────┘
```

### 5.2 MQTT真实传感器模式

```
┌─────────────┐
│  传感器     │──► MQTT消息
│  ESP32/PLC  │     (实时)
└─────────────┘
       │
       ▼
┌─────────────┐
│  MQTT Broker│──► Node.js Handler
│  (Mosca)   │
└─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  更新       │────►│  HTTP API   │──► 前端
│  simState   │     └─────────────┘
└─────────────┘
```

### 5.3 双模式切换

```javascript
let dataMode = 'simulation'; // 或 'mqtt'

// MQTT消息到达时切换
mqttBroker.on('published', (packet) => {
  if (packet.topic === 'ems/telemetry') {
    dataMode = 'mqtt';
    parseMQTTAndUpdate(packet.payload);
  }
});

// 模拟器仅在simulation模式更新
setInterval(() => {
  if (dataMode === 'simulation') {
    runSimulationStep();
  }
}, 1000);
```

---

## 六、监控与运维

### 6.1 日志管理

```bash
# 应用日志
tail -f /tmp/ems.log

# Nginx访问日志
tail -f /var/log/nginx/access.log

# MySQL日志
tail -f /var/log/mysql/error.log

# MQTT日志 (启用的话)
tail -f /var/log/mosquitto/mosquitto.log
```

### 6.2 进程管理

```bash
# Node.js进程
pm2 list
pm2 restart server
pm2 logs server

# 或使用systemd
systemctl status ems-backend
journalctl -u ems-backend -f
```

### 6.3 备份策略

```bash
# 每日数据库备份
0 2 * * * mysqldump -u ems_user -pems_password_2024 ems_db > /backup/ems_db_$(date +\%Y\%m\%d).sql

# 保留30天备份
0 3 * * * find /backup -name "ems_db_*.sql" -mtime +30 -delete
```

---

## 七、安全加固

### 7.1 防火墙

```bash
# 仅开放必要端口
ufw allow 22   # SSH
ufw allow 80   # HTTP
ufw allow 443  # HTTPS
ufw enable
```

### 7.2 API认证 (可选)

```javascript
// 在server.js中添加API Key验证
const API_KEY = 'your-secret-api-key';

app.use('/api/', (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

### 7.3 SSL证书 (Let's Encrypt)

```bash
# 安装certbot
apt install -y certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d yourdomain.com

# 自动续期
certbot renew --dry-run
```

---

## 八、费用清单

| 项目 | 说明 | 费用 |
|------|------|------|
| ECS服务器 | 阿里云 2核4G | ¥60-100/月 |
| 域名(可选) | .cn域名 | ¥30/年 |
| SSL证书 | Let's Encrypt免费 | ¥0 |
| **总计** | | **¥60-100/月** |

---

## 九、部署检查清单

```bash
# 1. MySQL运行
mysql -u ems_user -pems_password_2024 -e "SELECT 1"

# 2. Node.js API
curl http://localhost:3000/api/health

# 3. Nginx
curl http://localhost/api/health

# 4. MQTT (启用后)
mosquitto_pub -t "ems/test" -m "hello"
mosquitto_sub -t "ems/#"
```

---

## 十、文档目录

| 文档 | 描述 |
|------|------|
| `docs/ems_cloud_architecture.md` | 海外部署方案 (Supabase+Vercel) |
| `docs/domestic_deployment_plan.md` | 国内ECS部署方案 |
| `docs/architecture_overview.md` | 当前架构总结 |
| `docs/battery_model.md` | 电池模型文档 |

---

## 十一、是否开始部署？

确认后我执行以下步骤：

1. 验证ECS服务器连接
2. 创建数据库和表
3. 上传并启动后端服务
4. 配置Nginx
5. 部署前端
6. 测试完整流程
