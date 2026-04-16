// SOC (State of Charge) Indicator - Battery charge level display

interface SOCIndicatorProps {
  socPercent: number
  temperatureC?: number
  status?: 'charging' | 'discharging' | 'idle'
  size?: 'sm' | 'md' | 'lg'
}

export default function SOCIndicator({
  socPercent,
  temperatureC,
  status = 'idle',
  size = 'md',
}: SOCIndicatorProps) {
  const sizeConfig = {
    sm: { width: 60, height: 80, barHeight: 60 },
    md: { width: 80, height: 100, barHeight: 80 },
    lg: { width: 100, height: 120, barHeight: 100 },
  }

  const config = sizeConfig[size]
  const barHeight = config.barHeight
  const fillHeight = (socPercent / 100) * barHeight

  // Color based on SOC level
  const getColor = () => {
    if (socPercent <= 20) return '#dc2626' // Critical - red
    if (socPercent <= 40) return '#f59e0b' // Warning - orange
    return '#22c55e' // Normal - green
  }

  const statusIcon = {
    charging: (
      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative bg-gray-100 rounded-lg overflow-hidden border border-gray-200"
        style={{ width: config.width, height: config.height }}
      >
        {/* Battery outline */}
        <div className="absolute top-0 left-0 right-0 h-3 bg-gray-300 rounded-t-lg" />

        {/* Fill level */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-500"
          style={{
            height: fillHeight,
            backgroundColor: getColor(),
            opacity: 0.8,
          }}
        />

        {/* SOC text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-white drop-shadow-md" style={{ fontSize: size === 'lg' ? '18px' : '14px' }}>
            {socPercent.toFixed(0)}%
          </span>
        </div>

        {/* Status icon */}
        <div className="absolute top-4 right-1">{statusIcon[status]}</div>
      </div>

      {/* Temperature */}
      {temperatureC !== undefined && (
        <div className="mt-2 text-xs text-gray-500">
          {temperatureC.toFixed(1)}°C
        </div>
      )}

      <span className="text-xs text-gray-600 mt-1 font-medium">SOC</span>
    </div>
  )
}
