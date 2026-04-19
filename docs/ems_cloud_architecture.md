# EMS 能源管理系统 云端架构方案

## 项目概述

使用 Supabase + Vercel + MQTT 部署 EMS 能源管理系统到海外，支持真实传感器数据实时采集与展示。

---

## 一、系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                           海外部署架构                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      │
│   │   传感器    │ ──── │   MQTT      │      │   Vercel   │      │
│   │  (ESP32/   │      │   Broker    │      │   前端      │      │
│   │   PLC)     │      │  (EMQX)    │      │  React App  │      │
│   └─────────────┘      └──────┬──────┘      └──────┬──────┘      │
│                               │                     │               │
│                               │                     │               │
│                               ▼                     ▼               │
│                       ┌─────────────┐      ┌─────────────┐          │
│                       │   Supabase  │◄────│   Supabase  │          │
│                       │ Edge Funcs │     │   Realtime  │          │
│                       │  (Deno)    │     │  Subscriptions │      │
│                       └──────┬─────┘     └─────────────┘          │
│                              │                                   │
│                              ▼                                   │
│                       ┌─────────────┐                             │
│                       │ PostgreSQL  │                             │
│                       │   数据库    │                             │
│                       └─────────────┘                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、技术选型

| 服务 | 产品 | 用途 | 费用 |
|------|------|------|------|
| 前端托管 | Vercel | React静态网站 | 免费 |
| 数据库 | Supabase | PostgreSQL + Realtime | 免费额度 |
| 后端逻辑 | Supabase Edge Functions | API + 模拟器 | 免费额度 |
| MQTT Broker | EMQX Cloud | 传感器数据接收 | 免费/付费 |
| 对象存储 | Supabase Storage | 历史数据备份 | 按量计费 |

---

## 三、数据库设计

### 3.1 表结构 (PostgreSQL)

```sql
-- 能源设备配置表
CREATE TABLE energy_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_type VARCHAR(20) NOT NULL, -- 'pv', 'battery', 'pcs', 'grid'
  name VARCHAR(100),
  specs JSONB, -- 存储设备规格参数
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 实时遥测数据表
CREATE TABLE telemetry_data (
  id BIGSERIAL PRIMARY KEY,
  system_id VARCHAR(50) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  power_kw DECIMAL(10,3),
  voltage_dc DECIMAL(10,2),
  voltage_ac DECIMAL(10,2),
  current_amp DECIMAL(10,3),
  soc_percent DECIMAL(5,2),
  temperature_c DECIMAL(6,2),
  irradiance_wm2 DECIMAL(10,2),
  cumulative_energy_kwh DECIMAL(12,4) DEFAULT 0,
  -- 分区键
  recorded_date DATE GENERATED ALWAYS AS (recorded_at::DATE) STORED
);

-- BMS单体电芯数据
CREATE TABLE bms_cell_data (
  id BIGSERIAL PRIMARY KEY,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  string_index INT,
  cell_index INT,
  voltage_mv INT,
  soc_percent DECIMAL(5,2),
  temperature_c DECIMAL(6,2),
  is_balancing BOOLEAN,
  balance_duty_cycle INT
);

-- BMS汇总数据
CREATE TABLE bms_summary (
  id BIGSERIAL PRIMARY KEY,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
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
  discharge_power_kw DECIMAL(10,3)
);

-- 房间负载数据
CREATE TABLE room_loads (
  id BIGSERIAL PRIMARY KEY,
  room_id VARCHAR(50) NOT NULL,
  room_name VARCHAR(100),
  power_kw DECIMAL(10,3),
  breaker_status VARCHAR(20) DEFAULT 'closed',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 能量平衡表
CREATE TABLE energy_balance (
  id BIGSERIAL PRIMARY KEY,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  pv_power_kw DECIMAL(10,3),
  battery_power_kw DECIMAL(10,3),
  battery_soc DECIMAL(5,2),
  grid_power_kw DECIMAL(10,3),
  load_power_kw DECIMAL(10,3),
  system_efficiency DECIMAL(5,4)
);

-- 报警事件表
CREATE TABLE alarm_events (
  id BIGSERIAL PRIMARY KEY,
  severity VARCHAR(20), -- 'info', 'warning', 'critical'
  source VARCHAR(50),
  message TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 索引设计

```sql
-- 分区表（按日期分区，提高查询性能）
CREATE INDEX idx_telemetry_system_time ON telemetry_data(system_id, recorded_at DESC);
CREATE INDEX idx_telemetry_date ON telemetry_data(recorded_date);
CREATE INDEX idx_bms_summary_time ON bms_summary(recorded_at DESC);
CREATE INDEX idx_energy_balance_time ON energy_balance(recorded_at DESC);
CREATE INDEX idx_room_loads_time ON room_loads(recorded_at DESC);
```

### 3.3 Realtime 配置

```sql
-- 启用Realtime功能
ALTER PUBLICATION supabase_realtime ADD TABLE telemetry_data;
ALTER PUBLICATION supabase_realtime ADD TABLE bms_summary;
ALTER PUBLICATION supabase_realtime ADD TABLE energy_balance;
ALTER PUBLICATION supabase_realtime ADD TABLE room_loads;
```

---

## 四、MQTT 传感器接入

### 4.1 MQTT Topic 结构

```
ems/
├── pv/
│   ├── power         # 光伏功率 kW
│   ├── voltage      # 直流电压 V
│   └── irradiance   # 辐照度 W/m²
├── battery/
│   ├── soc          # SOC %
│   ├── power        # 功率 kW
│   ├── temperature   # 温度 °C
│   └── bms/
│       ├── cell_voltages    # [3200, 3210, ...] 16个电压
│       ├── cell_temps       # [28, 29, ...] 温度
│       └── balance_status   # [false, true, ...] 均衡状态
├── grid/
│   ├── power        # 电网功率 kW
│   └── voltage      # 电网电压 V
├── load/
│   └── rooms/
│       ├── room-1/power
│       ├── room-2/power
│       └── ...
└── pcs/
    ├── power        # PCS功率 kW
    └── efficiency   # 转换效率 %
```

### 4.2 传感器数据格式 (JSON)

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
      "voltages": [3280, 3290, 3275, ...],
      "temps": [28, 29, 27, ...],
      "balanceStatus": [false, false, ...]
    }
  },
  "grid": {
    "powerKW": -1.5,
    "voltage": 380
  },
  "rooms": [
    {"roomId": "room-1", "powerKW": 3.2},
    {"roomId": "room-2", "powerKW": 1.5}
  ]
}
```

### 4.3 EMQX Cloud 配置

| 项目 | 配置 |
|------|------|
| Broker | EMQX Cloud (免费试用) |
| Port | 1883 (MQTT), 8083 (WebSocket) |
| Authentication | Username/Password 或 API Key |
| TLS | 启用 (推荐) |

---

## 五、Supabase Edge Functions

### 5.1 函数列表

| 函数 | 用途 |
|------|------|
| `mqtt-ingestor` | 接收MQTT消息，解析并存入数据库 |
| `get-snapshot` | 获取当前系统快照 |
| `get-history` | 获取历史数据 (小时/天/周/月聚合) |
| `set-breaker` | 控制断路器开关 |
| `simulator` | 数据模拟器 (无传感器时使用) |

### 5.2 MQTT Ingestor 伪代码

```typescript
// Deno Edge Function
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const payload = await req.json();
  const { timestamp, pv, battery, grid, rooms } = payload;

  // 存入数据库
  await supabase.from('telemetry_data').insert([
    { system_id: 'pv', power_kw: pv.powerKW, voltage_dc: pv.voltage, irradiance_wm2: pv.irradiance },
    { system_id: 'battery', power_kw: battery.powerKW, soc_percent: battery.socPercent, temperature_c: battery.temperatureC },
    { system_id: 'grid', power_kw: grid.powerKW, voltage_ac: grid.voltage },
  ]);

  // 存入BMS数据
  if (battery.bms) {
    await supabase.from('bms_cell_data').insert(
      battery.bms.voltages.map((v, i) => ({
        string_index: Math.floor(i / 16),
        cell_index: i % 16,
        voltage_mv: Math.round(v),
        temperature_c: battery.bms.temps[i],
        is_balancing: battery.bms.balanceStatus[i],
      }))
    );
  }

  return new Response(JSON.stringify({ success: true }));
});
```

---

## 六、前端架构 (React + Vercel)

### 6.1 技术栈

| 技术 | 用途 |
|------|------|
| React 18 | UI框架 |
| TypeScript | 类型安全 |
| Vite | 构建工具 |
| TailwindCSS | 样式 |
| Recharts | 图表 |
| Supabase JS | 数据库连接 + Realtime |

### 6.2 Realtime 订阅

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 订阅实时数据
supabase
  .channel('ems-realtime')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'energy_balance'
  }, (payload) => {
    // 更新UI
    setBalanceData(payload.new)
  })
  .subscribe()
```

### 6.3 页面结构

```
src/
├── pages/
│   ├── Dashboard.tsx      # 仪表盘主页
│   ├── Monitoring.tsx    # 实时监控
│   ├── LoadMgmt.tsx     # 负载管理
│   └── History.tsx      # 历史数据
├── components/
│   ├── EnergyFlow.tsx   # 能量流向图
│   ├── PowerGauge.tsx   # 功率仪表
│   ├── SocIndicator.tsx  # SOC指示器
│   └── CellGrid.tsx     # 电芯电压网格
├── hooks/
│   ├── useRealtime.ts   # Realtime订阅Hook
│   └── useApi.ts        # API调用Hook
└── lib/
    ├── supabase.ts      # Supabase客户端
    └── types.ts         # 类型定义
```

---

## 七、部署流程

### 7.1 EMQX Cloud (MQTT Broker)

1. 注册 EMQX Cloud (https://cloud.emqx.com)
2. 创建免费试用部署
3. 获取 MQTT 连接信息
4. 配置认证凭据

### 7.2 Supabase

1. 创建项目 (https://app.supabase.com)
2. 启用 Realtime
3. 执行数据库迁移 (SQL表结构)
4. 获取 API Keys

### 7.3 Vercel 前端

```bash
# 克隆代码
git clone https://github.com/your-repo/ems-frontend
cd ems-frontend

# 设置环境变量
cp .env.example .env.local
# 编辑 .env.local:
# VITE_SUPABASE_URL=your-supabase-url
# VITE_SUPABASE_ANON_KEY=your-anon-key

# 部署
vercel --prod
```

### 7.4 传感器配置

传感器通过MQTT发布数据到EMQX Cloud：

```javascript
// ESP32/Arduino 示例
#include <WiFi.h>
#include <PubSubClient.h>

const char* mqtt_server = "broker.emqx.io"; // EMQX Cloud地址
const char* mqtt_topic = "ems/pv/power";

void setup() {
  client.setServer(mqtt_server, 1883);
  client.publish(mqtt_topic, "5.2"); // 发布光伏功率
}
```

---

## 八、数据流向

```
传感器 (ESP32/PLC)
    │
    │  MQTT (TLS)
    ▼
EMQX Cloud Broker
    │
    │  Webhook / EMQX Rule
    ▼
Supabase Edge Function (mqtt-ingestor)
    │
    │  INSERT
    ▼
PostgreSQL Database
    │
    │  SELECT / Realtime
    ▼
前端 (React + Vercel)
    │
    │  展示 + 控制
    ▼
用户浏览器 / 手机APP
```

---

## 九、费用估算 (海外部署)

| 服务 | 方案 | 月费用 |
|------|------|--------|
| Vercel | Free | $0 |
| Supabase | Free Tier | $0 (500MB数据库, 2GB传输) |
| EMQX Cloud | 28天免费试用 | $0 |
| **总计** | | **$0** |

> 注：免费额度足够个人/小团队使用。商业用途可升级到付费方案。

---

## 十、实施方案

### 阶段一：基础部署 (1天)
- [x] Supabase 项目创建 + 数据库表
- [ ] EMQX Cloud MQTT Broker 配置
- [ ] Supabase Edge Functions 编写
- [ ] Vercel 前端部署

### 阶段二：传感器接入 (2天)
- [ ] 传感器 MQTT 发布代码
- [ ] Edge Function MQTT Ingestor
- [ ] 数据验证

### 阶段三：功能完善 (3天)
- [ ] 前端所有页面开发
- [ ] Realtime 数据展示
- [ ] 历史数据查询
- [ ] 断路器控制

### 阶段四：测试优化 (1天)
- [ ] 负载测试
- [ ] 性能优化
- [ ] 监控告警配置

---

## 十一、文档目录

| 文档 | 描述 |
|------|------|
| `docs/ems_cloud_architecture.md` | 本文档 |
| `docs/battery_model.md` | 电池模型文档 |
| `docs/database_schema.md` | 数据库详细Schema |
| `docs/api_reference.md` | API接口文档 |
| `docs/mqtt_protocol.md` | MQTT协议文档 |
| `docs/deployment_guide.md` | 部署指南 |

---

## 十二、是否同意这个方案？

同意后我开始逐步实施：
1. 先创建 Supabase 项目和数据库表
2. 配置 EMQX Cloud MQTT
3. 编写 Edge Functions
4. 部署前端到 Vercel
