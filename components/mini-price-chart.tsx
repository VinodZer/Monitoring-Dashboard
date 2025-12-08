"use client"

import { useMemo } from "react"
import type { TickData } from "@/hooks/use-tick-data"
import { depthPlusLtp } from "@/utils/depth-ltp"

// Single data type (Kite)
type ChartTickData = TickData

/**
 * Determine whether a given instrument token or tradingsymbol represents an
 * index (e.g., NIFTY, SENSEX). This helps chart logic choose appropriate
 * averaging and formatting rules.
 *
 * @param instrumentToken - Numeric or string token identifying the instrument
 * @param tradingsymbol - Optional tradingsymbol to assist classification
 * @returns boolean true when the instrument is an index
 */
const isIndex = (instrumentToken: number | string, tradingsymbol?: string): boolean => {
  const token =
    typeof instrumentToken === "string" ? Number.parseInt(instrumentToken.replace(/[^0-9]/g, "")) || 0 : instrumentToken
  const INDEX_TOKENS = new Set<number>([265, 256265, 260105, 26009, 12839])
  const EXACT_INDEX_NAMES = new Set<string>(["SENSEX", "NIFTY 50", "NIFTY", "NIFTY BANK", "BANKNIFTY", "BANKEX"])
  if (INDEX_TOKENS.has(token)) return true
  const tokenStr = String(instrumentToken).toUpperCase()
  if (tokenStr.includes("INDEX")) return true
  const sym = (tradingsymbol || "").toUpperCase()
  if (sym.includes("FUT") || sym.endsWith("CE") || sym.endsWith("PE")) return false
  if (EXACT_INDEX_NAMES.has(sym)) return true
  return false
}

interface MiniPriceChartProps {
  ticks: ChartTickData[]
  instrumentToken: number | string
  height?: number
  className?: string
  useBookPrice?: boolean
  bottomSpacer?: number
  strokeWidth?: number
  gradientOpacity?: number
  gradientEndOpacity?: number
}

/**
 * MiniPriceChart renders a small, mobile-friendly chart for a single
 * instrument using recent ticks. It smooths and densifies points for a
 * visually pleasing SVG path and computes chart metrics used by surrounding UI.
 *
 * @param props.ticks - Array of TickData
 * @param props.instrumentToken - Token identifying the instrument to chart
 * @param props.height - Pixel height of the chart
 * @param props.className - Optional class name(s) for the container
 * @param props.useBookPrice - Whether to prefer depth-based prices over LTP
 * @param props.strokeWidth - Optional stroke width override
 * @param props.gradientOpacity - Optional gradient start opacity override
 * @param props.gradientEndOpacity - Optional gradient end opacity override
 */
export function MiniPriceChart({
  ticks,
  instrumentToken,
  height = 60,
  className = "",
  useBookPrice = true,
  bottomSpacer = 0,
  strokeWidth,
  gradientOpacity,
  gradientEndOpacity,
}: MiniPriceChartProps) {
  const normalizeTokenForCompare = (val: string | number): string => {
    const s = String(val)
    const digits = s.match(/\d+/g)
    return digits ? digits.join("") : s
  }

  const normalizedCompareToken = normalizeTokenForCompare(instrumentToken)
  const latestTickForToken = useMemo(() => {
    const toKey = (t: string | number) => normalizeTokenForCompare(t)
    return (
      ticks
        .filter((t) => toKey(t.instrument_token) === normalizedCompareToken)
        .sort((a, b) => b.timestamp - a.timestamp)[0] || null
    )
  }, [ticks, normalizedCompareToken])

  const isIndexInstrument = useMemo(() => {
    const tradingSymbol = latestTickForToken ? latestTickForToken.tradingsymbol : undefined
    return isIndex(instrumentToken, tradingSymbol)
  }, [instrumentToken, latestTickForToken])

  const chartData = useMemo(() => {
    const getAverageMarketPrice = (tick: ChartTickData): number => {
      if (!isIndexInstrument) {
        return depthPlusLtp({
          last_price: tick.last_price,
          average_price: tick.average_price,
          depth: tick.depth,
        })
      }
      const ltp = typeof tick.last_price === "number" ? tick.last_price : 0
      return Number.isFinite(ltp) ? ltp : 0
    }

    const instrumentTicks = ticks
      .filter((tick) => {
        const price = getAverageMarketPrice(tick)
        const tickToken = normalizeTokenForCompare(tick.instrument_token)
        return tickToken === normalizedCompareToken && Number.isFinite(price) && price >= 0
      })
      .sort((a: any, b: any) => {
        if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
        if (typeof a.receivedAt === "number" && typeof b.receivedAt === "number") return a.receivedAt - b.receivedAt
        if (typeof a.id === "string" && typeof b.id === "string") return a.id.localeCompare(b.id)
        return 0
      })
      .slice(-300)

    if (instrumentTicks.length < 2) {
      return {
        path: "",
        gradientPath: "",
        color: "#9ca3af",
        hasData: false,
        currentPrice: 0,
        priceChange: 0,
        changePercent: 0,
        chartMin: 0,
        chartMax: 0,
        effectiveChartRange: 0,
        movementPoints: [],
      }
    }

    const chartWidth = 300
    const chartHeight = height

    // Use effective height for drawing the line graph, reserving bottomSpacer
    const effectiveHeight = chartHeight - (bottomSpacer || 0)
    const paddingY = Math.max(4, effectiveHeight * 0.08)
    const paddingX = 0 // No horizontal padding to stretch full width
    const innerHeight = effectiveHeight - paddingY * 2
    const innerWidth = chartWidth - paddingX * 2

    const maxVisiblePoints = Math.max(20, Math.min(100, Math.floor(chartWidth / 6)))
    const movementPoints: Array<{ price: number; timestamp: number; originalTicks: ChartTickData[] }> = []
    let pointsForGeometry = movementPoints as typeof movementPoints

    for (const tick of instrumentTicks) {
      const price = getAverageMarketPrice(tick)
      if (isFinite(price) && price >= 0) {
        movementPoints.push({ price, timestamp: tick.timestamp, originalTicks: [tick] })
      }
    }

    movementPoints.sort((a, b) => a.timestamp - b.timestamp)

    if (movementPoints.length > maxVisiblePoints) {
      movementPoints.splice(0, movementPoints.length - maxVisiblePoints)
    }

    if (movementPoints.length < 2 && instrumentTicks.length > 0) {
      const recentTicks = instrumentTicks.slice(-2)
      movementPoints.length = 0
      for (const tick of recentTicks) {
        const price = getAverageMarketPrice(tick)
        if (isFinite(price) && price >= 0) {
          movementPoints.push({ price, timestamp: tick.timestamp, originalTicks: [tick] })
        }
      }
      movementPoints.sort((a, b) => a.timestamp - b.timestamp)
    }

    // Build smoother geometry: EMA smoothing + midpoint densification
    if (movementPoints.length >= 2) {
      const alpha = 0.35
      const smoothed: typeof movementPoints = []
      let prev = movementPoints[0].price
      for (const p of movementPoints) {
        prev = alpha * p.price + (1 - alpha) * prev
        smoothed.push({ ...p, price: prev })
      }
      const densified: typeof movementPoints = []
      for (let i = 0; i < smoothed.length - 1; i++) {
        const a = smoothed[i]
        const b = smoothed[i + 1]
        densified.push(a)
        const midPrice = (a.price + b.price) / 2
        const midTs = a.timestamp + (b.timestamp - a.timestamp) / 2
        densified.push({ price: midPrice, timestamp: midTs, originalTicks: [...a.originalTicks, ...b.originalTicks] })
      }
      densified.push(smoothed[smoothed.length - 1])
      pointsForGeometry = densified
    }

    if (movementPoints.length < 1) {
      return {
        path: "",
        gradientPath: "",
        color: "#9ca3af",
        hasData: false,
        currentPrice: 0,
        priceChange: 0,
        changePercent: 0,
        chartMin: 0,
        chartMax: 0,
        effectiveChartRange: 0,
        movementPoints: [],
      }
    }

    const prices = movementPoints.map((point) => point.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    let priceRange = maxPrice - minPrice
    let padding = priceRange * 0.05 || maxPrice * 0.02

    if (priceRange <= 0 || !isFinite(priceRange)) {
      const basePrice = maxPrice || minPrice || 1
      padding = basePrice * 0.001 || 0.1
      priceRange = padding * 2
    }

    if (padding <= 0) {
      padding = (maxPrice || 1) * 0.001 || 0.1
    }

    const chartMin = minPrice - padding
    const chartMax = maxPrice + padding
    const effectiveChartRange = chartMax - chartMin

    const getX = (index: number) => {
      const totalPoints = pointsForGeometry.length
      if (totalPoints <= 1) return paddingX + innerWidth
      const pointSpacing = innerWidth / Math.max(1, totalPoints - 1)
      return paddingX + index * pointSpacing
    }

    const getY = (price: number): number => {
      if (!isFinite(price) || !isFinite(effectiveChartRange) || effectiveChartRange <= 0) return effectiveHeight / 2
      const normalizedY = ((price - chartMin) / effectiveChartRange) * innerHeight
      const y = effectiveHeight - paddingY - normalizedY
      return Math.max(paddingY, Math.min(effectiveHeight - paddingY, y))
    }

    const createSmoothPath = (points: typeof movementPoints) => {
      if (points.length < 2) return ""
      if (points.length === 2) {
        const x1 = getX(0)
        const y1 = getY(points[0].price)
        const x2 = getX(1)
        const y2 = getY(points[1].price)
        if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return ""
        return `M ${x1} ${y1} L ${x2} ${y2}`
      }
      const startX = getX(0)
      const startY = getY(points[0].price)
      if (!isFinite(startX) || !isFinite(startY)) return ""
      let path = `M ${startX} ${startY}`
      for (let i = 1; i < points.length; i++) {
        const currentX = getX(i)
        const currentY = getY(points[i].price)
        const prevX = getX(i - 1)
        const prevY = getY(points[i - 1].price)
        if (!isFinite(currentX) || !isFinite(currentY) || !isFinite(prevX) || !isFinite(prevY)) continue
        const tension = 0.2
        let cp1x, cp1y, cp2x, cp2y
        if (i === 1) {
          const nextX = i + 1 < points.length ? getX(i + 1) : currentX
          const nextY = i + 1 < points.length ? getY(points[i + 1].price) : currentY
          cp1x = prevX + (currentX - prevX) * tension
          cp1y = prevY + (currentY - prevY) * tension
          cp2x = currentX - (nextX - prevX) * tension
          cp2y = currentY - (nextY - prevY) * tension
        } else if (i === points.length - 1) {
          const prev2X = getX(i - 2)
          const prev2Y = getY(points[i - 2].price)
          cp1x = prevX + (currentX - prev2X) * tension
          cp1y = prevY + (currentY - prev2Y) * tension
          cp2x = currentX - (currentX - prevX) * tension
          cp2y = currentY - (currentY - prevY) * tension
        } else {
          const prev2X = getX(i - 2)
          const prev2Y = getY(points[i - 2].price)
          const nextX = getX(i + 1)
          const nextY = getY(points[i + 1].price)
          cp1x = prevX + (currentX - prev2X) * tension
          cp1y = prevY + (currentY - prev2Y) * tension
          cp2x = currentX - (nextX - prevX) * tension
          cp2y = currentY - (nextY - prevY) * tension
        }
        path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${currentX} ${currentY}`
      }
      return path
    }

    const path = createSmoothPath(pointsForGeometry)

    const createSmoothGradientPath = (points: typeof movementPoints) => {
      if (points.length < 2) return ""
      const smoothCurvePath = createSmoothPath(points)
      // Gradient extends to the full chart height (ignoring bottom spacer)
      const bottomY = chartHeight
      return `M ${getX(0)} ${bottomY} L ${getX(0)} ${getY(points[0].price)} ${smoothCurvePath.substring(
        smoothCurvePath.indexOf(" ") + 1,
      )} L ${getX(points.length - 1)} ${bottomY} Z`
    }

    const gradientPath = createSmoothGradientPath(pointsForGeometry)

    const currentPrice = movementPoints[movementPoints.length - 1].price
    const firstPrice = movementPoints[0].price
    const priceChange = currentPrice - firstPrice
    const changePercent = firstPrice !== 0 ? (priceChange / firstPrice) * 100 : 0

    const isPositive = priceChange > 0
    const isNegative = priceChange < 0

    const absChangePercent = Math.abs(changePercent)
    const isMicroMovement = absChangePercent > 0 && absChangePercent < 0.01

    let color = "#9ca3af"
    let gradientColor = "rgba(156, 163, 175, 0.1)"

    if (isPositive) {
      color = isMicroMovement ? "#10b981" : "#22c55e"
      gradientColor = isMicroMovement ? "rgba(16, 185, 129, 0.15)" : "rgba(34, 197, 94, 0.1)"
    } else if (isNegative) {
      color = isMicroMovement ? "#f43f5e" : "#ef4444"
      gradientColor = isMicroMovement ? "rgba(244, 63, 94, 0.15)" : "rgba(239, 68, 68, 0.1)"
    }

    return {
      path,
      gradientPath,
      color,
      gradientColor,
      hasData: true,
      currentPrice,
      priceChange,
      changePercent,
      isPositive,
      isNegative,
      chartMin,
      chartMax,
      effectiveChartRange,
      getY,
      movementPoints,
    }
  }, [ticks, instrumentToken, height, useBookPrice, isIndexInstrument, latestTickForToken, bottomSpacer])

  if (!chartData.hasData) {
    return (
      <div
        className={`w-full flex items-center justify-center bg-gray-50 dark:bg-[#1e222d] rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-600 ${className}`}
        style={{ height }}
      >
        <div className="text-center">
          <div className="text-sm text-gray-400 dark:text-gray-500 font-medium">No Chart Data</div>
          <div className="text-xs text-gray-300 dark:text-gray-600 mt-1">Waiting for ticks...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full relative ${className}`} style={{ height, minHeight: height, maxHeight: height }}>
      <div className="relative w-full h-full" style={{ height, minHeight: height, maxHeight: height }}>
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 300 ${height}`}
          preserveAspectRatio="none"
          style={{
            maxHeight: height,
            overflow: "visible",
            margin: 0,
            padding: 0,
            width: "100%",
            height: "100%",
          }}
        >
          <defs>
            <linearGradient id={`gradient-${instrumentToken}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={chartData.color} stopOpacity={gradientOpacity !== undefined ? gradientOpacity : "0.3"} />
              <stop offset="100%" stopColor={chartData.color} stopOpacity={gradientEndOpacity !== undefined ? gradientEndOpacity : "0.05"} />
            </linearGradient>
            <clipPath id={`chart-clip-${instrumentToken}`}>
              <rect x="0" y="0" width="300" height={height} />
            </clipPath>
          </defs>
          <g clipPath={`url(#chart-clip-${instrumentToken})`}>
            <path
              d={chartData.gradientPath}
              fill={`url(#gradient-${instrumentToken})`}
              stroke="none"

            />
            <path
              d={chartData.path}
              fill="none"
              stroke={chartData.color}
              strokeWidth={strokeWidth !== undefined ? strokeWidth : Math.min(1.5, height * 0.03)}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-sm"
              style={{
                filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))",
              }}
            />
          </g>
        </svg>
      </div>
    </div>
  )
}

/**
 * Normalize an instrument token to a digits-only string for stable comparisons
 * across different token representations.
 * @param tickToken - Token as string or number
 * @returns Normalized digits-only token string
 */
const normalizeTickToken = (tickToken: string | number): string => {
  const s = String(tickToken)
  const digits = s.match(/\d+/g)
  return digits ? digits.join("") : s
}
