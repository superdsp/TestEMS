// Power Gauge Component - Circular gauge for power display

interface PowerGaugeProps {
  value: number
  maxValue: number
  label: string
  unit?: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
}

export default function PowerGauge({
  value,
  maxValue,
  label,
  unit = 'kW',
  color = '#3b82f6',
  size = 'md',
}: PowerGaugeProps) {
  const sizeConfig = {
    sm: { width: 80, strokeWidth: 6, fontSize: 12 },
    md: { width: 100, strokeWidth: 8, fontSize: 16 },
    lg: { width: 140, strokeWidth: 10, fontSize: 20 },
  }

  const config = sizeConfig[size]
  const radius = (config.width - config.strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percentage = Math.min(100, (Math.abs(value) / maxValue) * 100)
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  // Determine color based on value direction
  const displayColor = value < 0 ? '#f97316' : value > 0 ? color : '#9ca3af'

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: config.width, height: config.width }}>
        <svg width={config.width} height={config.width} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={config.strokeWidth}
          />
          {/* Value arc */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            stroke={displayColor}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-300"
          />
        </svg>
        {/* Centered text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold text-gray-800" style={{ fontSize: config.fontSize }}>
            {value.toFixed(1)}
          </span>
          <span className="text-xs text-gray-500">{unit}</span>
        </div>
      </div>
      <span className="text-xs text-gray-600 mt-2 font-medium">{label}</span>
    </div>
  )
}
