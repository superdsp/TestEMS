# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

EMS 能源管理系统 Web 应用，基于 React + TypeScript + Supabase。管理 10KW 光伏、50kWh 储能、10KW PCS、6 个房间负载。

## 系统配置

| 设备 | 规格 |
|------|------|
| 光伏 | 10KW, DC 800V |
| 储能 | 50kWh, 10%/90% SOC |
| PCS | 10KW, DC 800V / AC 380V |
| 负载 | 6 房间 + 智能断路器 |

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 启动开发服务器 (http://localhost:5173)
npm run build        # 构建生产版本
npm run preview      # 预览生产版本
```

## 架构

### 前端结构

```
src/
├── lib/
│   ├── supabase.ts    # Supabase 客户端
│   └── types.ts       # TypeScript 类型定义
├── simulation/
│   ├── SimulationEngine.ts  # 仿真主引擎
│   └── models/
│       ├── SolarIrradiance.ts  # 太阳辐照度计算
│       ├── PVModel.ts          # 光伏模型
│       ├── BatteryModel.ts     # 电池模型
│       ├── PCSModel.ts         # PCS模型
│       └── RoomLoadModel.ts    # 房间负载模型
├── components/
│   ├── dashboard/
│   │   ├── EnergyFlowDiagram.tsx  # SVG能量流向图
│   │   ├── PowerGauge.tsx         # 功率仪表
│   │   ├── SOCIndicator.tsx      # SOC指示器
│   │   └── SystemStatusCard.tsx   # 系统状态卡片
│   ├── layout/MainLayout.tsx
│   └── ...
├── pages/
│   ├── DashboardPage.tsx     # 仪表盘
│   ├── ControlsPage.tsx      # 控制面板
│   ├── LoadManagementPage.tsx # 负载管理
│   ├── MonitoringPage.tsx    # 实时监控
│   ├── AlarmsPage.tsx        # 报警管理
│   └── HistoricalPage.tsx    # 历史数据
└── App.tsx                   # 路由配置
```

### 数据库

Supabase PostgreSQL，Schema 定义在 `supabase/migrations/001_initial_schema.sql`

关键表：
- `energy_systems` - 能源设备配置
- `rooms` - 房间配置
- `circuit_breakers` - 断路器
- `telemetry_data` - 时序遥测数据
- `control_commands` - 控制命令
- `alarm_events` - 报警事件
- `energy_balance` - 能量平衡快照

## 仿真引擎

`SimulationEngine` 是核心类，编排所有能源模型：

1. 基于时间计算太阳辐照度
2. 光伏模型计算发电功率
3. 房间负载模型计算各房间用电
4. 能量管理策略：PV→负载→储能→电网
5. 每秒 tick 回调推送数据更新

使用 `onTick(callback)` 注册数据更新回调。

## 断路器控制流程

1. 用户点击断路器闭合/断开按钮
2. 调用 `engine.setBreakerStatus(roomId, status)`
3. 房间负载模型根据断路器状态计算功率（断开=0）
4. UI 刷新显示更新后的功率

## 环境变量

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

```
