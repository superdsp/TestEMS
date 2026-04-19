# 电池模型文档 (Battery Model)

## 系统配置

| 参数 | 值 |
|------|-----|
| 总容量 | 50 kWh |
| 最大SOC | 90% |
| 最小SOC | 10% |
| 最大充电功率 | 10 kW |
| 最大放电功率 | 10 kW |
| 充放电效率 | 95% (端到端) |

## 电池组配置 (16S4P)

| 参数 | 值 |
|------|-----|
| 电芯串联数 | 16S |
| 电芯并联数 | 4P |
| 额定电压 | 51.2V (16 × 3.2V) |
| 单芯额定电压 | 3.2V |
| 单芯容量 | 280Ah (4P总容量) |

## SOC-Voltage 特性曲线 (LiFePO4)

| SOC (%) | 单芯电压 (mV) | 备注 |
|---------|--------------|------|
| 0 | 2700 | 过放保护 |
| 10 | 3100 | |
| 20 | 3200 | |
| 30 | 3250 | |
| 40 | 3280 | |
| 50 | 3310 | |
| 60 | 3340 | |
| 70 | 3370 | |
| 80 | 3410 | |
| 90 | 3460 | |
| 100 | 3540 | 过充保护 |

## 仿真算法

### 1. 能量计算

```
能量变化 (kWh) = 功率 (kW) × 时间 (h) × 效率
SOC变化 (%) = 能量变化 (kWh) / 容量 (kWh) × 100
```

### 2. 单芯电压计算

```javascript
// 基准电压 = 根据SOC查表 + 线性插值
baseVoltage = interpolate(SOC, SOC_CURVE)

// 内阻压降 = 电流 × 内阻
// 充电时压降为正，放电时压降为负
IR_drop = currentA × internalResistanceMOhm / 1000

// 实际电压 = 基准电压 + IR压降 + 随机噪声
cellVoltage = baseVoltage + IR_drop + (Math.random() - 0.5) × noise
```

### 3. 电流计算

```javascript
// 电池组电流 (A) = 功率 (W) / 总电压 (V)
currentA = Math.abs(powerKW × 1000 / totalVoltage)
```

### 4. 均衡算法

```javascript
// 当电芯电压与平均电压差超过阈值时启动均衡
if (Math.abs(cellVoltage - avgVoltage) > BALANCE_THRESHOLD_MV) {
  // 高电压电芯放电
  cellVoltage -= voltageDelta × 0.01
  balanceStatus = true
  balanceDutyCycle = Math.min(100, Math.abs(voltageDelta) × 2)
}
```

### 5. 参数常量

```javascript
const CELL_COUNT = 16        // 串联数
const STRING_COUNT = 4       // 并联数
const TOTAL_CELLS = 64       // 总电芯数 (16 × 4)
const INTERNAL_RESISTANCE_MOHM = 25  // 单芯内阻 25mΩ
const BALANCE_THRESHOLD_MV = 50      // 均衡阈值 50mV
const CAPACITY_KWH = 50      // 50kWh总容量
```

## 仿真流程 (每1秒)

```
1. 计算 dtHours (真实时间步长 × 24倍速)
2. 计算功率分配
   - 净功率 = 光伏 - 负载
   - 净功率 > 0: 充电 (powerKW < 0)
   - 净功率 < 0: 放电 (powerKW > 0)
3. 更新SOC
   - socDelta = powerKW × dtHours / CAPACITY_KWH × 100
   - socPercent = clamp(socPercent + socDelta, 10, 90)
4. 更新单体电压
   - 基准电压 = getVoltageFromSOC(socPercent)
   - IR压降 = currentA × 25mΩ / 1000
   - 实际电压 = 基准电压 + IR压降 + 噪声
5. 均衡处理
   - 计算平均电压
   - 压差 > 50mV的电芯进行均衡
6. 更新BMS状态
   - maxCellDeltaMV = max(voltages) - min(voltages)
   - avgVoltage = average(voltages)
   - totalVoltage = sum(第一串16个电压) / 1000
```

## 数据输出

### BMSState

```typescript
{
  cellCount: 16,           // 串联数
  stringCount: 4,          // 并联数
  voltages: number[],       // 64个电芯电压 (mV)
  socValues: number[],     // 64个电芯SOC (%)
  temps: number[],         // 64个电芯温度 (°C)
  balanceStatus: boolean[], // 64个均衡状态
  maxCellDeltaMV: number,  // 最大压差 (mV)
  avgVoltage: number,      // 平均电压 (V)
  totalVoltage: number,    // 总电压 (V) = 16S串联电压
  sohPercent: number,      // 健康状态 (%)
  chargeCycles: number     // 充放电循环次数
}
```

## 正常运行范围

| 状态 | SOC | 单芯电压 | 总电压 |
|------|-----|---------|--------|
| 满充 | 90% | 3.35-3.46V | 53.6-55.4V |
| 正常 | 50% | 3.28-3.31V | 52.5-53.0V |
| 低电量 | 15% | 3.05-3.10V | 48.8-49.6V |

## 异常告警

| 条件 | 处理 |
|------|------|
| SOC > 90% | 停止充电 |
| SOC < 10% | 停止放电 |
| 单芯电压 < 2.7V | 告警 |
| 单芯电压 > 3.6V | 停止充电 |
| 温度 > 45°C | 降功率运行 |
| 压差 > 200mV | 告警 |

## 版本历史

| 版本 | 日期 | 描述 |
|------|------|------|
| 1.0 | 2026-04-18 | 初始版本，修复SOC与电压不匹配问题 |
