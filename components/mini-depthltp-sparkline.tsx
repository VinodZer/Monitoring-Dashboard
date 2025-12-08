"use client"

import { useMemo } from "react"
import type { TickData } from "@/hooks/use-tick-data"
import { depthPlusLtp } from "@/utils/depth-ltp"

// Single data format
 type ChartTick = TickData

export interface MiniDepthLtpSparklineProps {
  ticks: ChartTick[]
  instrumentToken: number | string
  height?: number
  className?: string
}

/**
 * Normalize a token value by extracting numeric digits and joining them.
 * Useful for comparing instrument token representations that may contain
 * non-digit characters.
 *
 * @param val - Token as number or string
 * @returns Normalized token string consisting of digits
 */
function normalizeToken(val: number | string): string {
  const s = String(val)
  const digits = s.match(/\d+/g)
  return digits ? digits.join("") : s
}

/**
 * MiniDepthLtpSparkline renders a compact SVG sparkline showing the combined
 * Depth+LTP price over recent ticks for a single instrument.
 *
 * @param props.ticks - Array of TickData to extract series from
 * @param props.instrumentToken - Instrument token to filter ticks by
 * @param props.height - Height of the SVG in pixels
 * @param props.className - Optional additional class names
 */
export function MiniDepthLtpSparkline({ ticks, instrumentToken, height = 18, className = "" }: MiniDepthLtpSparklineProps) {
  const vbWidth = 120
  const vbHeight = height
  const pad = Math.max(2, Math.round(height * 0.15))
  const innerW = vbWidth - pad * 2
  const innerH = vbHeight - pad * 2

  const data = useMemo(() => {
    const key = normalizeToken(instrumentToken)

    const points: { price: number; ts: number }[] = ticks
      .filter((t) => normalizeToken((t as any).instrument_token) === key)
      .map((t) => ({ price: depthPlusLtp(t as any), ts: (t as any).timestamp }))
      .filter((p) => Number.isFinite(p.price) && p.price >= 0)
      .sort((a, b) => a.ts - b.ts)
      .slice(-50)

    if (points.length === 0) return { path: "", color: "#9ca3af", has: false }

    const prices = points.map((p) => p.price)
    let min = Math.min(...prices)
    let max = Math.max(...prices)
    let range = max - min

    if (!Number.isFinite(range) || range <= 0) {
      const base = max || min || 1
      const padRange = base * 0.001
      min = base - padRange
      max = base + padRange
      range = max - min
    }

    const getX = (i: number) => pad + (innerW * i) / Math.max(1, points.length - 1)
    const getY = (price: number) => {
      const yNorm = (price - min) / (range || 1)
      const y = vbHeight - pad - yNorm * innerH
      return Math.max(pad, Math.min(vbHeight - pad, y))
    }

    let d = `M ${getX(0)} ${getY(points[0].price)}`
    for (let i = 1; i < points.length; i++) {
      d += ` L ${getX(i)} ${getY(points[i].price)}`
    }

    const delta = points[points.length - 1].price - points[0].price
    const color = delta > 0 ? "#22c55e" : delta < 0 ? "#ef4444" : "#9ca3af"

    return { path: d, color, has: true }
  }, [ticks, instrumentToken, height])

  if (!data.has) {
    return <div className={`w-full ${className}`} style={{ height }} />
  }

  return (
    <svg className={`w-full ${className}`} viewBox={`0 0 ${vbWidth} ${vbHeight}`} preserveAspectRatio="none" height={height}>
      <path d={data.path} fill="none" stroke={data.color} strokeWidth={Math.min(1.5, height * 0.12)} strokeLinecap="round" />
    </svg>
  )
}
