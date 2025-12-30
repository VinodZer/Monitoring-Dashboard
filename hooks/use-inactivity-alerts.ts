"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { TickData } from "./use-tick-data"
import { shouldAlertsBeActive, getDetailedMarketStatus, isInMarketCloseBuffer } from "@/utils/market-timings"
import { StaleDataDetector } from "@/lib/stale-data-detector"
import { depthPlusLtp } from "@/utils/depth-ltp"
import { getExchangeFromName, getDefaultDpltpDuration } from "@/utils/exchange-detection"
import pb from "@/lib/pocketbase"

/**
 * Resolve instrument name for a TickData entry. Prefers tradingsymbol when
 * present, otherwise falls back to a small lookup table.
 * @param tick - TickData object
 * @returns Human friendly instrument name
 */
const getInstrumentName = (tick: TickData) => {
  if (tick.tradingsymbol) return tick.tradingsymbol
  const tokenMap: Record<number, string> = {
    256265: "NIFTY",
    265: "SENSEX",
    128083204: "RELIANCE",
    281836549: "BHEL",
    408065: "USDINR",
    134657: "CRUDEOIL",
  }
  return tokenMap[tick.instrument_token] || `TOKEN_${tick.instrument_token}`
}

export interface InactivityAlertConfig {
  // LTP-only alerts
  enabled: boolean
  duration: number // seconds
  // Depth + LTP composite alerts
  dpltpEnabled?: boolean
  dpltpDuration?: number // seconds
  // Common
  respectMarketHours: boolean
}

export interface InactivityAlert {
  id: string
  instrumentToken: number
  instrumentName: string
  exchange?: string
  timestamp: number
  // configured threshold (seconds) that triggered the alert
  duration: number
  // actual seconds feed was stale when alert fired
  missingSeconds?: number
  baselinePrice: number
  currentPrice: number
  priceRange: { min: number; max: number }
  // actual LTP at the moment of trigger (independent of alert type)
  ltpAtTrigger: number
  marketSession: string
  marketType: string
  checked: boolean
  alertType: "ltp" | "dpltp"
}

interface SymbolState {
  // LTP tracking
  ltpBaseline: number
  ltpHistory: { price: number; timestamp: number }[]
  // Depth+LTP tracking
  dpltpBaseline: number
  dpltpHistory: { price: number; timestamp: number }[]
  // Market status and sound
  lastMarketStatusCheck: number
  wasMarketOpen: boolean
  oscillator: OscillatorNode | null
  gainNode: GainNode | null
  intervalId: number | null
}

const DEFAULT_CONFIG: InactivityAlertConfig = {
  enabled: false,
  duration: 15,
  dpltpEnabled: true,
  dpltpDuration: 60,
  respectMarketHours: true,
}

// Helper: minimal index detection aligned with settings tab usage
const INDEX_TOKENS = new Set<number>([265, 256265, 260105, 26009, 12839])
const INDEX_NAMES = new Set<string>(["SENSEX", "NIFTY 50", "NIFTY", "NIFTY BANK", "BANKNIFTY", "BANKEX"])
const isIndexSymbol = (token: number, name: string) => INDEX_TOKENS.has(token) || INDEX_NAMES.has(name)

/**
 * Produce a default InactivityAlertConfig for an instrument based on simple
 * heuristics (ticker names, exchange type, and index classification).
 *
 * @param token - Instrument token number
 * @param instrumentName - Human readable instrument name
 * @returns InactivityAlertConfig with sensible defaults
 */
function defaultConfigForInstrument(token: number, instrumentName: string): InactivityAlertConfig {
  const name = instrumentName.toUpperCase()

  if (isIndexSymbol(token, instrumentName)) {
    return { enabled: true, duration: 15, dpltpEnabled: false, dpltpDuration: 0, respectMarketHours: true }
  }

  // Specific overrides: set defaults to 15 seconds for certain instruments/exchanges
  const specialTickers = ["BHEL", "RELIANCE", "NIFTY", "SENSEX"]
  const specialExchanges = ["NFO", "BFO"]

  const matchesTicker = specialTickers.some((t) => name.includes(t))
  const matchesExchange = specialExchanges.some((e) => name.includes(e))

  const exchange = getExchangeFromName(instrumentName)
  const durationDefault = exchange === "MCX" || exchange === "CDS" ? 30 : 15
  const dpltpDefault = getDefaultDpltpDuration(exchange)

  if (matchesTicker || matchesExchange) {
    return { enabled: false, duration: durationDefault, dpltpEnabled: true, dpltpDuration: dpltpDefault, respectMarketHours: true }
  }

  return { enabled: false, duration: durationDefault, dpltpEnabled: true, dpltpDuration: dpltpDefault, respectMarketHours: true }
}

/**
 * useInactivityAlerts monitors incoming ticks to detect LTP or Depth+LTP
 * inactivity for configured instruments. It manages per-instrument state,
 * produces alert objects, and exposes configuration APIs for UI components.
 *
 * @param ticks - Array of TickData received from the live feed
 * @param options - Optional configuration including onAlert callback
 * @returns An object with alerts, inactiveSymbols, configurations and helper methods
 */
export function useInactivityAlerts(
  ticks: TickData[],
  isConnected: boolean,
  isFrozen: boolean,
  options?: { onAlert?: (alert: InactivityAlert) => void },
) {
  const [configurations, setConfigurations] = useState<Map<number, InactivityAlertConfig>>(new Map())

  // Create a unique identifier for this hook instance to avoid duplicate keys
  const hookId = useState(() => Math.random().toString(36).substr(2, 9))[0]

  const [alerts, setAlerts] = useState<InactivityAlert[]>([])
  const [inactiveSymbols, setInactiveSymbols] = useState<Set<number>>(new Set())

  const symbolStates = useRef<Map<number, SymbolState>>(new Map())
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        } catch (e) {
          // Web Audio API not available or failed to initialize
        }
      }
      window.removeEventListener("click", initAudio)
    }
    window.addEventListener("click", initAudio)
    return () => window.removeEventListener("click", initAudio)
  }, [])

  const stopAlertSound = useCallback((instrumentToken: number) => {
    const state = symbolStates.current.get(instrumentToken)
    if (!state) return

    if (state.intervalId != null) {
      clearInterval(state.intervalId)
      state.intervalId = null
    }

    if (state.oscillator) {
      try {
        state.oscillator.stop()
        state.oscillator.disconnect()
      } catch { }
      state.oscillator = null
    }
    if (state.gainNode) {
      try {
        state.gainNode.disconnect()
      } catch { }
      state.gainNode = null
    }
  }, [])

  // Read global audio preferences from localStorage
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
    return table[type] || table.beep
  }

  const playAlertSound = useCallback(
    (instrumentToken: number) => {
      if (!audioContextRef.current) return

      const ctx = audioContextRef.current
      if (ctx.state === "suspended") ctx.resume()

      // Stop any existing sound for this instrument first
      stopAlertSound(instrumentToken)

      const prefs = getAudioPrefs()
      const mapped = mapSound(prefs.type)
      if (!mapped) return

      const beepDurationMs = 300

      const doBeep = () => {
        try {
          const oscillator = ctx.createOscillator()
          const gainNode = ctx.createGain()
          oscillator.connect(gainNode)
          gainNode.connect(ctx.destination)

          oscillator.type = mapped.osc
          oscillator.frequency.setValueAtTime(mapped.freq, ctx.currentTime)
          const vol = Math.max(0, Math.min(1, prefs.volume))
          gainNode.gain.setValueAtTime(vol, ctx.currentTime)

          const now = ctx.currentTime
          oscillator.start(now)
          // quick fade-out to avoid clicks
          gainNode.gain.setTargetAtTime(vol, now, 0.01)
          gainNode.gain.setTargetAtTime(0, now + beepDurationMs / 1000 - 0.05, 0.05)
          oscillator.stop(now + beepDurationMs / 1000)

          const state = symbolStates.current.get(instrumentToken)
          if (state) {
            state.oscillator = oscillator
            state.gainNode = gainNode
          }
        } catch { }
      }

      // Beep immediately and then every 1s
      doBeep()
      const id = window.setInterval(doBeep, 1000)
      const state = symbolStates.current.get(instrumentToken)
      if (state) {
        state.intervalId = id
      }
    },
    [stopAlertSound],
  )

  const showBrowserNotification = useCallback((alert: InactivityAlert) => {
    if (!("Notification" in window)) return

    const title = `${alert.alertType === "ltp" ? "LTP" : "Depth + LTP"} Inactivity Alert: ${alert.instrumentName}`
    const usedSeconds = alert.missingSeconds ?? alert.duration
    const body =
      alert.alertType === "ltp"
        ? `LTP remained unchanged at ₹${alert.baselinePrice.toFixed(2)} for ${usedSeconds} seconds during ${alert.marketSession} session.`
        : `Depth + LTP price remained unchanged for ${usedSeconds} seconds during ${alert.marketSession} session. Current price: ₹${alert.currentPrice.toFixed(2)}`

    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        tag: `inactivity-${alert.alertType}-${alert.instrumentToken}`,
      })
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") showBrowserNotification(alert)
      })
    }
  }, [])

  const triggerAlert = useCallback(
    (
      tick: TickData,
      config: InactivityAlertConfig,
      state: SymbolState,
      alertType: "ltp" | "dpltp" = "ltp",
      missingSeconds?: number,
    ) => {
      const instrumentName = getInstrumentName(tick)
      const marketStatus = getDetailedMarketStatus(instrumentName)

      if (config.respectMarketHours) {
        const active = marketStatus.marketType === "equity" ? marketStatus.session === "Open" : marketStatus.isOpen
        if (!active) return

        // Additional check: don't trigger alerts in the last 30 seconds before market close for equity
        if (marketStatus.marketType === "equity" && isInMarketCloseBuffer(instrumentName, 30)) {
          if (Math.random() < 0.1) {
            console.log("[v0] Skipping alert for", instrumentName, "- within 30 seconds of market close")
          }
          return
        }
      }

      const series = alertType === "ltp" ? state.ltpHistory : state.dpltpHistory
      const prices = series.map((h) => h.price)
      const priceRange = {
        min: prices.length ? Math.min(...prices) : 0,
        max: prices.length ? Math.max(...prices) : 0,
      }

      const currentLtp = typeof tick.last_price === "number" ? tick.last_price : state.ltpBaseline
      const currentComposite = depthPlusLtp(tick)

      const newAlert: InactivityAlert = {
        id: `${hookId}-${crypto.randomUUID()}`,
        instrumentToken: tick.instrument_token,
        instrumentName,
        exchange: tick.exchange || getExchangeFromName(instrumentName),
        timestamp: Date.now(),
        duration:
          alertType === "ltp"
            ? config.duration || DEFAULT_CONFIG.duration
            : config.dpltpDuration || DEFAULT_CONFIG.dpltpDuration!,
        missingSeconds: typeof missingSeconds === "number" ? Math.round(missingSeconds) : undefined,
        baselinePrice: alertType === "ltp" ? state.ltpBaseline : state.dpltpBaseline,
        currentPrice: alertType === "ltp" ? currentLtp : currentComposite,
        ltpAtTrigger: state.ltpBaseline,
        priceRange,
        marketSession: marketStatus.session,
        marketType: marketStatus.marketType,
        checked: false,
        alertType,
      }

      setAlerts((prev) => [newAlert, ...prev].slice(0, 100))
      setInactiveSymbols((prev) => new Set(prev).add(tick.instrument_token))
      playAlertSound(tick.instrument_token)
      showBrowserNotification(newAlert)

      if (options?.onAlert) {
        options.onAlert(newAlert)
      }
    },
    [playAlertSound, showBrowserNotification, options],
  )

  // Detectors
  const ltpDetectorRef = useRef<StaleDataDetector | null>(null)
  const dpltpDetectorRef = useRef<StaleDataDetector | null>(null)
  if (!ltpDetectorRef.current) ltpDetectorRef.current = new StaleDataDetector()
  if (!dpltpDetectorRef.current) dpltpDetectorRef.current = new StaleDataDetector()

  const clearSymbolState = useCallback(
    (token: number) => {
      const state = symbolStates.current.get(token)
      if (state) stopAlertSound(token)
      symbolStates.current.delete(token)
      setInactiveSymbols((prev) => {
        if (prev.has(token)) {
          const newSet = new Set(prev)
          newSet.delete(token)
          return newSet
        }
        return prev
      })
    },
    [stopAlertSound],
  )

  // Reset state when disconnected
  useEffect(() => {
    if (!isConnected) {
      symbolStates.current.forEach((_, token) => {
        stopAlertSound(token)
      })
      symbolStates.current.clear()
      setInactiveSymbols(new Set())
      // Reset detectors to prevent false positives on reconnect
      ltpDetectorRef.current = new StaleDataDetector()
      dpltpDetectorRef.current = new StaleDataDetector()
      // We purposefully don't clear the alerts list so the user can see history,
      // but we stop the active "alerting" state and sounds.
    }
  }, [isConnected, stopAlertSound])

  useEffect(() => {
    // If not connected, do not process ticks for alerts
    if (!isConnected) return

    // If global feed is frozen (likely internet loss but socket open), 
    // suppress individual alerts to avoid "all segments" firing.
    if (isFrozen) {
      if (symbolStates.current.size > 0) {
        symbolStates.current.forEach((_, token) => stopAlertSound(token))
        symbolStates.current.clear()
        setInactiveSymbols(new Set())
      }
      // Reset detectors to avoid stale state on unfreeze
      ltpDetectorRef.current = new StaleDataDetector()
      dpltpDetectorRef.current = new StaleDataDetector()
      return
    }

    const latestTicks = new Map<number, TickData>()
    for (const tick of ticks) {
      if (
        !latestTicks.has(tick.instrument_token) ||
        tick.receivedAt > latestTicks.get(tick.instrument_token)!.receivedAt
      ) {
        latestTicks.set(tick.instrument_token, tick)
      }
    }

    latestTicks.forEach((tick) => {
      let config = configurations.get(tick.instrument_token)
      const name = getInstrumentName(tick)
      const isIndex = isIndexSymbol(tick.instrument_token, name)

      if (!config) {
        const def = defaultConfigForInstrument(tick.instrument_token, name)
        setConfigurations((prev) => {
          const next = new Map(prev)
          next.set(tick.instrument_token, def)
          return next
        })
        config = def
      }

      if (isIndex) {
        const enforced: InactivityAlertConfig = {
          ...config,
          // Only enforce depth+LTP rules, don't touch LTP enabled state
          dpltpEnabled: false,
          dpltpDuration: 0,
        }
        const needsUpdate = (config.dpltpEnabled ?? false) !== false || (config.dpltpDuration ?? 0) !== 0
        if (needsUpdate) {
          setConfigurations((prev) => {
            const next = new Map(prev)
            next.set(tick.instrument_token, enforced)
            return next
          })
          config = enforced
        }
      }

      if (!config.enabled && !config.dpltpEnabled) {
        clearSymbolState(tick.instrument_token)
        return
      }

      const instrumentName = getInstrumentName(tick)
      const shouldAlert = config.respectMarketHours ? shouldAlertsBeActive(instrumentName) : true

      // If alerts are not active due to market hours and the config respects market hours,
      // clear any symbol state and skip processing for this tick.
      if (config.respectMarketHours && !shouldAlert) {
        clearSymbolState(tick.instrument_token)
        return
      }

      let state = symbolStates.current.get(tick.instrument_token)
      if (!state) {
        const ltp = typeof tick.last_price === "number" ? tick.last_price : 0
        const composite = depthPlusLtp(tick)
        state = {
          ltpBaseline: ltp,
          ltpHistory: [{ price: ltp, timestamp: Date.now() }],
          dpltpBaseline: composite,
          dpltpHistory: [{ price: composite, timestamp: Date.now() }],
          lastMarketStatusCheck: Date.now(),
          wasMarketOpen: shouldAlert,
          oscillator: null,
          gainNode: null,
          intervalId: null,
        }
        symbolStates.current.set(tick.instrument_token, state)
        return
      }

      // Check market open/close transitions every minute
      const now = Date.now()
      if (now - state.lastMarketStatusCheck > 60000) {
        state.lastMarketStatusCheck = now
        if (state.wasMarketOpen !== shouldAlert) {
          state.wasMarketOpen = shouldAlert
          if (shouldAlert) {
            // Market opened: reset baselines
            const ltp = typeof tick.last_price === "number" ? tick.last_price : state.ltpBaseline
            state.ltpBaseline = ltp
            state.dpltpBaseline = depthPlusLtp(tick)
            stopAlertSound(tick.instrument_token)
            return
          } else {
            // Market closed
            stopAlertSound(tick.instrument_token)
            return
          }
        }
      }

      if (!shouldAlert && config.respectMarketHours) {
        stopAlertSound(tick.instrument_token)
        return
      }

      // Append to histories and update baselines
      const ts = Date.now()
      const ltp = typeof tick.last_price === "number" ? tick.last_price : state.ltpBaseline
      const composite = depthPlusLtp(tick)

      state.ltpHistory.push({ price: ltp, timestamp: ts })
      state.dpltpHistory.push({ price: composite, timestamp: ts })

      const fiveMinutesAgo = ts - 5 * 60 * 1000
      state.ltpHistory = state.ltpHistory.filter((h) => h.timestamp > fiveMinutesAgo).slice(-100)
      state.dpltpHistory = state.dpltpHistory.filter((h) => h.timestamp > fiveMinutesAgo).slice(-100)

      if (ltp !== state.ltpBaseline) state.ltpBaseline = ltp
      if (composite !== state.dpltpBaseline) state.dpltpBaseline = composite

      const marketStatus = getDetailedMarketStatus(instrumentName)
      const marketType = marketStatus.marketType

      if (config?.enabled) {
        const ltpResult = ltpDetectorRef.current!.detectStaleFeed(
          String(tick.instrument_token),
          { last_price: ltp },
          {
            marketType,
            isIndex: isIndex,
            thresholdOverrideSec: config.duration,
          },
        )
        if (ltpResult.is_stale && !inactiveSymbols.has(tick.instrument_token)) {
          triggerAlert(tick, config, state, "ltp", ltpResult.time_since_change)
        }
      }

      if (config?.dpltpEnabled) {
        const dpltpResult = dpltpDetectorRef.current!.detectStaleFeed(
          `${String(tick.instrument_token)}-dpltp`,
          { price: composite },
          {
            marketType,
            isIndex: false,
            thresholdOverrideSec: config.dpltpDuration || DEFAULT_CONFIG.dpltpDuration!,
          },
        )
        if (dpltpResult.is_stale && !inactiveSymbols.has(tick.instrument_token)) {
          triggerAlert(tick, config, state, "dpltp", dpltpResult.time_since_change)
        }
      }
    })
  }, [ticks, configurations, clearSymbolState, inactiveSymbols, stopAlertSound, triggerAlert])

  const updateConfiguration = useCallback(
    (token: number, config: InactivityAlertConfig) => {
      setConfigurations((prev) => new Map(prev).set(token, config))
      // Reset any sound/visuals
      stopAlertSound(token)
    },
    [stopAlertSound],
  )

  const clearAllAlerts = useCallback(() => {
    setAlerts([])
    symbolStates.current.forEach((_, token) => stopAlertSound(token))
    setInactiveSymbols(new Set())
  }, [stopAlertSound])

  const markAlertAsChecked = useCallback(
    (alertId: string) => {
      setAlerts((prev) =>
        prev.map((alert) => {
          if (alert.id === alertId) {
            stopAlertSound(alert.instrumentToken)
            setInactiveSymbols((prevInactive) => {
              const newSet = new Set(prevInactive)
              newSet.delete(alert.instrumentToken)
              return newSet
            })

            // Save to PocketBase
            if (!alert.checked) {
              const logData = {
                instrument_name: alert.instrumentName,
                alert_type: alert.alertType,
                message: alert.alertType === "ltp"
                  ? `LTP unchanged for ${alert.missingSeconds ?? alert.duration}s`
                  : `Depth+LTP unchanged for ${alert.missingSeconds ?? alert.duration}s`,
                duration: alert.duration,
                missing_seconds: alert.missingSeconds || alert.duration,
                market_session: alert.marketSession,
                created: new Date().toISOString()
              }

              pb.collection("alert_logs").create(logData)
                .then(() => console.log("Alert log saved"))
                .catch((err) => console.error("Failed to save alert log:", err))
            }

            return { ...alert, checked: true }
          }
          return alert
        }),
      )
    },
    [stopAlertSound],
  )

  return { alerts, inactiveSymbols, configurations, updateConfiguration, clearAllAlerts, markAlertAsChecked }
}
