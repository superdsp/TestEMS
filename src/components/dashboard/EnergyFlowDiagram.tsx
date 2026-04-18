// Energy Flow Diagram - PV and Battery connect to PCS which connects to AC Bus
// Layout: Top row (PV, PCS, Battery) aligned, AC Bus centered, bottom row (Grid, Load) aligned

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

  // Flow directions - lower thresholds for better visibility
  const pvFlow = snapshot.pv.powerKW > 0.1
  const batteryActive = Math.abs(snapshot.battery.powerKW) > 0.1
  const loadActive = snapshot.balance.totalLoadKW > 0.1
  const gridFlow = Math.abs(snapshot.grid.powerKW) > 0.1
  // PCS active when there's load or battery activity
  const pcsActive = snapshot.balance.totalLoadKW > 0.1 || batteryActive

  // Constants - symmetric layout
  const topY = 65           // Top row circle center Y
  const bottomY = 195       // Bottom row circle center Y
  const busY = 130         // AC Bus centered between top and bottom rows
  const radius = 36        // Circle radius

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">能量流向图</h2>

      {/* SVG Container */}
      <svg viewBox="0 0 600 280" className="w-full h-auto">
        <defs>
          <style>{`
            .flow-line {
              stroke-dasharray: 12, 6;
              animation: flowAnim 1.5s linear infinite;
            }
            @keyframes flowAnim {
              from { stroke-dashoffset: 18; }
              to { stroke-dashoffset: 0; }
            }
            .bus-line {
              stroke: #1e3a5f;
              stroke-width: 8;
              stroke-linecap: round;
            }
          `}</style>
        </defs>

        {/* Main Horizontal AC Bus - centered */}
        <line x1="40" y1={busY} x2="560" y2={busY} className="bus-line" />

        {/* Bus Label */}
        <text x="300" y={busY + 28} textAnchor="middle" fill="#1e3a5f" fontSize="12" fontWeight="bold">AC Bus 0.4KV</text>

        {/* Connection lines */}

        {/* PV to Bus - vertical from circle bottom edge to bus */}
        <line
          x1="100" y1={topY + radius}
          x2="100" y2={busY - 8}
          stroke={pvFlow ? "#22c55e" : "#d1d5db"}
          strokeWidth={pvFlow ? 5 : 2}
          className={pvFlow ? "flow-line" : ""}
        />

        {/* Battery to PCS - horizontal line from battery right edge to PCS left edge */}
        <line
          x1="536" y1={topY}
          x2="264" y2={topY}
          stroke={batteryActive ? "#f97316" : "#d1d5db"}
          strokeWidth={batteryActive ? 5 : 2}
          className={batteryActive ? "flow-line" : ""}
        />

        {/* PCS to Bus - vertical from circle bottom edge to bus */}
        <line
          x1="300" y1={topY + radius}
          x2="300" y2={busY - 8}
          stroke={pcsActive ? "#3b82f6" : "#d1d5db"}
          strokeWidth={pcsActive ? 5 : 2}
          className={pcsActive ? "flow-line" : ""}
        />

        {/* Grid to Bus - vertical from bus to circle top edge */}
        <line
          x1="180" y1={busY + 8}
          x2="180" y2={bottomY - radius}
          stroke={gridFlow ? "#eab308" : "#d1d5db"}
          strokeWidth={gridFlow ? 5 : 2}
          className={gridFlow ? "flow-line" : ""}
        />

        {/* Load to Bus - vertical from bus to circle top edge */}
        <line
          x1="420" y1={busY + 8}
          x2="420" y2={bottomY - radius}
          stroke={loadActive ? "#ef4444" : "#d1d5db"}
          strokeWidth={loadActive ? 5 : 2}
          className={loadActive ? "flow-line" : ""}
        />

        {/* PV Node - Top Left */}
        <g transform={`translate(100, ${topY})`}>
          <circle r="36" fill={pvFlow ? "#dcfce7" : "#f3f4f6"} stroke={pvFlow ? "#22c55e" : "#d1d5db"} strokeWidth="3" />
          <text y="-8" textAnchor="middle" fill={pvFlow ? "#16a34a" : "#9ca3af"} fontSize="10" fontWeight="bold">光伏</text>
          <text y="6" textAnchor="middle" fill={pvFlow ? "#15803d" : "#6b7280"} fontSize="14" fontWeight="bold">{snapshot.pv.powerKW.toFixed(1)}</text>
          <text y="20" textAnchor="middle" fill="#9ca3af" fontSize="9">kW</text>
        </g>

        {/* PCS Node - Top Center */}
        <g transform={`translate(300, ${topY})`}>
          <circle r="36" fill={pcsActive ? "#dbeafe" : "#f3f4f6"} stroke={pcsActive ? "#3b82f6" : "#d1d5db"} strokeWidth="3" />
          <text y="-8" textAnchor="middle" fill={pcsActive ? "#2563eb" : "#9ca3af"} fontSize="10" fontWeight="bold">PCS</text>
          <text y="6" textAnchor="middle" fill={pcsActive ? "#1d4ed8" : "#6b7280"} fontSize="14" fontWeight="bold">{snapshot.pcs.powerKW.toFixed(1)}</text>
          <text y="20" textAnchor="middle" fill="#9ca3af" fontSize="9">kW</text>
        </g>

        {/* Battery Node - Top Right */}
        <g transform={`translate(500, ${topY})`}>
          <circle r="36" fill={batteryActive ? "#ffedd5" : "#f3f4f6"} stroke={batteryActive ? "#f97316" : "#d1d5db"} strokeWidth="3" />
          <text y="-8" textAnchor="middle" fill={batteryActive ? "#c2410c" : "#9ca3af"} fontSize="10" fontWeight="bold">储能</text>
          <text y="6" textAnchor="middle" fill={batteryActive ? "#ea580c" : "#6b7280"} fontSize="14" fontWeight="bold">{snapshot.battery.socPercent.toFixed(0)}%</text>
          <text y="20" textAnchor="middle" fill="#9ca3af" fontSize="9">SOC</text>
        </g>

        {/* Grid Node - Bottom Left */}
        <g transform={`translate(180, ${bottomY})`}>
          <circle r="36" fill={gridFlow ? "#fef9c3" : "#f3f4f6"} stroke={gridFlow ? "#eab308" : "#d1d5db"} strokeWidth="3" />
          <text y="-8" textAnchor="middle" fill={gridFlow ? "#ca8a04" : "#9ca3af"} fontSize="10" fontWeight="bold">电网</text>
          <text y="6" textAnchor="middle" fill={gridFlow ? "#a16207" : "#6b7280"} fontSize="14" fontWeight="bold">{snapshot.grid.powerKW >= 0 ? "+" : ""}{snapshot.grid.powerKW.toFixed(1)}</text>
          <text y="20" textAnchor="middle" fill="#9ca3af" fontSize="9">kW</text>
        </g>

        {/* Load Node - Bottom Right */}
        <g transform={`translate(420, ${bottomY})`}>
          <circle r="36" fill={loadActive ? "#fee2e2" : "#f3f4f6"} stroke={loadActive ? "#ef4444" : "#d1d5db"} strokeWidth="3" />
          <text y="-8" textAnchor="middle" fill={loadActive ? "#dc2626" : "#9ca3af"} fontSize="10" fontWeight="bold">负载</text>
          <text y="6" textAnchor="middle" fill={loadActive ? "#b91c1c" : "#6b7280"} fontSize="14" fontWeight="bold">{snapshot.balance.totalLoadKW.toFixed(1)}</text>
          <text y="20" textAnchor="middle" fill="#9ca3af" fontSize="9">kW</text>
        </g>
      </svg>
    </div>
  )
}
