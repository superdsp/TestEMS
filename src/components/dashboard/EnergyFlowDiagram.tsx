// Energy Flow Diagram - Particle flow animation
import type { SystemSnapshot } from '../../lib/types'

interface EnergyFlowDiagramProps {
  snapshot: SystemSnapshot | null
}

export default function EnergyFlowDiagram({ snapshot }: EnergyFlowDiagramProps) {
  if (!snapshot) {
    return (
      <div className="flex items-center justify-center h-80 bg-white rounded-xl shadow-sm border border-gray-200">
        <p className="text-gray-500">等待数据...</p>
      </div>
    )
  }

  // Flow directions - lower thresholds
  const pvFlow = snapshot.pv.powerKW > 0.05
  const batteryActive = Math.abs(snapshot.battery.powerKW) > 0.3
  const loadActive = snapshot.balance.totalLoadKW > 0.05
  const gridFlow = Math.abs(snapshot.grid.powerKW) > 0.05

  const batteryDischarging = snapshot.battery.powerKW > 0.1
  const pcsToBus = snapshot.pcs.powerKW > 0.1
  const pcsFromBus = snapshot.pcs.powerKW < -0.1
  const gridFlowToBus = snapshot.grid.powerKW > 0.1

  // Layout constants
  const radius = 29
  const topY = 55
  const bottomY = 210
  const busY = 135

  // Node X positions
  const pvX = 100
  const pcsX = 300
  const battX = 500
  const gridX = 180
  const loadX = 420

  // Vertical line endpoints
  const pvY1 = topY + radius
  const pvY2 = busY - 4
  const pcsY1 = topY + radius
  const pcsY2 = busY - 4
  const gridY1 = busY + 4
  const gridY2 = bottomY - radius
  const loadY1 = busY + 4
  const loadY2 = bottomY - radius

  // Horizontal line (Battery to PCS) - at top circle level
  const battLineY = topY
  const battLineX1 = battX - radius  // 471
  const battLineX2 = pcsX + radius   // 329

  // Helper to create particles
  const createParticles = (cx: number, cy: number, color: string, direction: 'down' | 'up' | 'left' | 'right', y1: number, y2: number, x1?: number, x2?: number) => {
    const particles = []
    for (let i = 0; i < 5; i++) {
      const delay = i * 0.35
      if (direction === 'down' || direction === 'up') {
        const startY = direction === 'down' ? y1 : y2
        const endY = direction === 'down' ? y2 : y1
        particles.push(
          <circle key={i} cx={cx} cy={startY} r="2.5" fill={color}>
            <animate attributeName="cy" values={`${startY};${endY}`} dur="2.5s" repeatCount="indefinite" begin={`${delay}s`} />
            <animate attributeName="opacity" values="1;0" dur="2.5s" repeatCount="indefinite" begin={`${delay}s`} />
          </circle>
        )
      } else {
        const startX = direction === 'right' ? x1 : x2
        const endX = direction === 'right' ? x2 : x1
        particles.push(
          <circle key={i} cx={startX} cy={cy} r="2.5" fill={color}>
            <animate attributeName="cx" values={`${startX};${endX}`} dur="2s" repeatCount="indefinite" begin={`${delay}s`} />
            <animate attributeName="opacity" values="1;0" dur="2s" repeatCount="indefinite" begin={`${delay}s`} />
          </circle>
        )
      }
    }
    return particles
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">能量流向图</h2>

      <svg viewBox="0 0 600 280" className="w-full h-auto">
        <defs>
          <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* AC Bus Line */}
        <line x1="40" y1={busY} x2="560" y2={busY} stroke="#1e3a5f" strokeWidth="6" strokeLinecap="round" />
        <text x="300" y={busY + 24} textAnchor="middle" fill="#1e3a5f" fontSize="11" fontWeight="bold">AC Bus 380V</text>

        {/* ========== PV to Bus (Vertical) ========== */}
        <line x1={pvX} y1={pvY1} x2={pvX} y2={pvY2} stroke={pvFlow ? "#22c55e" : "#d1d5db"} strokeWidth={pvFlow ? 4 : 2} strokeLinecap="round" />
        {pvFlow && (
          <g filter="url(#glow)">
            {createParticles(pvX, 0, "#22c55e", 'down', pvY1, pvY2)}
          </g>
        )}

        {/* ========== PCS to Bus (Vertical) ========== */}
        <line x1={pcsX} y1={pcsY1} x2={pcsX} y2={pcsY2} stroke={pcsToBus || pcsFromBus ? "#3b82f6" : "#d1d5db"} strokeWidth={pcsToBus || pcsFromBus ? 4 : 2} strokeLinecap="round" />
        {(pcsToBus || pcsFromBus) && (
          <g filter="url(#glow)">
            {createParticles(pcsX, 0, "#3b82f6", pcsToBus ? 'down' : 'up', pcsY1, pcsY2)}
          </g>
        )}

        {/* ========== Battery to PCS (Horizontal) ========== */}
        <line x1={battLineX2} y1={battLineY} x2={battLineX1} y2={battLineY} stroke={batteryActive ? "#f97316" : "#d1d5db"} strokeWidth={batteryActive ? 4 : 2} strokeLinecap="round" />
        {batteryActive && (
          <g filter="url(#glow)">
            {createParticles(0, battLineY, "#f97316", batteryDischarging ? 'left' : 'right', 0, 0, battLineX2, battLineX1)}
          </g>
        )}

        {/* ========== Grid to Bus (Vertical) ========== */}
        <line x1={gridX} y1={gridY1} x2={gridX} y2={gridY2} stroke={gridFlow ? "#eab308" : "#d1d5db"} strokeWidth={gridFlow ? 4 : 2} strokeLinecap="round" />
        {gridFlow && (
          <g filter="url(#glow)">
            {createParticles(gridX, 0, "#eab308", gridFlowToBus ? 'up' : 'down', gridY1, gridY2)}
          </g>
        )}

        {/* ========== Load to Bus (Vertical) ========== */}
        <line x1={loadX} y1={loadY1} x2={loadX} y2={loadY2} stroke={loadActive ? "#ef4444" : "#d1d5db"} strokeWidth={loadActive ? 4 : 2} strokeLinecap="round" />
        {loadActive && (
          <g filter="url(#glow)">
            {createParticles(loadX, 0, "#ef4444", 'down', loadY1, loadY2)}
          </g>
        )}

        {/* ========== NODES ========== */}

        {/* PV Node */}
        <g transform={`translate(${pvX}, ${topY})`}>
          <circle r={radius} fill={pvFlow ? "#dcfce7" : "#f3f4f6"} stroke={pvFlow ? "#22c55e" : "#d1d5db"} strokeWidth="2.5" />
          <text y="-6" textAnchor="middle" fill={pvFlow ? "#16a34a" : "#9ca3af"} fontSize="9" fontWeight="bold">光伏</text>
          <text y="8" textAnchor="middle" fill={pvFlow ? "#15803d" : "#6b7280"} fontSize="13" fontWeight="bold">{snapshot.pv.powerKW.toFixed(1)}</text>
          <text y="20" textAnchor="middle" fill="#9ca3af" fontSize="8">kW</text>
        </g>

        {/* PCS Node */}
        <g transform={`translate(${pcsX}, ${topY})`}>
          <circle r={radius} fill={pcsToBus || pcsFromBus ? "#dbeafe" : "#f3f4f6"} stroke={pcsToBus || pcsFromBus ? "#3b82f6" : "#d1d5db"} strokeWidth="2.5" />
          <text y="-6" textAnchor="middle" fill={pcsToBus || pcsFromBus ? "#2563eb" : "#9ca3af"} fontSize="9" fontWeight="bold">PCS</text>
          <text y="8" textAnchor="middle" fill={pcsToBus || pcsFromBus ? "#1d4ed8" : "#6b7280"} fontSize="13" fontWeight="bold">{snapshot.pcs.powerKW.toFixed(1)}</text>
          <text y="20" textAnchor="middle" fill="#9ca3af" fontSize="8">kW</text>
        </g>

        {/* Battery Node */}
        <g transform={`translate(${battX}, ${topY})`}>
          <circle r={radius} fill={batteryActive ? "#ffedd5" : "#f3f4f6"} stroke={batteryActive ? "#f97316" : "#d1d5db"} strokeWidth="2.5" />
          <text y="-6" textAnchor="middle" fill={batteryActive ? "#c2410c" : "#9ca3af"} fontSize="9" fontWeight="bold">储能</text>
          <text y="8" textAnchor="middle" fill={batteryActive ? "#ea580c" : "#6b7280"} fontSize="13" fontWeight="bold">{snapshot.battery.socPercent.toFixed(0)}%</text>
          <text y="20" textAnchor="middle" fill="#9ca3af" fontSize="8">SOC</text>
        </g>

        {/* Grid Node */}
        <g transform={`translate(${gridX}, ${bottomY})`}>
          <circle r={radius} fill={gridFlow ? "#fef9c3" : "#f3f4f6"} stroke={gridFlow ? "#eab308" : "#d1d5db"} strokeWidth="2.5" />
          <text y="-6" textAnchor="middle" fill={gridFlow ? "#ca8a04" : "#9ca3af"} fontSize="9" fontWeight="bold">电网</text>
          <text y="8" textAnchor="middle" fill={gridFlow ? "#a16207" : "#6b7280"} fontSize="13" fontWeight="bold">{snapshot.grid.powerKW >= 0 ? "+" : ""}{snapshot.grid.powerKW.toFixed(1)}</text>
          <text y="20" textAnchor="middle" fill="#9ca3af" fontSize="8">kW</text>
        </g>

        {/* Load Node */}
        <g transform={`translate(${loadX}, ${bottomY})`}>
          <circle r={radius} fill={loadActive ? "#fee2e2" : "#f3f4f6"} stroke={loadActive ? "#ef4444" : "#d1d5db"} strokeWidth="2.5" />
          <text y="-6" textAnchor="middle" fill={loadActive ? "#dc2626" : "#9ca3af"} fontSize="9" fontWeight="bold">负载</text>
          <text y="8" textAnchor="middle" fill={loadActive ? "#b91c1c" : "#6b7280"} fontSize="13" fontWeight="bold">{snapshot.balance.totalLoadKW.toFixed(1)}</text>
          <text y="20" textAnchor="middle" fill="#9ca3af" fontSize="8">kW</text>
        </g>
      </svg>
    </div>
  )
}
