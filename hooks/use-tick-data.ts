"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { getCurrentMarketStatus, getMarketTypeForInstrument } from "@/utils/market-timings"
import { transformUpstoxDepth, isUpstoxFormat, extractUpstoxTotals } from "@/utils/upstox-transformer"

export interface DepthItem {
  price: number
  quantity: number
  orders: number
}

export interface MarketDepth {
  buy: DepthItem[]
  sell: DepthItem[]
}

export interface TickData {
  id: string
  instrument_token: number
  last_price: number
  volume: number
  average_price: number
  last_quantity: number
  total_buy_quantity?: number // Depth: Total buy quantity
  total_sell_quantity?: number // Depth: Total sell quantity
  depth?: MarketDepth // Detailed level-by-level depth
  timestamp: number // Timestamp from the tick data itself
  delay: number // Time difference from previous tick for the same instrument
  receivedAt: number // When the tick was received by the client
  raw_data?: string
  tradingsymbol?: string
  exchange?: string
}

export interface Alert {
  id: string
  type: "freeze" | "delay" | "connection" | "data" | "market"
  message: string
  timestamp: number
  severity: "low" | "medium" | "high"
  instrumentToken?: number // Add this field for instrument-specific alerts
}

const FREEZE_THRESHOLD = 5000
const DELAY_THRESHOLD = 1000 // This threshold now applies to inter-tick delay
const MAX_TICKS_STORED = 200
const MAX_RAW_MESSAGES = 20
const MAX_DEBUG_INFO = 50
const MAX_ALERTS = 20
const MAX_TIMESTAMP_ENTRIES = 1000 // Limit the number of stored timestamps

// WebSocket Endpoint
const WS_ENDPOINT = "wss://kite.rvinod.com/ticks?token=Dashboard@Zerodha"

// Store last tick timestamp for each instrument to calculate inter-tick delay
const lastTickTimestamps = new Map<number, number>()

/**
 * useTickData hook connects to a WebSocket endpoint to receive
 * streaming market tick data, maintains received ticks and connection state,
 * and exposes utility methods and alerts for use in UI components.
 *
 * @param url - WebSocket URL to connect to
 * @param options - Configuration options
 * @returns An object containing the current ticks, connection and alert state, and helpers.
 */
export function useTickData(url?: string, options?: { disableAlerts?: boolean; onTick?: (ticks: TickData[]) => void }) {
  const [ticks, setTicks] = useState<TickData[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isFrozen, setIsFrozen] = useState(false)
  const [lastTickTime, setLastTickTime] = useState<number | null>(null)
  const [totalTicks, setTotalTicks] = useState(0)
  const [freezingIncidents, setFreezingIncidents] = useState(0)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected")
  const [rawMessages, setRawMessages] = useState<string[]>([])
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [nextRetryAt, setNextRetryAt] = useState<number | null>(null)
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const freezeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectionAttempts = useRef(0)

  // Disconnect alert sound support
  const audioContextRef = useRef<AudioContext | null>(null)
  const disconnectSoundIntervalRef = useRef<number | null>(null)

  /**
   * Add a debug line to the internal debug log (keeps size bounded)
   * @param message - The debug message to append
   */
  useEffect(() => {
    // Only init audio if alerts are NOT disabled
    if (options?.disableAlerts) return

    const initAudio = () => {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        } catch { }
      }
      window.removeEventListener("click", initAudio)
    }
    window.addEventListener("click", initAudio)
    return () => window.removeEventListener("click", initAudio)
  }, [options?.disableAlerts])

  const addDebugInfo = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
    })
    setDebugInfo((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, MAX_DEBUG_INFO - 1)])
  }, [])

  /**
   * Add an alert entry to the internal alert list.
   * @param type - The alert type category
   * @param message - Human readable message for the alert
   * @param severity - Severity level (low|medium|high)
   * @param instrumentToken - Optional instrument token to associate the alert with
   */
  const addAlert = useCallback(
    (type: Alert["type"], message: string, severity: Alert["severity"] = "medium", instrumentToken?: number) => {
      // Skip if alerts are disabled
      if (options?.disableAlerts) return

      const alert: Alert = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        message,
        timestamp: Date.now(),
        severity,
        instrumentToken,
      }
      setAlerts((prev) => [alert, ...prev].slice(0, MAX_ALERTS - 1))
      addDebugInfo(`Alert [${severity}]: ${message}`)
    },
    [addDebugInfo, options?.disableAlerts],
  )

  /**
   * Clear all alerts from the internal alert list.
   */
  const clearAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  /**
   * Calculate average inter-tick delay for the most recent ticks.
   * @param ticksArray - Array of TickData to compute average delay from
   * @returns Average delay in milliseconds
   */
  const calculateAverageDelay = useCallback((ticksArray: TickData[]) => {
    if (ticksArray.length === 0) return 0
    const recentTicks = ticksArray.slice(-50)
    const totalDelay = recentTicks.reduce((sum, tick) => sum + tick.delay, 0)
    return totalDelay / recentTicks.length
  }, [])

  // Get instrument name for market timing check
  /**
   * Resolve a human friendly instrument name from token or use provided tradingsymbol.
   * @param instrumentToken - Numeric instrument token
   * @param tradingsymbol - Optional trading symbol string
   * @returns Resolved instrument name
   */
  const getInstrumentName = useCallback((instrumentToken: number, tradingsymbol?: string) => {
    if (tradingsymbol) return tradingsymbol

    const tokenMap: Record<number, string> = {
      256265: "NIFTY",
      265: "SENSEX",
      128083204: "RELIANCE",
      281836549: "BHEL",
      408065: "USDINR",
      134657: "CRUDEOIL",
    }
    return tokenMap[instrumentToken] || `TOKEN_${instrumentToken}`
  }, [])

  // Check if market is open for this instrument
  /**
   * Check whether the market for a given instrument is currently open.
   * @param instrumentToken - Instrument token
   * @param tradingsymbol - Optional trading symbol
   * @returns true if the market is open, false otherwise
   */
  const isMarketOpen = useCallback(
    (instrumentToken: number, tradingsymbol?: string) => {
      const instrumentName = getInstrumentName(instrumentToken, tradingsymbol)
      const marketType = getMarketTypeForInstrument(instrumentName)
      const marketStatus = getCurrentMarketStatus(marketType)
      return marketStatus.isOpen
    },
    [getInstrumentName],
  )

  // Add test tick function for debugging
  /**
   * Add a test tick payload (used for manual testing/debugging). The raw JSON
   * string is processed and injected into the ticks state.
   * @param testData - Raw JSON string of tick array
   */
  const addTestTick = useCallback((testData: string) => {
    try {
      const parsed = JSON.parse(testData)
      const ticksArray = Array.isArray(parsed) ? parsed : [parsed]
      const processed = ticksArray.map((t: any) => ({
        ...t,
        id: Math.random().toString(36).substr(2, 9),
        receivedAt: Date.now(),
        delay: 0,
      }))
      setTicks((prev) => [...processed, ...prev].slice(0, MAX_TICKS_STORED))
    } catch (e) {
      addDebugInfo(`Failed to add test tick: ${e}`)
    }
  }, [addDebugInfo])

  /**
   * Process raw JSON tick data obtained from the WebSocket stream and convert it into
   * an array of normalized TickData objects. This function also updates raw
   * message debug storage and emits alerts when parsing fails.
   *
   * @param rawData - Raw JSON string representing an array of ticks
   * @param eventType - Optional event type label for logging
   * @returns Array of normalized TickData objects
   */
  const processTickData = useCallback(
    (rawData: string, eventType = "unknown"): TickData[] => {
      const receivedAt = Date.now()
      const processedTicks: TickData[] = []

      try {
        addDebugInfo(`Processing ${eventType} event with data length: ${rawData.length}`)

        // Store raw message for debugging (truncated and limited)
        setRawMessages((prev) => [
          `[${eventType}] ${rawData.substring(0, 100)}...`,
          ...prev.slice(0, MAX_RAW_MESSAGES - 1),
        ])

        // Parse the JSON array from the WebSocket stream
        let ticksArray = JSON.parse(rawData)
        addDebugInfo(`Successfully parsed JSON with ${Array.isArray(ticksArray) ? ticksArray.length : 1} ticks`)

        // Handle single object response
        if (!Array.isArray(ticksArray)) {
          ticksArray = [ticksArray]
        }

        // Process each tick in the array - USE ONLY REAL DATA
        for (const tickData of ticksArray) {
          if (tickData && typeof tickData === "object" && tickData.instrument_token) {
            // Always process ticks regardless of market timing for real-time monitoring
            const marketOpen = isMarketOpen(tickData.instrument_token, tickData.tradingsymbol)

            let tickTimestamp = receivedAt
            if (tickData.timestamp) {
              tickTimestamp = new Date(tickData.timestamp).getTime()
            }

            // Calculate inter-tick delay (difference from previous tick for this instrument)
            const lastTickTimeForInstrument = lastTickTimestamps.get(tickData.instrument_token)
            const interTickDelay = lastTickTimeForInstrument ? tickTimestamp - lastTickTimeForInstrument : 0
            lastTickTimestamps.set(tickData.instrument_token, tickTimestamp)

            if (lastTickTimestamps.size > MAX_TIMESTAMP_ENTRIES) {
              const entries = Array.from(lastTickTimestamps.entries())
              // Keep only the most recent entries
              const recentEntries = entries.slice(-MAX_TIMESTAMP_ENTRIES * 0.8)
              lastTickTimestamps.clear()
              recentEntries.forEach(([token, timestamp]) => {
                lastTickTimestamps.set(token, timestamp)
              })
            }

            // Transform Upstox format if detected
            let depthData: MarketDepth | undefined
            let totalBuyQty = tickData.total_buy_quantity || 0
            let totalSellQty = tickData.total_sell_quantity || 0

            if (isUpstoxFormat(tickData)) {
              // Upstox format transformation - pass complete tickData
              depthData = transformUpstoxDepth(tickData)
              const totals = extractUpstoxTotals(tickData)
              totalBuyQty = totals.totalBuyQuantity || 0
              totalSellQty = totals.totalSellQuantity || 0

              // Debug log for first few transformations
              if (depthData && Math.random() < 0.1) {
                console.log('[Upstox] Transformed depth:', {
                  symbol: tickData.tradingsymbol,
                  buyLevels: depthData.buy.length,
                  sellLevels: depthData.sell.length,
                  totalBuy: totalBuyQty,
                  totalSell: totalSellQty
                })
              }
            } else if (tickData.depth) {
              // Standard Kite/Zerodha format
              depthData = {
                buy: tickData.depth.buy || [],
                sell: tickData.depth.sell || [],
              }
            }

            const newTick: TickData = {
              id: `${tickData.instrument_token}_${receivedAt}_${Math.random().toString(36).substr(2, 5)}`,
              instrument_token: tickData.instrument_token,
              last_price: tickData.last_price || 0,
              volume: tickData.volume_traded || 0,
              average_price: tickData.average_traded_price || tickData.last_price || 0,
              last_quantity: tickData.last_traded_quantity || 0,
              total_buy_quantity: totalBuyQty,
              total_sell_quantity: totalSellQty,
              depth: depthData,
              timestamp: tickTimestamp,
              delay: Math.max(0, interTickDelay), // This is now the inter-tick delay
              receivedAt,
              tradingsymbol: tickData.tradingsymbol || undefined,
              exchange: tickData.exchange || undefined,
            }

            if (newTick.instrument_token) {
              processedTicks.push(newTick)
              if ((newTick.instrument_token === 265 || newTick.instrument_token === 408065) && Math.random() < 0.1) {
                addDebugInfo(
                  `Specific Tick: ${newTick.tradingsymbol || newTick.instrument_token} Price: ${newTick.last_price}, Delay: ${newTick.delay}ms`,
                )
              }
            } else {
              addDebugInfo(`❌ Skipped invalid tick: ${JSON.stringify(tickData)}`)
            }
          }
        }

        if (processedTicks.length > 0) {
          addDebugInfo(
            `✅ Successfully processed ${processedTicks.length} ticks (${processedTicks.filter((t) => t.last_price > 0).length} with prices)`,
          )
        }
      } catch (error) {
        addDebugInfo(`Error processing data: ${error}`)
        addAlert("data", `Error processing data: ${error}`, "medium")
      }

      return processedTicks
    },
    [addAlert, addDebugInfo, isMarketOpen],
  )

  /**
   * Establish and manage a WebSocket connection to the configured endpoint.
   * Uses exponential backoff. Incoming message payloads are processed and
   * tick state is updated.
   */
  function getAudioPrefs(): { type: string; volume: number } {
    if (typeof window === "undefined") return { type: "sine", volume: 0.6 }
    const type = localStorage.getItem("alertSoundType") || "sine"
    const v = Number.parseInt(localStorage.getItem("alertSoundVolume") || "60")
    const volume = Number.isFinite(v) ? Math.max(0, Math.min(100, v)) / 100 : 0.6
    return { type, volume }
  }

  function mapSound(type: string): { osc: OscillatorType; freq: number } | null {
    const table: Record<string, { osc: OscillatorType; freq: number }> = {
      beep: { osc: "sine", freq: 660 },
      ding: { osc: "sine", freq: 880 },
      bell: { osc: "triangle", freq: 1000 },
      buzzer: { osc: "square", freq: 220 },
      chime: { osc: "sine", freq: 523.25 },
      sine: { osc: "sine", freq: 440 },
      square: { osc: "square", freq: 440 },
      triangle: { osc: "triangle", freq: 440 },
      sawtooth: { osc: "sawtooth", freq: 440 },
    }
    if (type === "silent") return null
    return table[type] || table.square
  }

  const shouldEmitConnectionAlerts = useCallback(() => {
    // Disable if alerts are globally disabled for this hook instance
    if (options?.disableAlerts) return false

    const status = getCurrentMarketStatus("equity")
    if (!status.isOpen) return false
    if (status.session && status.session !== "Open") return false
    return true
  }, [options?.disableAlerts])

  const startDisconnectSound = useCallback(() => {
    if (!audioContextRef.current) return
    const ctx = audioContextRef.current
    if (ctx.state === "suspended") ctx.resume()

    const prefs = getAudioPrefs()
    const mapped = mapSound(prefs.type)
    if (!mapped) return

    const beepDurationMs = 300
    const doBeep = () => {
      try {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = mapped.osc
        osc.frequency.setValueAtTime(mapped.freq, ctx.currentTime)
        const vol = Math.max(0, Math.min(1, prefs.volume))
        gain.gain.setValueAtTime(vol, ctx.currentTime)
        const now = ctx.currentTime
        osc.start(now)
        gain.gain.setTargetAtTime(vol, now, 0.01)
        gain.gain.setTargetAtTime(0, now + beepDurationMs / 1000 - 0.05, 0.05)
        osc.stop(now + beepDurationMs / 1000)
      } catch { }
    }
    if (disconnectSoundIntervalRef.current != null) window.clearInterval(disconnectSoundIntervalRef.current)
    doBeep()
    disconnectSoundIntervalRef.current = window.setInterval(doBeep, 1000)
  }, [])

  const stopDisconnectSound = useCallback(() => {
    if (disconnectSoundIntervalRef.current != null) {
      window.clearInterval(disconnectSoundIntervalRef.current)
      disconnectSoundIntervalRef.current = null
    }
  }, [])

  const scheduleReconnectOnce = useCallback(
    (delayMs: number, connect: () => void) => {
      if (reconnectTimeoutRef.current) return
      setNextRetryAt(Date.now() + delayMs)
      if (shouldEmitConnectionAlerts()) {
        startDisconnectSound()
      } else {
        stopDisconnectSound()
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null
        connect()
      }, delayMs)
    },
    [shouldEmitConnectionAlerts, startDisconnectSound, stopDisconnectSound],
  )

  // Retry countdown updater
  useEffect(() => {
    if (nextRetryAt == null) {
      setRetryCountdown(null)
      return
    }
    const id = window.setInterval(() => {
      const secs = Math.max(0, Math.ceil((nextRetryAt - Date.now()) / 1000))
      setRetryCountdown(secs)
      if (secs <= 0) window.clearInterval(id)
    }, 500)
    return () => window.clearInterval(id)
  }, [nextRetryAt])

  const connectToWS = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
    }

    connectionAttempts.current++
    setConnectionStatus("connecting")

    let wsUrl = url
    if (!wsUrl) {
      // Encode the token to ensure special characters like '@' are handled correctly
      const encodedToken = encodeURIComponent("Dashboard@Zerodha")
      wsUrl = `wss://kite.rvinod.com/ticks?token=${encodedToken}`
    }

    addDebugInfo(`Attempt ${connectionAttempts.current}: Connecting to ${wsUrl}`)

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      addDebugInfo(`WebSocket created, readyState: ${ws.readyState}`)

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          addDebugInfo("Connection timeout - closing connection")
          try {
            ws.close()
          } catch (e) { }
          setIsConnected(false)
          setConnectionStatus("disconnected")
          const delay = 10000
          scheduleReconnectOnce(delay, connectToWS)
          if (shouldEmitConnectionAlerts()) {
            addAlert("connection", "Connection timeout", "high")
          } else {
            addDebugInfo("Connection timeout outside trading hours - alert suppressed")
          }
        }
      }, 8000)

      ws.onopen = (event) => {
        clearTimeout(connectionTimeout)
        addDebugInfo("WebSocket connection opened successfully")
        setIsConnected(true)
        setConnectionStatus("connected")
        setNextRetryAt(null)
        setRetryCountdown(null)
        stopDisconnectSound()
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
        connectionAttempts.current = 0
        addAlert("connection", "Successfully connected to tick stream", "low")
      }

      ws.onmessage = (event) => {
        // Some upstreams send control messages; ignore empty payloads
        if (!event.data) return
        const processedTicks = processTickData(event.data, "message")
        if (processedTicks.length > 0) {
          if (options?.onTick) {
            options.onTick(processedTicks)
          }
          setTicks((prev) => [...processedTicks, ...prev].slice(0, MAX_TICKS_STORED))
          setTotalTicks((prev) => prev + processedTicks.length)
          setLastTickTime(Date.now())
          setIsFrozen(false)

          const highDelayTicks = processedTicks.filter((tick) => tick.delay > DELAY_THRESHOLD)
          if (highDelayTicks.length > 0)
            addAlert("delay", `${highDelayTicks.length} ticks with high inter-tick delay detected`, "medium")

          if (freezeTimeoutRef.current) clearTimeout(freezeTimeoutRef.current)
          freezeTimeoutRef.current = setTimeout(() => {
            setIsFrozen(true)
            setFreezingIncidents((prev) => prev + 1)
            addAlert("freeze", `No data received for ${FREEZE_THRESHOLD / 1000} seconds`, "high")
          }, FREEZE_THRESHOLD)
        }
      }

      ws.onerror = (error) => {
        clearTimeout(connectionTimeout)
        addDebugInfo(`WebSocket error occurred`)

        // Always attempt reconnect on error
        addDebugInfo("Connection error - scheduling reconnect")
        setIsConnected(false)
        setConnectionStatus("disconnected")

        const delay = 10000
        try {
          ws.close()
        } catch { }
        scheduleReconnectOnce(delay, connectToWS)
        if (shouldEmitConnectionAlerts()) {
          addAlert("connection", `Connection lost. Reconnecting in ${delay / 1000}s...`, "high")
        } else {
          addDebugInfo("Connection lost outside trading hours - alert suppressed")
        }
      }

      ws.onclose = (event) => {
        // Handle close if not already handled by onerror
        // We check if this is the current socket to avoid race conditions
        if (ws === wsRef.current) {
          addDebugInfo(`WebSocket connection closed: ${event.code} ${event.reason}`)
          setIsConnected(false)
          setConnectionStatus("disconnected")

          // Only schedule reconnect if not already scheduled (e.g. by onerror)
          if (!reconnectTimeoutRef.current) {
            const delay = 5000
            scheduleReconnectOnce(delay, connectToWS)
          }
        }
      }

    } catch (error) {
      addDebugInfo(`Failed to create WebSocket connection: ${error}`)
      setConnectionStatus("disconnected")
      const delay = 10000
      scheduleReconnectOnce(delay, connectToWS)
      if (shouldEmitConnectionAlerts()) {
        addAlert("connection", `Connection failed. Reconnecting in ${delay / 1000}s...`, "high")
      } else {
        addDebugInfo("Connection failed outside trading hours - alert suppressed")
      }
    }
  }, [addAlert, addDebugInfo, processTickData, scheduleReconnectOnce, shouldEmitConnectionAlerts])

  useEffect(() => {
    connectToWS()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (freezeTimeoutRef.current) {
        clearTimeout(freezeTimeoutRef.current)
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      stopDisconnectSound()
    }
  }, [connectToWS, stopDisconnectSound])

  const averageDelay = calculateAverageDelay(ticks)

  return {
    ticks,
    isConnected,
    isFrozen,
    lastTickTime,
    averageDelay,
    totalTicks,
    freezingIncidents,
    alerts,
    connectionStatus,
    clearAlerts,
    addAlert,
    rawMessages,
    debugInfo,
    addTestTick,
    addDebugInfo,
    nextRetryIn: retryCountdown,
  }
}
