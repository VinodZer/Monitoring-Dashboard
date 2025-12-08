"use client"

import { useMemo, memo, useCallback, useEffect, useRef, useState } from "react"
import { Bell, Settings2, Clock, AlertTriangle, Volume2, Play } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TickData } from "@/hooks/use-tick-data"
import type { InactivityAlertConfig } from "@/hooks/use-inactivity-alerts"
import { getInstrumentName, getExchange } from "./market-data-grid"
import { getDetailedMarketStatus } from "@/utils/market-timings"
import { getDefaultDpltpDuration, getExchangeFromName } from "@/utils/exchange-detection"

interface AlertSettingsTabProps {
  ticks: TickData[]
  alertConfigurations: Map<number, InactivityAlertConfig>
  onConfigurationChange: (token: number, config: InactivityAlertConfig) => void
  inactiveSymbols: Set<number>
}

interface SymbolInfo {
  token: number
  name: string
  exchange: string
  lastPrice: number
  isActive: boolean
  config?: InactivityAlertConfig
  marketStatus: ReturnType<typeof getDetailedMarketStatus>
  isIndex: boolean
}

// Helper function to check if an instrument is an index
const isIndex = (token: number, name: string) => {
  const indicesTokens = [265, 256265, 260105, 26009, 12839] // SENSEX, NIFTY, NIFTY BANK, BANKNIFTY, BANKEX
  const indicesNames = ["SENSEX", "NIFTY 50", "NIFTY", "NIFTY BANK", "BANKNIFTY", "BANKEX"]
  return indicesTokens.includes(token) || indicesNames.includes(name)
}

// Memoized SymbolCard component to prevent unnecessary re-renders
const SymbolCard = memo(function SymbolCard({
  symbol,
  config,
  onConfigChange,
}: {
  symbol: SymbolInfo
  config: InactivityAlertConfig
  onConfigChange: (config: InactivityAlertConfig) => void
}) {
  const exchangeCode = getExchangeFromName(symbol.name)
  const durationFallback = exchangeCode === "MCX" || exchangeCode === "CDS" ? 30 : 15
  const dpltpFallback = getDefaultDpltpDuration(exchangeCode)

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <div className="font-medium text-sm">{symbol.name}</div>
              <div className="text-xs text-gray-500">{symbol.exchange}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={symbol.marketStatus.isOpen ? "default" : "secondary"} className="text-xs">
              {symbol.marketStatus.session}
            </Badge>
            {symbol.isActive ? (
              <Badge variant="outline" className="text-green-600 text-xs">
                Active
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                Alerting
              </Badge>
            )}
          </div>
        </div>

        {/* Controls Grid */}
        <div className="space-y-3">
          {/* LTP Alert Section */}
          <div className="p-2 bg-blue-50 border border-blue-200 rounded">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-blue-900">Enable LTP</Label>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => onConfigChange({ ...config, enabled: checked })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-blue-900">Duration (s)</Label>
                <Input
                  type="number"
                  value={config.duration}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      duration: Math.max(0, Number.parseInt(e.target.value) || durationFallback),
                    })
                  }
                  placeholder={String(durationFallback)}
                  min="0"
                  max="1000"
                  className="text-xs h-8"
                  disabled={!config.enabled && !symbol.isIndex}
                />
              </div>
            </div>
          </div>

          {/* Depth + LTP Alert Section */}
          <div
            className="p-2 bg-green-50 border border-green-200 rounded"
            style={{ display: symbol.isIndex ? "none" : "block" }}
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-green-900">Enable Depth + LTP</Label>
                <Switch
                  checked={config.dpltpEnabled || false}
                  onCheckedChange={(checked) => onConfigChange({ ...config, dpltpEnabled: checked })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-green-900">Duration (s)</Label>
                <Input
                  type="number"
                  value={config.dpltpDuration || dpltpFallback}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      dpltpDuration: Math.max(0, Number.parseInt(e.target.value) || dpltpFallback),
                    })
                  }
                  min="0"
                  max="1000"
                  className="text-xs h-8"
                  disabled={!config.dpltpEnabled}
                  placeholder={String(dpltpFallback)}
                />
              </div>
            </div>
          </div>

          {/* Common Settings */}
          <div className="p-2 bg-gray-50 border border-gray-200 rounded">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Market Hours</Label>
              <Switch
                checked={config.respectMarketHours}
                onCheckedChange={(checked) => onConfigChange({ ...config, respectMarketHours: checked })}
                disabled={!config.enabled && !config.dpltpEnabled}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

export function AlertSettingsTab({
  ticks,
  alertConfigurations,
  onConfigurationChange,
  inactiveSymbols,
}: AlertSettingsTabProps) {
  // Removed manual save system - all changes now auto-save
  // Removed search, filter, and bulk configuration features

  // Get unique symbols from ticks
  const availableSymbols = useMemo(() => {
    const symbolMap = new Map<number, SymbolInfo>()

    ticks.forEach((tick) => {
      if (!symbolMap.has(tick.instrument_token) || tick.receivedAt > symbolMap.get(tick.instrument_token)!.lastPrice) {
        const config = alertConfigurations.get(tick.instrument_token)
        const instrumentName = getInstrumentName(tick)
        const marketStatus = getDetailedMarketStatus(instrumentName)

        symbolMap.set(tick.instrument_token, {
          token: tick.instrument_token,
          name: instrumentName,
          exchange: getExchange(tick),
          lastPrice: tick.last_price,
          isActive: !inactiveSymbols.has(tick.instrument_token),
          config,
          marketStatus,
          isIndex: isIndex(tick.instrument_token, instrumentName),
        })
      }
    })

    return Array.from(symbolMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [ticks, alertConfigurations, inactiveSymbols])

  // No filtering - show all available symbols

  // Statistics
  const stats = useMemo(() => {
    const total = availableSymbols.length
    const enabled = availableSymbols.filter((s) => s.config?.enabled || s.config?.dpltpEnabled).length
    const alerting = availableSymbols.filter((s) => !s.isActive).length
    const marketOpen = availableSymbols.filter((s) => s.marketStatus.isOpen).length

    return { total, enabled, alerting, marketOpen }
  }, [availableSymbols])

  const handleSymbolConfigChange = useCallback(
    (token: number, config: InactivityAlertConfig) => {
      // Auto-save immediately
      onConfigurationChange(token, config)
    },
    [onConfigurationChange],
  )

  const getEffectiveConfig = (symbol: SymbolInfo): InactivityAlertConfig => {
    if (symbol.config) return symbol.config
    const isIdx = symbol.isIndex
    const exchangeCode = getExchangeFromName(symbol.name)
    if (isIdx) {
      console.log("[v0] Getting effective config for index", symbol.name, "defaulting to enabled: true")
      return { enabled: true, duration: 15, respectMarketHours: true, dpltpEnabled: false, dpltpDuration: 0 }
    }
    const dpltp = getDefaultDpltpDuration(exchangeCode)
    const durationDefault = exchangeCode === "MCX" || exchangeCode === "CDS" ? 30 : 15
    return { enabled: false, duration: durationDefault, respectMarketHours: true, dpltpEnabled: true, dpltpDuration: dpltp }
  }

  // Global alert sound settings (persist to localStorage)
  const [soundType, setSoundType] = useState<string>(() => {
    if (typeof window === "undefined") return "sine"
    return localStorage.getItem("alertSoundType") || "sine"
  })
  const [volume, setVolume] = useState<number>(() => {
    if (typeof window === "undefined") return 60
    const v = Number.parseInt(localStorage.getItem("alertSoundVolume") || "60")
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 60
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem("alertSoundType", soundType)
  }, [soundType])

  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem("alertSoundVolume", String(volume))
  }, [volume])

  // Preview audio
  const previewCtxRef = useRef<AudioContext | null>(null)
  const handlePreview = useCallback(() => {
    try {
      if (!previewCtxRef.current) {
        previewCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = previewCtxRef.current
      if (!ctx) return
      if (ctx.state === "suspended") ctx.resume()

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      // Map sound types to waveform and frequency
      const map: Record<string, { type: OscillatorType; freq: number }> = {
        beep: { type: "sine", freq: 660 },
        ding: { type: "sine", freq: 880 },
        bell: { type: "triangle", freq: 1000 },
        buzzer: { type: "square", freq: 220 },
        chime: { type: "sine", freq: 523.25 },
        sine: { type: "sine", freq: 440 },
        square: { type: "square", freq: 440 },
        triangle: { type: "triangle", freq: 440 },
        sawtooth: { type: "sawtooth", freq: 440 },
        silent: { type: "sine", freq: 0 },
      }
      const params = map[soundType] || map.beep
      if (soundType === "silent") return

      osc.type = params.type
      osc.frequency.setValueAtTime(params.freq, ctx.currentTime)
      gain.gain.value = Math.max(0, Math.min(1, volume / 100))

      const now = ctx.currentTime
      osc.start(now)
      // Short preview with quick fade-out
      gain.gain.setTargetAtTime(gain.gain.value, now, 0.01)
      gain.gain.setTargetAtTime(0, now + 0.4, 0.1)
      osc.stop(now + 0.6)
    } catch { }
  }, [soundType, volume])

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 max-w-full overflow-hidden">
      {/* Header - Responsive */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate font-mono">
            Alert Settings
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">
            Configure price inactivity alerts for trading symbols
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 font-mono">
          <Badge
            variant="outline"
            className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-700"
          >
            Auto-Save
          </Badge>
        </div>
      </div>

      {/* Alert Sound Settings */}
      <Card>
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Volume2 className="w-4 h-4" /> Alert Sound Settings
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">Choose the sound and volume for alerts</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-center">
            <div className="space-y-1">
              <Label className="text-xs">Sound</Label>
              <Select value={soundType} onValueChange={setSoundType}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select sound" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beep">Beep</SelectItem>
                  <SelectItem value="ding">Ding</SelectItem>
                  <SelectItem value="bell">Bell</SelectItem>
                  <SelectItem value="buzzer">Buzzer</SelectItem>
                  <SelectItem value="chime">Chime</SelectItem>
                  <SelectItem value="sine">Sine</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="triangle">Triangle</SelectItem>
                  <SelectItem value="sawtooth">Sawtooth</SelectItem>
                  <SelectItem value="silent">Silent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Volume</Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[volume]}
                  onValueChange={(v) => setVolume(v[0])}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <div className="w-10 text-right text-xs">{volume}</div>
              </div>
            </div>
            <div className="flex items-end sm:items-center justify-start sm:justify-end pt-2 sm:pt-0">
              <Button onClick={handlePreview} variant="outline" className="h-9 text-xs">
                <Play className="w-4 h-4 mr-1" /> Preview
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards - Responsive Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="min-w-0">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/50 rounded shrink-0">
                <Settings2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Total Symbols</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/50 rounded shrink-0">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Alerts Enabled</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.enabled}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-red-100 dark:bg-red-900/50 rounded shrink-0">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Currently Alerting</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.alerting}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-purple-100 dark:bg-purple-900/50 rounded shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">Markets Open</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.marketOpen}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Individual Symbol Alert Configuration */}

      {/* Mobile-Optimized Symbols Table */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">Symbol Alert Configuration</CardTitle>
          <CardDescription className="text-sm">
            Configure individual alert settings for each trading symbol
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {/* Mobile Card View */}
          <div className="block sm:hidden">
            <div className="space-y-2 p-3">
              {availableSymbols.map((symbol) => {
                const config = getEffectiveConfig(symbol)
                const exchangeCode = getExchangeFromName(symbol.name)
                const durationFallback = exchangeCode === "MCX" || exchangeCode === "CDS" ? 30 : 15
                const dpltpFallback = getDefaultDpltpDuration(exchangeCode)

                return (
                  <Card key={symbol.token} className="transform-gpu">
                    <CardContent className="p-3 space-y-2">
                      {/* Header Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium text-sm">{symbol.name}</div>
                            <div className="text-xs text-gray-500">{symbol.exchange}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {symbol.isActive ? (
                            <Badge variant="outline" className="text-green-600 text-xs">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              Alerting
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Controls Grid */}
                      <div className="space-y-2">
                        {/* LTP Alert Section */}
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-blue-900">Enable LTP Alerts</Label>
                              <Switch
                                // Always show indices as enabled and allow toggling
                                checked={config.enabled}
                                onCheckedChange={(checked) =>
                                  handleSymbolConfigChange(symbol.token, { ...config, enabled: checked })
                                }
                              // Remove disabled state for indices to allow user control
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-blue-900">LTP Duration (seconds)</Label>
                              <Input
                                type="number"
                                value={config.duration}
                                onChange={(e) =>
                                  handleSymbolConfigChange(symbol.token, {
                                    ...config,
                                    duration: Math.max(0, Number.parseInt(e.target.value) || durationFallback),
                                  })
                                }
                                min="0"
                                max="1000"
                                className="text-xs h-8"
                                disabled={!config.enabled && !symbol.isIndex}
                                placeholder={String(durationFallback)}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Depth + LTP Alert Section */}
                        {!symbol.isIndex && (
                          <div className="p-2 bg-green-50 border border-green-200 rounded">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label className="text-xs font-medium text-green-900">Enable Depth + LTP Alerts</Label>
                                <Switch
                                  checked={config.dpltpEnabled || false}
                                  onCheckedChange={(checked) =>
                                    handleSymbolConfigChange(symbol.token, { ...config, dpltpEnabled: checked })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs font-medium text-green-900">
                                  Depth + LTP Duration (seconds)
                                </Label>
                                <Input
                                  type="number"
                                  value={config.dpltpDuration || 60}
                                  onChange={(e) =>
                                    handleSymbolConfigChange(symbol.token, {
                                      ...config,
                                      dpltpDuration: Math.max(0, Number.parseInt(e.target.value) || 60),
                                    })
                                  }
                                  min="0"
                                  max="1000"
                                  className="text-xs h-8"
                                  disabled={!config.dpltpEnabled}
                                  placeholder="60"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Common Settings */}
                        <div className="p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded">
                          <div className="space-y-2">
                            <Label className="text-xs font-medium">Market Hours</Label>
                            <Switch
                              checked={config.respectMarketHours}
                              onCheckedChange={(checked) =>
                                handleSymbolConfigChange(symbol.token, { ...config, respectMarketHours: checked })
                              }
                              disabled={!config.enabled && !config.dpltpEnabled}
                            />
                            <div className="text-xs text-gray-600">
                              {config.respectMarketHours
                                ? "Alerts active during trading hours only"
                                : "Alerts active 24/7"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Symbol</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">LTP Alerts</TableHead>
                  <TableHead className="text-center">Depth + LTP</TableHead>
                  <TableHead className="text-center">Market Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableSymbols.map((symbol) => {
                  const config = getEffectiveConfig(symbol)
                  const exchangeCode = getExchangeFromName(symbol.name)
                  const durationFallback = exchangeCode === "MCX" || exchangeCode === "CDS" ? 30 : 15

                  return (
                    <TableRow key={symbol.token}>
                      <TableCell className="text-center">
                        <div>
                          <div className="font-medium">{symbol.name}</div>
                          <div className="text-xs text-gray-500">{symbol.exchange}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {symbol.isActive ? (
                          <Badge variant="outline" className="text-green-600">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Alerting</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2 flex flex-col">
                          <div className="flex items-center gap-2 justify-center">
                            <Switch
                              // Always show indices as enabled and allow toggling
                              checked={config.enabled}
                              onCheckedChange={(checked) =>
                                handleSymbolConfigChange(symbol.token, { ...config, enabled: checked })
                              }
                            // Remove disabled state for indices to allow user control
                            />
                            <span className="text-xs">LTP</span>
                          </div>
                          {config.enabled && (
                            <Input
                              type="number"
                              value={config.duration}
                              onChange={(e) =>
                                handleSymbolConfigChange(symbol.token, {
                                  ...config,
                                  duration: Math.max(0, Number.parseInt(e.target.value) || durationFallback),
                                })
                              }
                              min="0"
                              max="1000"
                              className="w-16 text-xs mx-auto"
                              placeholder={String(durationFallback)}
                              disabled={false}
                            />
                          )}
                        </div>
                      </TableCell>
                      {/* Market Depth column - Hidden for indices */}
                      {!symbol.isIndex ? (
                        <TableCell>
                          <div className="space-y-2 flex flex-col">
                            <div className="flex items-center gap-2 justify-center">
                              <Switch
                                checked={config.dpltpEnabled || false}
                                onCheckedChange={(checked) =>
                                  handleSymbolConfigChange(symbol.token, { ...config, dpltpEnabled: checked })
                                }
                              />
                              <span className="text-xs">Depth+LTP</span>
                            </div>
                            {config.dpltpEnabled && (
                              <Input
                                type="number"
                                value={config.dpltpDuration || 60}
                                onChange={(e) =>
                                  handleSymbolConfigChange(symbol.token, {
                                    ...config,
                                    dpltpDuration: Math.max(0, Number.parseInt(e.target.value) || 60),
                                  })
                                }
                                min="0"
                                max="1000"
                                className="w-16 text-xs mx-auto"
                                placeholder="60"
                              />
                            )}
                          </div>
                        </TableCell>
                      ) : (
                        <TableCell>
                          <div className="text-xs text-gray-400 text-center">N/A for indices</div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={config.respectMarketHours}
                            onCheckedChange={(checked) =>
                              handleSymbolConfigChange(symbol.token, { ...config, respectMarketHours: checked })
                            }
                            disabled={!config.enabled && !config.dpltpEnabled}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
