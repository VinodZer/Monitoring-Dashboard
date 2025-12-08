"use client"

import { useMemo, useEffect, useState, memo, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  Clock,
  Settings,
  Settings2,
  Activity,
  Filter,
  SortAsc,
  SortDesc,
  X,
} from "lucide-react"
import type { TickData } from "@/hooks/use-tick-data"
import { getCurrentMarketStatus, getMarketTypeForInstrument } from "@/utils/market-timings"
import { calculatePriceTrend, calculateDayTrend } from "@/utils/price-trends"
import { calculateDepthAverage } from "@/utils/depth-ltp"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MiniPriceChart } from "./mini-price-chart"
import { SymbolAlertSettingsDialog } from "./symbol-alert-settings-dialog"
import type { InactivityAlertConfig } from "@/hooks/use-inactivity-alerts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert } from "@/components/ui/alert"

// --- Helper functions ---
/**
 * Resolve instrument name from a TickData object. Prefers tradingsymbol if
 * provided, otherwise falls back to a small token-to-name map.
 *
 * @param tick - TickData instance
 * @returns Human readable instrument name
 */
export const getInstrumentName = (tick: TickData) => {
  if (tick.tradingsymbol) return tick.tradingsymbol
  const tokenMap: Record<number, string> = {
    256265: "NIFTY",
    265: "SENSEX",
    260105: "NIFTY BANK",
    26009: "BANKNIFTY",
    12839: "BANKEX",
    128083204: "RELIANCE",
    281836549: "BHEL",
    408065: "USDINR",
    134657: "CRUDEOIL",
    // Add more potential futures tokens
    13979396: "RELIANCE FUT",
    14264834: "SENSEX FUT",
    14318344: "NIFTY FUT",
  }
  return tokenMap[tick.instrument_token] || `TOKEN_${tick.instrument_token}`
}

/**
 * Infer exchange short code for a tick based on its instrument name and market
 * type classification.
 * @param tick - TickData object
 * @returns Exchange code string (e.g., NSE, NFO, BFO, MCX, CDS)
 */
export const getExchange = (tick: TickData) => {
  const name = getInstrumentName(tick).toUpperCase()
  const exch = (tick as any).exchange ? String((tick as any).exchange).toUpperCase() : undefined
  if (exch === "NSE" || exch === "BSE" || exch === "MCX" || exch === "CDS" || exch === "NFO" || exch === "BFO")
    return exch

  const marketType = getMarketTypeForInstrument(name)

  // Market types with unambiguous exchanges
  if (marketType === "currency") return "CDS"
  if (marketType === "commodity") return "MCX"

  // Derivatives detection: FUT, CE, PE or month codes
  const isDerivative =
    name.includes("FUT") || /(?:^|[^A-Z])(CE|PE)(?:$)/.test(name) || /\d{2}[A-Z]{3}(FUT|CE|PE)/.test(name)
  if (isDerivative) {
    // BSE derivatives are typically SENSEX based, otherwise assume NSE F&O
    return name.includes("SENSEX") ? "BFO" : "NFO"
  }

  // Spot indices (no derivatives suffix)
  if (name.includes("SENSEX")) return "BSE"
  if (name.includes("NIFTY")) return "NSE"

  // Explicit hints
  if (name.includes("BSE")) return "BSE"
  if (name.includes("BFO")) return "BFO"
  if (name.includes("NFO")) return "NFO"

  // Default to NSE for cash equities
  return "NSE"
}

/**
 * Format a delay value in milliseconds into a human readable string.
 * @param delay - Delay in milliseconds
 * @returns Formatted string like "200ms", "1.2s", "0.5m" or "N/A"
 */
const formatDelay = (delay: number) => {
  if (delay === 0) return "N/A"
  if (delay < 1000) return `${delay}ms`
  if (delay < 60000) return `${(delay / 1000).toFixed(1)}s`
  return `${(delay / 60000).toFixed(1)}m`
}

/**
 * Format a numeric price value with the appropriate number of decimal places
 * depending on instrument type (currency vs others).
 * @param price - Numeric price value
 * @param instrumentName - Optional instrument name to infer formatting rules
 * @returns Localized formatted price string
 */
const formatPriceWithDecimals = (price: number, instrumentName?: string) => {
  // Guard invalid or missing price
  if (price === null || price === undefined || Number.isNaN(price)) {
    return "-"
  }

  // Currency instruments need 4 decimal places; only check when instrumentName is a string
  const isCurrency =
    typeof instrumentName === "string" &&
    (instrumentName.includes("USDINR") || instrumentName.includes("EURINR") || instrumentName.includes("GBPINR"))

  if (isCurrency) {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(price)
  }

  // All other instruments use 2 decimal places
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price)
}

/**
 * Compute the depth average by summing all numeric depth values and dividing by
 * the fixed divisor defined for depth calculations.
 *
 * @param instrument - Partial instrument object containing depth levels
 * @returns Depth average or null when unavailable
 */
function getDepthPlusLtpPrice(instrument?: {
  depth?: {
    buy?: { price?: number; quantity?: number; orders?: number }[]
    sell?: { price?: number; quantity?: number; orders?: number }[]
  }
}) {
  if (!instrument) return null
  return calculateDepthAverage(instrument.depth)
}

interface MarketDataGridProps {
  ticks: TickData[]
  inactiveSymbols: Set<number>
  alertConfigurations: Map<number, InactivityAlertConfig>
  onConfigurationChange: (token: number, config: InactivityAlertConfig) => void
  onMarkAlertAsChecked?: (instrumentToken: number) => void
}

interface InstrumentData extends TickData {
  marketStatus: { isOpen: boolean; session: string; reason: string }
  trend: { change: number; changePercent: number; direction: "up" | "down" | "neutral" }
  dayTrend: { change: number; changePercent: number; direction: "up" | "down" | "neutral" }
}

type SortField = "time" | "price" | "quantity" | "volume" | "change"
type SortDirection = "asc" | "desc"

// Memoized Price animation component
const AnimatedPrice = memo(function AnimatedPrice({
  price,
  previousPrice,
  direction,
}: {
  price: number
  previousPrice: number | null
  direction: "up" | "down" | "neutral"
}) {
  const [animationClass, setAnimationClass] = useState("")
  const [textColorClass, setTextColorClass] = useState("")

  useEffect(() => {
    if (previousPrice !== null && price !== previousPrice) {
      const changeDirection = price > previousPrice ? "up" : "down"
      setAnimationClass(`price-bg-flash-${changeDirection}`)
      setTextColorClass(`price-text-flash-${changeDirection}`)
      const timer = setTimeout(() => {
        setAnimationClass("")
        setTextColorClass("")
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [price, previousPrice])

  const formatPrice = (p: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p)

  const getBackgroundColor = () => {
    if (animationClass.includes("up")) return "rgba(34, 197, 94, 0.2)"
    if (animationClass.includes("down")) return "rgba(239, 68, 68, 0.2)"
    if (direction === "up") return "rgba(34, 197, 94, 0.1)"
    if (direction === "down") return "rgba(239, 68, 68, 0.1)"
    return "rgba(156, 163, 175, 0.1)"
  }

  return (
    <div
      className={`inline-block px-4 py-2 rounded-lg text-2xl font-bold transition-colors duration-500 ease-out ${textColorClass}`}
      style={{ backgroundColor: getBackgroundColor() }}
    >
      {formatPrice(price)}
      <style jsx>{`
    .price-bg-flash-up {
      background-color: rgba(34, 197, 94, 0.3) !important;
    }
    .price-bg-flash-down {
      background-color: rgba(239, 68, 68, 0.3) !important;
    }
    .price-text-flash-up {
      color: #22c55e !important;
    }
    .price-text-flash-down {
      color: #ef4444 !important;
    }
  `}</style>
    </div>
  )
})

// Combined Index Card for all indices
const CombinedIndexCard = memo(function CombinedIndexCard({
  indicesData,
  tickCounts,
  allTicks,
  inactiveSymbols,
  onMarkAlertAsChecked,
  alertConfigurations,
  onConfigurationChange,
}: {
  indicesData: { [key: string]: InstrumentData }
  tickCounts: { [key: string]: number }
  allTicks: TickData[]
  inactiveSymbols: Set<number>
  onMarkAlertAsChecked?: (instrumentToken: number) => void
  alertConfigurations: Map<number, InactivityAlertConfig>
  onConfigurationChange: (token: number, config: InactivityAlertConfig) => void
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<InstrumentData | null>(null)

  const formatPrice = (price: number, instrumentName: string) => formatPriceWithDecimals(price, instrumentName)

  const formatVolume = (volume: number) => {
    if (volume >= 10000000) return `${(volume / 10000000).toFixed(1)}Cr`
    if (volume >= 100000) return `${(volume / 100000).toFixed(1)}L`
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`
    return volume.toString()
  }

  /**
   * Format a delay value in milliseconds into a human readable string.
   * @param delay - Delay in milliseconds
   * @returns Formatted string like "200ms", "1.2s", "0.5m" or "N/A"
   */
  const formatDelay = (delay: number) => {
    if (delay === 0) return "N/A"
    if (delay < 1000) return `${delay}ms`
    if (delay < 60000) return `${(delay / 1000).toFixed(1)}s`
    return `${(delay / 60000).toFixed(1)}m`
  }

  return (
    <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors">
      <CardContent className="p-2 bg-transparent dark:bg-[#1e222d]">
        {/* Combined Header */}


        {/* Render all indices in desired order */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {(() => {
            const ORDER = ["NIFTY 50", "SENSEX", "NIFTY BANK", "BANKEX"] as const
            const keys = ORDER.filter((n) => indicesData[n as string]).concat(
              Object.keys(indicesData)
                .filter((k) => !(ORDER as readonly string[]).includes(k))
                .sort(),
            )
            return keys.map((key, index) => {
              const data = indicesData[key]
              const indexName = getInstrumentName(data)
              const exchange = indexName.includes("SENSEX") ? "BSE" : "NSE"
              const isInactive = inactiveSymbols.has(data.instrument_token)

              return (
                <div
                  key={key}
                  className={`relative overflow-hidden rounded-lg bg-white dark:bg-[linear-gradient(180deg,rgba(30,34,45,1)_0%,rgba(22,25,35,1)_100%)] dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.3),0_2px_4px_-1px_rgba(0,0,0,0.15)] ${isInactive
                    ? "border-orange-500 shadow-orange-200 dark:shadow-orange-800 shadow-lg ring-2 ring-orange-400 dark:ring-orange-600 animate-pulse"
                    : "border border-gray-200 dark:border-gray-700/50"
                    }`}
                >
                  {/* Background price chart */}
                  <div className="absolute inset-0 pointer-events-none opacity-20">
                    <MiniPriceChart
                      ticks={allTicks}
                      instrumentToken={data.instrument_token}
                      height={80}
                      className="h-full w-full"
                      useBookPrice={true}
                      strokeWidth={3}
                      gradientOpacity={0.8}
                      gradientEndOpacity={0.2}
                    />
                  </div>

                  <div className="relative z-10 p-3">
                    {/* Row 1: Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-white tracking-wide">
                          {indexName}
                        </span>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-medium bg-gray-100 dark:bg-[#2a2e39] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2a2e39]">
                          {exchange}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-medium ${data.marketStatus?.isOpen ? "text-green-600 dark:text-green-500" : "text-gray-500"}`}>
                          {data.marketStatus?.isOpen ? "Open" : "Closed"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedIndex(data)
                            setIsSettingsOpen(true)
                          }}
                          className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-transparent"
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Row 2: Price & Change */}
                    <div className="flex items-end justify-between mb-3">
                      <div className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                        {formatPrice(data.last_price, indexName)}
                      </div>
                      <div className={`text-sm font-medium ${(data.dayTrend?.changePercent || 0) >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}>
                        {(data.dayTrend?.changePercent || 0) >= 0 ? "+" : ""}
                        {(data.dayTrend?.changePercent || 0).toFixed(2)}%
                      </div>
                    </div>

                    {/* Row 3: Stats */}
                    <div className="grid grid-cols-3 gap-4 border-t border-gray-100 dark:border-gray-700/50 pt-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 font-medium mb-0.5">Vol</span>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {formatVolume(data.volume || 0)}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-gray-500 font-medium mb-0.5">Ticks</span>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {tickCounts[key] || 0}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-gray-500 font-medium mb-0.5">Delay</span>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {formatDelay(data.delay || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isInactive && onMarkAlertAsChecked && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-auto z-20">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onMarkAlertAsChecked(data.instrument_token)}
                        className="h-7 px-2 text-[10px] bg-[#1e222d] border-orange-500/50 text-orange-500 hover:bg-orange-500/10"
                        type="button"
                      >
                        ✓ Mark checked
                      </Button>
                    </div>
                  )}
                </div>
              )
            })
          })()}
        </div>
      </CardContent>
      {selectedIndex && (
        <SymbolAlertSettingsDialog
          isOpen={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          config={alertConfigurations.get(selectedIndex.instrument_token)}
          onSave={(config) => onConfigurationChange(selectedIndex.instrument_token, config)}
          symbolName={getInstrumentName(selectedIndex)}
        />
      )}
    </Card>
  )
})

// Memoized instrument card component
const InstrumentCard = memo(function InstrumentCard({
  instrument,
  instrumentTickCount,
  previousPrice,
  onShowTrades,
  allTicks,
  isInactive,
  alertConfig,
  onAlertConfigChange,
  onMarkAlertAsChecked,
}: {
  instrument: InstrumentData
  instrumentTickCount: number
  previousPrice: number | null
  onShowTrades: () => void
  allTicks: TickData[]
  isInactive: boolean
  alertConfig?: InactivityAlertConfig
  onAlertConfigChange: (config: InactivityAlertConfig) => void
  onMarkAlertAsChecked?: (instrumentToken: number) => void
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showTrades, setShowTrades] = useState(false)
  const name = getInstrumentName(instrument)
  const exchange = getExchange(instrument)
  const { trend, dayTrend, marketStatus } = instrument
  const displayTrend = dayTrend.change !== 0 ? dayTrend : trend

  const formatVolume = (volume: number | undefined | null) => {
    if (volume === undefined || volume === null) return "0"
    if (volume >= 10000000) return `${(volume / 10000000).toFixed(1)}Cr`
    if (volume >= 100000) return `${(volume / 100000).toFixed(1)}L`
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`
    return volume.toString()
  }

  const formatPrice = (price: number) => formatPriceWithDecimals(price, name)

  const lastTrades = useMemo(() => {
    if (!showTrades) return []
    const instrumentTicks = allTicks
      .filter((tick) => tick.instrument_token === instrument.instrument_token)
      .sort((a, b) => b.timestamp - a.timestamp)

    const uniquePriceTrades: TickData[] = []
    if (instrumentTicks.length > 0) {
      uniquePriceTrades.push(instrumentTicks[0])
      for (let i = 1; i < instrumentTicks.length; i++) {
        if (instrumentTicks[i].last_price !== instrumentTicks[i - 1].last_price) {
          uniquePriceTrades.push(instrumentTicks[i])
        }
        if (uniquePriceTrades.length >= 5) break
      }
    }
    return uniquePriceTrades
  }, [allTicks, instrument.instrument_token, showTrades])

  const cardClassName = `relative overflow-hidden border transition-colors bg-white dark:bg-[linear-gradient(180deg,rgba(30,34,45,1)_0%,rgba(22,25,35,1)_100%)] dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.3),0_2px_4px_-1px_rgba(0,0,0,0.15)] ${isInactive
    ? "border-orange-500 shadow-orange-200 dark:shadow-orange-800 shadow-lg ring-2 ring-orange-400 dark:ring-orange-600 animate-pulse"
    : "border-gray-200 dark:border-gray-700/50"
    }`

  return (
    <>
      <Card
        className={cardClassName}
      >
        <CardContent className="p-0 pb-1">
          {/* modernize per-instrument alert overlay; compact banner fits card with inline action button */}
          {isInactive && (
            <div className="space-y-3 mb-4 p-2 bg-transparent">
              <Alert variant="warning" className="p-2 rounded-lg shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    <span className="text-sm font-medium">Price inactivity alert</span>
                  </div>
                  {onMarkAlertAsChecked && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onMarkAlertAsChecked(instrument.instrument_token)
                      }}
                      className="h-8 px-3 border-orange-200 text-orange-700 hover:bg-orange-50 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300"
                      type="button"
                    >
                      ✓ Mark as checked
                    </Button>
                  )}
                </div>
              </Alert>
            </div>
          )}

          {/* Header Section: Symbol, Exchange, Price, Settings */}
          <div className="flex flex-col gap-1 p-3 pb-0">
            {/* Row 1: Symbol and Price/Settings */}
            <div className="flex justify-between items-center">
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {name}
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`text-lg font-bold px-2 py-1 rounded price-display ${displayTrend.direction === "up"
                    ? "text-green-700 dark:text-green-400 bg-green-50/95 dark:bg-green-900/50"
                    : displayTrend.direction === "down"
                      ? "text-red-700 dark:text-red-400 bg-red-50/95 dark:bg-red-900/50"
                      : "text-gray-900 dark:text-gray-100 bg-white/90 dark:bg-gray-800/90"
                    }`}
                >
                  ₹{formatPrice(instrument.last_price)}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsSettingsOpen(true)
                  }}
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Row 2: Exchange and Change Info */}
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {exchange} • {marketStatus.session}
              </div>
              <div
                className={`text-sm font-medium ${displayTrend.direction === "up"
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
                  }`}
              >
                {displayTrend.change > 0 ? "+" : ""}
                {formatPrice(displayTrend.change)} ({displayTrend.changePercent.toFixed(2)}%)
              </div>
            </div>
          </div>

          {/* Full Width Chart with Overlay (Stats Table only) */}
          <div className="relative w-full h-[145px] flex items-end mt-1">
            {/* Background Chart */}
            <MiniPriceChart
              ticks={allTicks}
              instrumentToken={instrument.instrument_token}
              height={145}
              className="w-full"
              useBookPrice={true}
              bottomSpacer={65}
            />
            {/* Chart Overlay Information */}
            <div
              className="absolute inset-0 flex flex-col justify-end px-2 py-[3px]"
              style={{ top: -2, width: "100%", height: "100%", minHeight: "100%" }}
            >
              {/* Stats Table - Positioned at bottom of overlay */}
              <div className="pointer-events-auto bg-white/60 dark:bg-black/20 rounded-lg backdrop-blur-md border border-gray-200/50 dark:border-white/10 mx-1 shadow-sm">
                <table className="w-full text-[9px] border-collapse table-fixed">
                  <tbody>
                    <tr>
                      <td className="text-gray-500 font-semibold py-0.5 border-b border-gray-200 dark:border-gray-700 text-center">
                        Vol
                      </td>
                      <td className="font-bold py-0 border-b border-gray-200 dark:border-gray-700 text-center whitespace-nowrap tabular-nums">
                        {formatVolume(instrument.volume)}
                      </td>
                      <td className="text-gray-500 font-semibold py-0.5 border-b border-gray-200 dark:border-gray-700 text-center">
                        AVG
                      </td>
                      <td className="font-bold py-0 border-b border-gray-200 dark:border-gray-700 text-center whitespace-nowrap tabular-nums">
                        {(() => {
                          const c = getDepthPlusLtpPrice(instrument)
                          return c != null ? formatPrice(c) : "-"
                        })()}
                      </td>
                      <td className="text-gray-500 font-semibold py-0.5 border-b border-gray-200 dark:border-gray-700 text-center">
                        LTQ
                      </td>
                      <td className="font-bold py-0 border-b border-gray-200 dark:border-gray-700 text-center whitespace-nowrap tabular-nums">
                        {instrument.last_quantity}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-gray-500 font-semibold py-0.5 text-center border-t border-gray-200 dark:border-gray-700">
                        Ticks
                      </td>
                      <td className="font-bold text-center py-0 whitespace-nowrap tabular-nums border-t border-gray-200 dark:border-gray-700">
                        {instrumentTickCount}
                      </td>
                      <td className="text-gray-500 font-semibold py-0.5 text-center border-t border-gray-200 dark:border-gray-700">
                        Delay
                      </td>
                      <td
                        className={`font-bold py-0 text-center whitespace-nowrap tabular-nums border-t border-gray-200 dark:border-gray-700 ${instrument.delay > 1000
                          ? "text-red-600"
                          : instrument.delay > 500
                            ? "text-yellow-600"
                            : "text-green-600"
                          }`}
                      >
                        {formatDelay(instrument.delay)}
                      </td>
                      <td className="text-gray-500 font-semibold py-0.5 text-center border-t border-gray-200 dark:border-gray-700">
                        Alerts
                      </td>
                      <td
                        className={`font-bold py-0 text-center border-t border-gray-200 dark:border-gray-700 ${alertConfig?.enabled || alertConfig?.dpltpEnabled ? "text-green-600" : "text-gray-400"}`}
                      >
                        {alertConfig?.enabled || alertConfig?.dpltpEnabled ? "On" : "Off"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Toggle Content: Order Book Depth OR Last 10 Trades */}
          {showTrades ? (
            <div className="mt-1 py-1 px-1.5 bg-white dark:bg-[#1e222d] rounded text-[11px] sm:text-[12px] leading-5">
              <div className="grid grid-cols-3 gap-2 text-[10px] sm:text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 pb-0.5 border-b border-gray-100 dark:border-gray-700">
                <div>Time</div>
                <div className="text-right">Price</div>
                <div className="text-right">Qty</div>
              </div>
              <div className="space-y-1">
                {lastTrades.map((trade, index) => {
                  const prevTrade = lastTrades[index + 1]
                  const priceChange = prevTrade ? trade.last_price - prevTrade.last_price : 0
                  return (
                    <div key={trade.id} className="grid grid-cols-3 gap-2 text-[11px] sm:text-[12px]">
                      <div className="text-gray-500 dark:text-gray-400 font-mono">
                        {new Date(trade.timestamp).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                      </div>
                      <div className={`text-right font-mono font-medium ${priceChange > 0 ? "text-green-600 dark:text-green-400" : priceChange < 0 ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-300"}`}>
                        {formatPrice(trade.last_price)}
                      </div>
                      <div className="text-right text-gray-600 dark:text-gray-300 font-mono">
                        {trade.last_quantity}
                      </div>
                    </div>
                  )
                })}
                {lastTrades.length === 0 && (
                  <div className="text-center text-gray-400 text-xs py-2">No trades available</div>
                )}
              </div>
            </div>
          ) : (
            (instrument.depth?.buy?.length ||
              instrument.depth?.sell?.length ||
              instrument.total_buy_quantity ||
              instrument.total_sell_quantity) && (
              <div className="mt-1 py-1 px-1.5 bg-white dark:bg-[#1e222d] rounded text-[11px] sm:text-[12px] leading-5">
                {/* Order Book Table */}
                {instrument.depth?.buy?.length || instrument.depth?.sell?.length ? (
                  (() => {
                    const buyLevels = instrument.depth?.buy || []
                    const sellLevels = instrument.depth?.sell || []
                    const maxRows = Math.max(buyLevels.length, sellLevels.length, 5)

                    // Calculate total quantities
                    const totalBuyQty =
                      instrument.total_buy_quantity ||
                      (instrument.depth?.buy ? instrument.depth.buy.reduce((sum, level) => sum + level.quantity, 0) : 0)
                    const totalSellQty =
                      instrument.total_sell_quantity ||
                      (instrument.depth?.sell ? instrument.depth.sell.reduce((sum, level) => sum + level.quantity, 0) : 0)
                    const totalBuyOrders = buyLevels.reduce((sum, level) => sum + level.orders, 0)
                    const totalSellOrders = sellLevels.reduce((sum, level) => sum + level.orders, 0)

                    return (
                      <div className="text-[13px] sm:text-[14px]">
                        {/* Header Row */}
                        <div className="grid grid-cols-6 gap-0.5 text-[11px] sm:text-[12px] font-normal text-gray-500 dark:text-gray-400 mb-1 pb-0">
                          <div className="text-center text-blue-600 dark:text-blue-400 font-normal">Bids</div>
                          <div className="text-center text-blue-600 dark:text-blue-400 font-normal">Order</div>
                          <div className="text-center text-blue-600 dark:text-blue-400 font-normal">Qty</div>
                          <div className="text-center text-red-600 dark:text-red-400 font-normal">Offer</div>
                          <div className="text-center text-red-600 dark:text-red-400 font-normal">Order</div>
                          <div className="text-center text-red-600 dark:text-red-400 font-normal">Qty</div>
                        </div>

                        {/* Data Rows */}
                        {Array.from({ length: maxRows }).map((_, index) => {
                          const buyLevel = buyLevels[index]
                          const sellLevel = sellLevels[index]

                          // Calculate bar widths based on max quantities
                          const maxBuyQty = Math.max(...buyLevels.map((l) => l.quantity), 1)
                          const maxSellQty = Math.max(...sellLevels.map((l) => l.quantity), 1)
                          const buyBarWidth = buyLevel ? (buyLevel.quantity / maxBuyQty) * 100 : 0
                          const sellBarWidth = sellLevel ? (sellLevel.quantity / maxSellQty) * 100 : 0

                          return (
                            <div key={index} className="grid grid-cols-6 gap-0.5 text-[11px] py-0">
                              <div className="text-center text-blue-600 dark:text-blue-400 font-normal">
                                {buyLevel ? formatPrice(buyLevel.price) : "0"}
                              </div>
                              <div className="text-center text-blue-600 dark:text-blue-400 font-normal">
                                {buyLevel ? buyLevel.orders : "0"}
                              </div>
                              <div className="relative text-center text-blue-600 dark:text-blue-400">
                                <div
                                  className="absolute inset-0 bg-blue-100 dark:bg-[rgba(71,109,252,0.8)] opacity-50"
                                  style={{ width: `${buyBarWidth}%` }}
                                />
                                <span className="relative z-10 font-normal">
                                  {buyLevel ? buyLevel.quantity.toLocaleString() : "0"}
                                </span>
                              </div>
                              <div className="text-center text-red-600 dark:text-red-400 font-normal">
                                {sellLevel ? formatPrice(sellLevel.price) : "0"}
                              </div>
                              <div className="text-center text-red-600 dark:text-red-400 font-normal">
                                {sellLevel ? sellLevel.orders : "0"}
                              </div>
                              <div className="relative text-center text-red-600 dark:text-red-400">
                                <div
                                  className="absolute inset-0 bg-red-100 dark:bg-[rgba(255,73,73,0.73)] opacity-50"
                                  style={{ width: `${sellBarWidth}%` }}
                                />
                                <span className="relative z-10 font-normal">
                                  {sellLevel ? sellLevel.quantity.toLocaleString() : "0"}
                                </span>
                              </div>
                            </div>
                          )
                        })}

                        {/* Total Row */}
                        <div className="grid grid-cols-6 gap-0.5 text-[11px] sm:text-[12px] py-0 mt-1 font-normal">
                          <div className="text-center text-blue-600 dark:text-blue-400 font-normal">Total</div>
                          <div className="text-center text-blue-600 dark:text-blue-400 font-normal">{totalBuyOrders}</div>
                          <div className="text-center text-blue-600 dark:text-blue-400 font-normal">
                            {totalBuyQty.toLocaleString()}
                          </div>
                          <div className="text-center text-red-600 dark:text-red-400 font-normal">Total</div>
                          <div className="text-center text-red-600 dark:text-red-400 font-normal">{totalSellOrders}</div>
                          <div className="text-center text-red-600 dark:text-red-400 font-normal">
                            {totalSellQty.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )
                  })()
                ) : (
                  /* Fallback to simple totals if detailed depth not available */
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-[10px] sm:text-xs font-semibold mb-1 text-blue-900 dark:text-blue-300">
                        Total Buy Qty
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-blue-900 dark:text-blue-300">
                        {instrument.total_buy_quantity ? instrument.total_buy_quantity.toLocaleString() : "N/A"}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] sm:text-xs font-semibold mb-1 text-red-900 dark:text-red-300">
                        Total Sell Qty
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-red-900 dark:text-red-300">
                        {instrument.total_sell_quantity ? instrument.total_sell_quantity.toLocaleString() : "N/A"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* Show More Button */}
          <div className="px-2 pb-1 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-xs sm:text-sm"
              onClick={() => setShowTrades(!showTrades)}
            >
              <span className="font-medium">{showTrades ? "Show Depth" : "Show last 5 trades"}</span>
              <ChevronDown className={`w-3 sm:w-4 h-3 sm:h-4 ml-1 transition-transform ${showTrades ? "rotate-180" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>
      <SymbolAlertSettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        config={alertConfig}
        onSave={onAlertConfigChange}
        symbolName={name}
      />
    </>
  )
})

/**
 * MarketDataGrid is a comprehensive component that renders a set of cards and
 * tables representing the current market ticks, indices summary, and per-
 * instrument details. It accepts live ticks and alert configuration maps and
 * provides UI callbacks for configuration changes and marking alerts as checked.
 *
 * @param props.ticks - Array of TickData from the live feed
 * @param props.inactiveSymbols - Set of instrument tokens currently flagged as inactive
 * @param props.alertConfigurations - Map of per-instrument InactivityAlertConfig
 * @param props.onConfigurationChange - Callback when a symbol configuration is updated
 * @param props.onMarkAlertAsChecked - Optional callback invoked when an alert is marked checked
 */
export function MarketDataGrid({
  ticks,
  inactiveSymbols,
  alertConfigurations,
  onConfigurationChange,
  onMarkAlertAsChecked,
}: MarketDataGridProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [previousPrices, setPreviousPrices] = useState<Record<number, number>>({})
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentData | null>(null)
  const [sortField, setSortField] = useState<SortField>("time")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [filterDelay, setFilterDelay] = useState<string>("all")
  const [filterChange, setFilterChange] = useState<string>("all")
  const stableInstrumentOrder = useRef<number[]>([])

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const instrumentData = useMemo(() => {
    const grouped = new Map<number, TickData>()
    const recentTicks = ticks.slice(0, 100)
    for (const tick of recentTicks) {
      const key = tick.instrument_token
      if (!grouped.has(key) || tick.receivedAt > grouped.get(key)!.receivedAt) {
        grouped.set(key, tick)
      }
    }
    const validInstruments = Array.from(grouped.values()).filter((tick) => tick.last_price > 0)
    const currentTokens = validInstruments.map((tick) => tick.instrument_token)
    if (stableInstrumentOrder.current.length === 0) {
      stableInstrumentOrder.current = currentTokens.sort((a, b) => a - b).slice(0, 16)
    } else {
      const newTokens = currentTokens.filter((token) => !stableInstrumentOrder.current.includes(token))
      if (stableInstrumentOrder.current.length < 16) {
        const availableSlots = 16 - stableInstrumentOrder.current.length
        stableInstrumentOrder.current.push(...newTokens.slice(0, availableSlots))
      }
    }
    const orderedInstruments: InstrumentData[] = []
    for (const token of stableInstrumentOrder.current) {
      const tick = grouped.get(token)
      if (tick && tick.last_price > 0) {
        const instrumentName = getInstrumentName(tick)
        const marketType = getMarketTypeForInstrument(instrumentName)
        const marketStatus = getCurrentMarketStatus(marketType)
        const trend = calculatePriceTrend(tick, ticks)
        const dayTrend = calculateDayTrend(tick, ticks)
        orderedInstruments.push({ ...tick, marketStatus, trend, dayTrend })
      }
    }
    return orderedInstruments
  }, [ticks, currentTime])

  useEffect(() => {
    const newPreviousPrices: Record<number, number> = {}
    instrumentData.forEach((instrument) => {
      newPreviousPrices[instrument.instrument_token] = instrument.last_price
    })
    setPreviousPrices(newPreviousPrices)
  }, [instrumentData])

  const getLastTrades = (instrumentToken: number) => {
    const instrumentTicks = ticks
      .filter((tick) => tick.instrument_token === instrumentToken)
      .sort((a, b) => b.timestamp - a.timestamp) // Sort from most recent to oldest

    const uniquePriceTrades: TickData[] = []
    if (instrumentTicks.length > 0) {
      uniquePriceTrades.push(instrumentTicks[0]) // Always add the most recent tick

      for (let i = 1; i < instrumentTicks.length; i++) {
        // Compare current tick's price with the previous tick's price
        if (instrumentTicks[i].last_price !== instrumentTicks[i - 1].last_price) {
          uniquePriceTrades.push(instrumentTicks[i])
        }
        // Limit to 10 unique trades
        if (uniquePriceTrades.length >= 10) {
          break
        }
      }
    }
    return uniquePriceTrades
  }

  const getSortedAndFilteredTrades = (instrumentToken: number) => {
    let trades = getLastTrades(instrumentToken)

    // Apply filters
    if (filterDelay !== "all") {
      trades = trades.filter((trade) => {
        if (filterDelay === "low") return trade.delay <= 500
        if (filterDelay === "medium") return trade.delay > 500 && trade.delay <= 1000
        if (filterDelay === "high") return trade.delay > 1000
        return true
      })
    }

    if (filterChange !== "all") {
      trades = trades.filter((trade, index) => {
        const prevTrade = getLastTrades(instrumentToken)[index + 1]
        const priceChange = prevTrade ? trade.last_price - prevTrade.last_price : 0
        if (filterChange === "up") return priceChange > 0
        if (filterChange === "down") return priceChange < 0
        if (filterChange === "neutral") return priceChange === 0
        return true
      })
    }

    // Apply sorting
    trades.sort((a, b) => {
      let aValue: number, bValue: number

      switch (sortField) {
        case "time":
          aValue = a.timestamp
          bValue = b.timestamp
          break
        case "price":
          aValue = a.last_price
          bValue = b.last_price
          break
        case "quantity":
          aValue = a.last_quantity
          bValue = b.last_quantity
          break
        case "volume":
          aValue = a.volume
          bValue = b.volume
          break
        case "change":
          const aIndex = getLastTrades(instrumentToken).findIndex((t) => t.id === a.id)
          const bIndex = getLastTrades(instrumentToken).findIndex((t) => t.id === b.id)
          const aPrevTrade = getLastTrades(instrumentToken)[aIndex + 1]
          const bPrevTrade = getLastTrades(instrumentToken)[bIndex + 1]
          aValue = aPrevTrade ? a.last_price - aPrevTrade.last_price : 0
          bValue = bPrevTrade ? b.last_price - bPrevTrade.last_price : 0
          break
        default:
          return 0
      }

      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    })

    return trades
  }

  const formatVolume = (volume: number) => {
    if (volume >= 10000000) return `${(volume / 10000000).toFixed(1)}Cr`
    if (volume >= 100000) return `${(volume / 100000).toFixed(1)}L`
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`
    return volume.toString()
  }

  const formatPrice = (price: number, instrumentName?: string) => {
    if (instrumentName) {
      return formatPriceWithDecimals(price, instrumentName)
    }
    if (selectedInstrument) {
      return formatPriceWithDecimals(price, getInstrumentName(selectedInstrument))
    }
    return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const clearFilters = () => {
    setFilterDelay("all")
    setFilterChange("all")
    setSortField("time")
    setSortDirection("desc")
  }

  if (instrumentData.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 animate-pulse">
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {(() => {
          // Define indices token IDs and names
          const indicesTokens = [265, 256265, 260105, 12839] // SENSEX, NIFTY 50, NIFTY BANK, BANKEX
          const indicesNames = ["SENSEX", "NIFTY 50", "NIFTY", "NIFTY BANK", "BANKEX"]

          // Function to check if an instrument is an index
          const isIndex = (inst: InstrumentData) => {
            return (
              indicesTokens.includes(inst.instrument_token) ||
              indicesNames.includes(getInstrumentName(inst)) ||
              (inst.tradingsymbol && indicesNames.includes(inst.tradingsymbol))
            )
          }

          // Separate indices from other instruments
          const indicesData: { [key: string]: InstrumentData } = {}
          const tickCounts: { [key: string]: number } = {}

          // Find all indices by both token and name
          instrumentData.forEach((inst) => {
            if (isIndex(inst)) {
              const name = getInstrumentName(inst)
              indicesData[name] = inst
              tickCounts[name] = ticks.filter((t) => t.instrument_token === inst.instrument_token).length
            }
          })

          const otherInstruments = instrumentData.filter((inst) => !isIndex(inst))

          // Sort other instruments by desired priority order
          const PRIORITY_SEQUENCE = [
            "RELIANCE_NSE",
            "RELIANCE_BSE",
            "NIFTY25DECFUT",
            "SENSEX25DECFUT",
            "CRUDEOIL25DECFUT",
            "USDINR25DECFUT",
          ] as const

          const normalize = (s?: string | null) => (s ? s.toUpperCase().replace(/[^A-Z0-9]/g, "") : "")

          const getPriorityKey = (inst: InstrumentData) => {
            const symbol = normalize((inst as any).tradingsymbol) || normalize(getInstrumentName(inst))
            const exchange = normalize((inst as any).exchange) || normalize(getExchange(inst))
            if (symbol === "RELIANCE" && exchange) {
              return `${symbol}_${exchange}`
            }
            return symbol
          }

          const originalIndex = new Map<number, number>()
          otherInstruments.forEach((inst, idx) => originalIndex.set(inst.instrument_token, idx))

          const sortedOther = [...otherInstruments].sort((a, b) => {
            const aKey = getPriorityKey(a)
            const bKey = getPriorityKey(b)
            const rankOf = (key: string) => {
              const index = PRIORITY_SEQUENCE.findIndex((entry) => entry === key)
              return index === -1 ? Number.POSITIVE_INFINITY : index
            }
            const aRank = rankOf(aKey)
            const bRank = rankOf(bKey)
            if (aRank !== bRank) return aRank - bRank
            return (originalIndex.get(a.instrument_token) || 0) - (originalIndex.get(b.instrument_token) || 0)
          })

          const maxOtherCards = 15
          const limitedInstruments = sortedOther.slice(0, Math.max(maxOtherCards, PRIORITY_SEQUENCE.length))

          return (
            <>
              {/* Full Width Indices Section */}
              {Object.keys(indicesData).length > 0 && (
                <div className="w-full">
                  <CombinedIndexCard
                    key="indices"
                    indicesData={indicesData}
                    tickCounts={tickCounts}
                    allTicks={ticks}
                    inactiveSymbols={inactiveSymbols}
                    onMarkAlertAsChecked={onMarkAlertAsChecked}
                    alertConfigurations={alertConfigurations}
                    onConfigurationChange={onConfigurationChange}
                  />
                </div>
              )}

              {/* Other Instruments Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {limitedInstruments.map((instrument) => {
                  const instrumentTickCount = ticks.filter((t) => t.instrument_token === instrument.instrument_token).length
                  const isInactive = inactiveSymbols.has(instrument.instrument_token)

                  return (
                    <InstrumentCard
                      key={instrument.instrument_token}
                      instrument={instrument}
                      instrumentTickCount={instrumentTickCount}
                      previousPrice={previousPrices[instrument.instrument_token] || null}
                      onShowTrades={() => setSelectedInstrument(instrument)}
                      allTicks={ticks}
                      isInactive={isInactive}
                      alertConfig={alertConfigurations.get(instrument.instrument_token)}
                      onAlertConfigChange={(config) => onConfigurationChange(instrument.instrument_token, config)}
                      onMarkAlertAsChecked={onMarkAlertAsChecked}
                    />
                  )
                })}
              </div>
            </>
          )
        })()}
      </div>

      {/* Enhanced Mobile-First Trades Dialog */}
      <Dialog open={!!selectedInstrument} onOpenChange={() => setSelectedInstrument(null)}>
        <DialogContent className="w-[95vw] max-w-6xl h-[95vh] max-h-[95vh] p-0 gap-0">
          {/* Mobile-Optimized Header */}
          {/* Modern Header with Glassmorphism */}
          <DialogHeader className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0 shadow-sm border border-blue-100 dark:border-blue-800">
                  <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                    {selectedInstrument ? getInstrumentName(selectedInstrument) : ""}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {selectedInstrument ? getExchange(selectedInstrument) : ""}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                    <span>Recent trading activity</span>
                  </DialogDescription>
                </div>
              </div>
              {selectedInstrument && (
                <div className="flex items-center gap-6 flex-shrink-0 bg-gray-50 dark:bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-100 dark:border-gray-800">
                  <div className="text-right">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Current Price</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 price-display tabular-nums tracking-tight">
                      ₹{formatPrice(selectedInstrument.last_price)}
                    </div>
                  </div>
                  <div className={`flex flex-col items-end ${(selectedInstrument.dayTrend?.change || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}>
                    <div className="flex items-center gap-1 font-bold">
                      {(selectedInstrument.dayTrend?.change || 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>{Math.abs(selectedInstrument.dayTrend?.change || 0).toFixed(2)}</span>
                    </div>
                    <div className="text-xs font-medium">
                      {(selectedInstrument.dayTrend?.changePercent || 0).toFixed(2)}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="flex flex-col h-full min-h-0">
            {/* Mobile-First Controls */}
            <div className="px-4 sm:px-6 py-3 border-b bg-gray-50 dark:bg-gray-800 flex-shrink-0">
              <Tabs defaultValue="trades" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-9">
                  <TabsTrigger value="trades" className="text-xs sm:text-sm">
                    Trades
                  </TabsTrigger>
                  <TabsTrigger value="summary" className="text-xs sm:text-sm">
                    Summary
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="trades" className="mt-3 space-y-3">
                  {/* Touch-Friendly Sort & Filter Controls */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <div className="flex gap-2 flex-1">
                      <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
                        <SelectTrigger className="h-9 text-xs sm:text-sm">
                          <div className="flex items-center gap-1">
                            {sortDirection === "asc" ? (
                              <SortAsc className="w-3 h-3" />
                            ) : (
                              <SortDesc className="w-3 h-3" />
                            )}
                            <SelectValue placeholder="Sort by" />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="time">Time</SelectItem>
                          <SelectItem value="price">Price</SelectItem>
                          <SelectItem value="quantity">Quantity</SelectItem>
                          <SelectItem value="volume">Volume</SelectItem>
                          <SelectItem value="change">Change</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                        className="h-9 px-2"
                      >
                        {sortDirection === "asc" ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />}
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Select value={filterDelay} onValueChange={setFilterDelay}>
                        <SelectTrigger className="h-9 text-xs sm:text-sm w-24 sm:w-28">
                          <div className="flex items-center gap-1">
                            <Filter className="w-3 h-3" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Delays</SelectItem>
                          <SelectItem value="low">Low (&lt;500ms)</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High (&gt;1s)</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={filterChange} onValueChange={setFilterChange}>
                        <SelectTrigger className="h-9 text-xs sm:text-sm w-20 sm:w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="up">Up</SelectItem>
                          <SelectItem value="down">Down</SelectItem>
                          <SelectItem value="neutral">Neutral</SelectItem>
                        </SelectContent>
                      </Select>

                      {(filterDelay !== "all" ||
                        filterChange !== "all" ||
                        sortField !== "time" ||
                        sortDirection !== "desc") && (
                          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2">
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="summary" className="mt-6">
                  {selectedInstrument && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="w-4 h-4 text-blue-500" />
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Trades</div>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {getLastTrades(selectedInstrument.instrument_token).length}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-purple-500" />
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Volume</div>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {formatVolume(
                            getLastTrades(selectedInstrument.instrument_token).reduce(
                              (sum, trade) => sum + trade.volume,
                              0,
                            ) / Math.max(getLastTrades(selectedInstrument.instrument_token).length, 1),
                          )}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-green-500" />
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Session High</div>
                        </div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400 tabular-nums">
                          ₹{formatPrice(
                            Math.max(...getLastTrades(selectedInstrument.instrument_token).map((t) => t.last_price)),
                          )}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingDown className="w-4 h-4 text-red-500" />
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Session Low</div>
                        </div>
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                          ₹{formatPrice(
                            Math.min(...getLastTrades(selectedInstrument.instrument_token).map((t) => t.last_price)),
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Mobile-Optimized Content */}
            <div className="flex-1 min-h-0">
              {/* Mobile Card View - Always Visible */}
              <div className="block lg:hidden h-full bg-gray-50 dark:bg-gray-900/50">
                <ScrollArea className="h-full px-4 py-4">
                  <div className="space-y-3 pb-20">
                    {selectedInstrument &&
                      getSortedAndFilteredTrades(selectedInstrument.instrument_token).map((trade, index) => {
                        const allTrades = getLastTrades(selectedInstrument.instrument_token)
                        const originalIndex = allTrades.findIndex((t) => t.id === trade.id)
                        const prevTrade = allTrades[originalIndex + 1]
                        const priceChange = prevTrade ? trade.last_price - prevTrade.last_price : 0
                        const changePercent =
                          prevTrade && prevTrade.last_price > 0 ? (priceChange / prevTrade.last_price) * 100 : 0

                        return (
                          <Card
                            key={trade.id}
                            className="overflow-hidden border-0 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-800"
                          >
                            <CardContent className="p-0">
                              <div className="flex items-stretch">
                                {/* Left strip indicator */}
                                <div className={`w-1 flex-shrink-0 ${priceChange > 0 ? "bg-green-500" : priceChange < 0 ? "bg-red-500" : "bg-gray-300 dark:bg-gray-700"
                                  }`} />

                                <div className="flex-1 p-3">
                                  {/* Top Row: Time and Index */}
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-400 font-mono">
                                      #{String(originalIndex + 1).padStart(2, "0")}
                                    </span>
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                      {new Date(trade.timestamp).toLocaleTimeString("en-IN", {
                                        timeZone: "Asia/Kolkata",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit",
                                        hour12: true,
                                      })}
                                    </span>
                                  </div>

                                  {/* Middle Row: Price and Change */}
                                  <div className="flex items-end justify-between mb-3">
                                    <div>
                                      <div className="text-xl font-bold text-gray-900 dark:text-gray-100 font-mono tracking-tight">
                                        ₹{formatPrice(trade.last_price)}
                                      </div>
                                    </div>
                                    <div className={`text-right ${priceChange > 0 ? "text-green-600 dark:text-green-400" :
                                      priceChange < 0 ? "text-red-600 dark:text-red-400" : "text-gray-500"
                                      }`}>
                                      <div className="flex items-center justify-end gap-1 font-bold text-sm">
                                        {priceChange > 0 ? "+" : ""}{priceChange.toFixed(2)}
                                        {priceChange > 0 ? <TrendingUp className="w-3 h-3" /> :
                                          priceChange < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                      </div>
                                      {changePercent !== 0 && (
                                        <div className="text-xs font-medium opacity-90">
                                          {changePercent > 0 ? "+" : ""}{changePercent.toFixed(2)}%
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Bottom Grid: Stats */}
                                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                                    <div>
                                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Qty</div>
                                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">
                                        {trade.last_quantity.toLocaleString()}
                                      </div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Vol</div>
                                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {formatVolume(trade.volume)}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Delay</div>
                                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${trade.delay > 1000 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                        trade.delay > 500 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                                          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        }`}>
                                        {formatDelay(trade.delay)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                  </div>
                </ScrollArea>
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block h-full p-6 bg-white dark:bg-gray-900">
                <ScrollArea className="h-full pr-4">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white dark:bg-gray-900 z-10 shadow-sm">
                      <TableRow className="hover:bg-transparent border-b border-gray-100 dark:border-gray-800">
                        <TableHead className="w-16 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">#</TableHead>
                        <TableHead className="w-32 py-4 cursor-pointer" onClick={() => handleSort("time")}>
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                            <Clock className="w-3.5 h-3.5" />
                            Time
                            {sortField === "time" &&
                              (sortDirection === "asc" ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                          </div>
                        </TableHead>
                        <TableHead className="py-4 cursor-pointer text-right" onClick={() => handleSort("price")}>
                          <div className="flex items-center justify-end gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Price
                            {sortField === "price" &&
                              (sortDirection === "asc" ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                          </div>
                        </TableHead>
                        <TableHead className="py-4 cursor-pointer text-right" onClick={() => handleSort("quantity")}>
                          <div className="flex items-center justify-end gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                            <Activity className="w-3.5 h-3.5" />
                            Quantity
                            {sortField === "quantity" &&
                              (sortDirection === "asc" ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />)}
                          </div>
                        </TableHead>
                        <TableHead className="py-4 cursor-pointer text-right" onClick={() => handleSort("volume")}>
                          <div className="flex items-center justify-end gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                            Volume
                            {sortField === "volume" &&
                              (sortDirection === "asc" ? <SortAsc className="w-3 h-3 ml-1" /> : <SortDesc className="w-3 h-3 ml-1" />)}
                          </div>
                        </TableHead>
                        <TableHead className="py-4 text-center">
                          <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                            <Clock className="w-3.5 h-3.5" />
                            Delay
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInstrument &&
                        getSortedAndFilteredTrades(selectedInstrument.instrument_token).map((trade, index) => {
                          const allTrades = getLastTrades(selectedInstrument.instrument_token)
                          const originalIndex = allTrades.findIndex((t) => t.id === trade.id)
                          const prevTrade = allTrades[originalIndex + 1]
                          const priceChange = prevTrade ? trade.last_price - prevTrade.last_price : 0
                          const changePercent =
                            prevTrade && prevTrade.last_price > 0 ? (priceChange / prevTrade.last_price) * 100 : 0

                          return (
                            <TableRow key={trade.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-50 dark:border-gray-800/50 group">
                              <TableCell className="py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-1.5 h-1.5 rounded-full ${priceChange > 0 ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" :
                                    priceChange < 0 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "bg-gray-300 dark:bg-gray-600"
                                    }`} />
                                  <span className="text-xs font-mono text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                                    {String(originalIndex + 1).padStart(2, "0")}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">
                                    {new Date(trade.timestamp).toLocaleTimeString("en-IN", {
                                      timeZone: "Asia/Kolkata",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                      hour12: false,
                                    })}
                                  </span>
                                  <span className="text-[10px] text-gray-400">
                                    {new Date(trade.timestamp).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4 text-right">
                                <div className="flex flex-col items-end">
                                  <div className="text-base font-bold text-gray-900 dark:text-gray-100 font-mono tracking-tight tabular-nums">
                                    ₹{formatPrice(trade.last_price)}
                                  </div>
                                  {changePercent !== 0 && (
                                    <div className={`text-xs font-medium flex items-center gap-0.5 ${changePercent > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                      }`}>
                                      {changePercent > 0 ? "+" : ""}{changePercent.toFixed(2)}%
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-4 text-right">
                                <div className="flex flex-col items-end">
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono tabular-nums">
                                    {trade.last_quantity.toLocaleString()}
                                  </span>
                                  <span className="text-[10px] text-gray-400 lowercase">shares</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4 text-right">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 tabular-nums">
                                  {formatVolume(trade.volume)}
                                </span>
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="flex justify-center">
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${trade.delay > 1000 ? "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30" :
                                    trade.delay > 500 ? "bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-900/30" :
                                      "bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30"
                                    }`}>
                                    {formatDelay(trade.delay)}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
