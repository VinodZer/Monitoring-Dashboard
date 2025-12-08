"use client"

import { useMemo } from "react"
import type { TickData } from "@/hooks/use-tick-data"
import { depthPlusLtp } from "@/utils/depth-ltp"

interface CandlestickChartProps {
  ticks: TickData[]
  instrumentToken: number
  height?: number
  width?: number
}

const INDEX_TOKENS = new Set<number>([265, 256265, 260105, 26009, 12839]) // SENSEX, NIFTY, BANKNIFTY, etc.

export function CandlestickChart({ ticks, instrumentToken, height = 96, width = 252 }: CandlestickChartProps) {
  const movement = useMemo(() => {
    const instrumentTicks = ticks
      .filter((t) => t.instrument_token === instrumentToken)
      .sort((a, b) => a.timestamp - b.timestamp)

    // Compute depth+ltp prices chronologically
    const points: Array<{ price: number; timestamp: number }> = []
    for (const t of instrumentTicks) {
      const price = depthPlusLtp({
        last_price: t.last_price,
        average_price: t.average_price,
        depth: t.depth,
      })
      if (Number.isFinite(price) && price >= 0) {
        points.push({ price, timestamp: t.timestamp })
      }
    }

    // Keep last N points for compact sparkline
    const maxPoints = 60
    const trimmed = points.length > maxPoints ? points.slice(-maxPoints) : points

    return trimmed
  }, [ticks, instrumentToken])

  // Remove movement logic for non-indices: short-circuit and render a static placeholder
  if (!INDEX_TOKENS.has(instrumentToken)) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-800 border dark:border-gray-700 rounded">
        <div className="text-center px-2">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Chart disabled</div>
          <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Movement shown only for indices</div>
        </div>
      </div>
    )
  }

  if (movement.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="text-sm font-medium">NO DATA</div>
          <div className="text-xs mt-1">No ticks received</div>
        </div>
      </div>
    )
  }

  // Prepare chart geometry
  const margin = { top: 8, right: 2, bottom: 18, left: 8 }
  const chartWidth = Math.max(20, (width ?? 252) - margin.left - margin.right)
  const chartHeight = Math.max(20, (height ?? 96) - margin.top - margin.bottom)

  const prices = movement.map((p) => p.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const range = maxPrice - minPrice

  // Add padding to avoid flat lines
  const pad = range > 0 ? range * 0.06 : (maxPrice || 1) * 0.01
  const chartMin = minPrice - pad
  const chartMax = maxPrice + pad
  const effectiveRange = chartMax - chartMin

  const getX = (i: number) => {
    if (movement.length <= 1) return margin.left + chartWidth
    const step = chartWidth / (movement.length - 1)
    return margin.left + i * step
  }
  const getY = (price: number) => {
    if (!Number.isFinite(price) || !Number.isFinite(effectiveRange) || effectiveRange <= 0) {
      return margin.top + chartHeight / 2
    }
    const normalized = (price - chartMin) / effectiveRange
    return margin.top + (1 - normalized) * chartHeight
  }

  // Build smooth path (cubic bezier)
  const createSmoothPath = () => {
    if (movement.length < 2) return ""
    const tension = 0.3
    let d = `M ${getX(0)} ${getY(movement[0].price)}`
    for (let i = 1; i < movement.length; i++) {
      const x = getX(i)
      const y = getY(movement[i].price)
      const px = getX(i - 1)
      const py = getY(movement[i - 1].price)

      const ppx = i - 2 >= 0 ? getX(i - 2) : px
      const ppy = i - 2 >= 0 ? getY(movement[i - 2].price) : py
      const nx = i + 1 < movement.length ? getX(i + 1) : x
      const ny = i + 1 < movement.length ? getY(movement[i + 1].price) : y

      const cp1x = px + (x - ppx) * tension
      const cp1y = py + (y - ppy) * tension
      const cp2x = x - (nx - px) * tension
      const cp2y = y - (ny - py) * tension

      d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x} ${y}`
    }
    return d
  }

  const path = createSmoothPath()

  const last = movement[movement.length - 1]
  const first = movement[0]
  const change = last.price - first.price
  const up = change >= 0
  const stroke = up ? "#22c55e" : "#ef4444"

  // Gradient fill
  const gradientPath = (() => {
    if (!path) return ""
    const bottomY = margin.top + chartHeight
    return `M ${getX(0)} ${bottomY} L ${getX(0)} ${getY(movement[0].price)} ${path.substring(
      path.indexOf(" ") + 1,
    )} L ${getX(movement.length - 1)} ${bottomY} Z`
  })()

  return (
    <div className="w-full h-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded overflow-hidden">
      <svg width={width} height={height} className="bg-white dark:bg-gray-800">
        {/* Background */}
        <rect width="100%" height="100%" fill="currentColor" className="fill-white dark:fill-gray-800" />

        {/* Grid lines */}
        <g stroke="currentColor" strokeWidth="1" className="stroke-gray-200 dark:stroke-gray-600">
          {[0.25, 0.5, 0.75].map((ratio) => {
            const y = margin.top + chartHeight * ratio
            return <line key={ratio} x1={margin.left} y1={y} x2={(width ?? 252) - margin.right} y2={y} />
          })}
        </g>

        {/* Area fill */}
        <defs>
          <linearGradient id={`dpltp-grad-${instrumentToken}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.06" />
          </linearGradient>
        </defs>
        {gradientPath && <path d={gradientPath} fill={`url(#dpltp-grad-${instrumentToken})`} stroke="none" />}

        {/* Main line */}
        {path && (
          <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Last point */}
        <circle
          cx={getX(movement.length - 1)}
          cy={getY(last.price)}
          r={3.5}
          fill={stroke}
          stroke="currentColor"
          strokeWidth="1.5"
          className="stroke-white dark:stroke-gray-800"
        >
          <title>
            {`Depth+LTP: ₹${last.price.toFixed(2)}
Time: ${new Date(last.timestamp).toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour12: false,
            })}`}
          </title>
        </circle>

        {/* Axis labels (compact) */}
        <g fill="currentColor" className="fill-gray-600 dark:fill-gray-400" fontSize="8" fontFamily="monospace">
          <text x={margin.left + 2} y={(height ?? 96) - 4} textAnchor="start">
            {new Date(movement[0].timestamp).toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
            })}
          </text>
          <text x={(width ?? 252) - 5} y={(height ?? 96) - 4} textAnchor="end">
            {new Date(movement[movement.length - 1].timestamp).toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
            })}
          </text>
        </g>
      </svg>
    </div>
  )
}
