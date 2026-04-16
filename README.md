# EMS 能源管理系统 Web 应用

基于 React + TypeScript + Supabase 的能源管理系统，用于管理 10KW 光伏、50kWh 储能、10KW PCS 以及 6 个房间负载。

## 系统配置

- **光伏**: 10KW, DC 800V
- **储能**: 50kWh, 10%/90% SOC 限制
- **PCS**: 10KW, DC 800V / AC 380V
- **负载**: 6 个房间，每个房间配有智能断路器

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Supabase

复制 `.env.example` 为 `.env` 并配置 Supabase 项目信息：

```bash
cp .env.example .env
```

### 3. 设置 Supabase 数据库

1. 在 Supabase 控制台创建新项目
2. 在 SQL Editor 中运行 `supabase/migrations/001_initial_schema.sql`
3. 获取项目的 URL 和 anon key 并填入 `.env`

### 4. 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:5173 运行。

## 页面功能

- **仪表盘**: 能量流向图、功率仪表、SOC 指示器、系统状态卡片
- **控制面板**: PCS 启停、储能充放电控制、定时任务管理
- **负载管理**: 6 个房间断路器监控和遥控
- **实时监控**: 功率曲线、遥测数据表
- **报警管理**: 报警列表、确认、阈值配置
- **历史数据**: 日功率曲线、房间用电排名、报表生成

## 仿真引擎

内置仿真引擎可模拟真实能源系统运行，支持：

- 太阳辐照度计算（基于时间/纬度）
- 光伏发电模型
- 电池 SOC 充放电模型
- PCS 功率转换模型
- 房间负载模型

启动仿真：`npm run simulate`

## 技术栈

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Supabase
- Recharts
- Lucide Icons
