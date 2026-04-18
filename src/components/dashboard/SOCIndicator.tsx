// SOC (State of Charge) Indicator with BMS Cell View

interface BMSData {
  cellCount: number
  stringCount: number
  voltages: number[]
  maxCellDeltaMV: number
  totalVoltage: number
  sohPercent: number
  balanceStatus: boolean[]
}

interface SOCIndicatorProps {
  socPercent: number
  status?: 'charging' | 'discharging' | 'idle'
  size?: 'sm' | 'md' | 'lg'
  bms?: BMSData
}

export default function SOCIndicator({
  socPercent,
  status = 'idle',
  size = 'md',
  bms,
}: SOCIndicatorProps) {
  const gaugeSize = {
    sm: { w: 50, h: 80 },
    md: { w: 58, h: 95 },
    lg: { w: 65, h: 110 },
  }

  const g = gaugeSize[size]
  const fillH = (socPercent / 100) * g.h

  const socColor = () => {
    if (socPercent <= 20) return '#dc2626'
    if (socPercent <= 40) return '#f59e0b'
    return '#22c55e'
  }

  const statusIcon = {
    charging: (
      <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    discharging: (
      <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m-9-9h1m16 0h1m-2.636-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707" />
      </svg>
    ),
    idle: (
      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
      </svg>
    ),
  }

  const voltageToColor = (mv: number) => {
    if (mv < 3000) return '#ef4444'
    if (mv < 3200) return '#f97316'
    if (mv < 3400) return '#eab308'
    return '#22c55e'
  }

  const voltageToLabel = (mv: number) => (mv / 1000).toFixed(3) + 'V'

  return (
    <div className="flex items-center justify-center w-full gap-8">
      {/* SOC Gauge */}
      <div className="flex flex-col items-center">
        <div
          className="relative bg-gray-100 rounded overflow-hidden border border-gray-200"
          style={{ width: g.w, height: g.h }}
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-300" />
          <div
            className="absolute bottom-0 left-0 right-0 transition-all duration-500"
            style={{ height: fillH, backgroundColor: socColor(), opacity: 0.85 }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-bold text-white drop-shadow-sm" style={{ fontSize: '24px' }}>
              {socPercent.toFixed(0)}%
            </span>
          </div>
          <div className="absolute top-1.5 right-0.5">{statusIcon[status]}</div>
        </div>
        <span className="text-[18px] text-gray-600 font-medium mt-1">SOC</span>
      </div>

      {/* SOH Gauge */}
      {bms && (
        <div className="flex flex-col items-center">
          <div
            className="relative bg-gray-100 rounded overflow-hidden border border-gray-200"
            style={{ width: g.w, height: g.h }}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gray-300" />
            <div
              className="absolute bottom-0 left-0 right-0 transition-all duration-500"
              style={{ height: (bms.sohPercent / 100) * g.h, backgroundColor: '#3b82f6', opacity: 0.85 }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-bold text-white drop-shadow-sm" style={{ fontSize: '24px' }}>
                {bms.sohPercent.toFixed(0)}%
              </span>
            </div>
          </div>
          <span className="text-[18px] text-gray-600 font-medium mt-1">SOH</span>
        </div>
      )}

      {/* BMS Cell Grid 4x4 */}
      {bms && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[20px] text-gray-500 font-medium">16S4P</span>
            <span className="text-[20px] text-gray-400">{bms.totalVoltage.toFixed(1)}V</span>
            <span className="text-[20px] text-gray-400">Δ{bms.maxCellDeltaMV.toFixed(0)}mV</span>
          </div>
          {/* Cell voltage grid 4x4 */}
          <div className="grid grid-cols-4 gap-0.5" style={{ width: '380px' }}>
            {bms.voltages.slice(0, 16).map((voltage, i) => (
              <div
                key={i}
                className="w-24 h-12 flex flex-col items-center justify-center text-[18px] font-medium transition-all duration-300 rounded-sm"
                style={{
                  backgroundColor: voltageToColor(voltage),
                  color: '#fff',
                }}
                title={`S${i + 1}: ${voltageToLabel(voltage)}V`}
              >
                <span>S{i + 1}</span>
                <span className="text-[14px] opacity-75">{voltageToLabel(voltage)}</span>
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-2 mt-1 text-[14px] text-gray-500">
            <div className="flex items-center gap-0.5">
              <div className="w-2 h-2 bg-green-500 rounded-sm" />
              <span>&gt;3400</span>
            </div>
            <div className="flex items-center gap-0.5">
              <div className="w-2 h-2 bg-yellow-400 rounded-sm" />
              <span>3200-3400</span>
            </div>
            <div className="flex items-center gap-0.5">
              <div className="w-2 h-2 bg-orange-500 rounded-sm" />
              <span>3000-3200</span>
            </div>
            <div className="flex items-center gap-0.5">
              <div className="w-2 h-2 bg-red-500 rounded-sm" />
              <span>&lt;3000</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
