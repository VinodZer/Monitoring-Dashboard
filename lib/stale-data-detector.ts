export type MarketType = "equity" | "currency" | "commodity" | string

export interface StaleResult {
  is_stale: boolean
  time_since_change: number
  data_changed: boolean
  staleness_reason: string | null
  threshold_used: number
  baseline_time: string
  check_time: string
}

/**
 * Stable stringify that deterministically serializes objects/arrays while
 * handling cycles. Keys are sorted to ensure consistent output for equivalent
 * objects with different key orders.
 *
 * @param {any} value - The value to stringify
 * @returns {string} A JSON string representation with stable key ordering
 */
function stableStringify(value: any): string {
  const seen = new WeakSet()
  const helper = (val: any): any => {
    if (val && typeof val === "object") {
      if (seen.has(val)) return undefined
      seen.add(val)
      if (Array.isArray(val)) return val.map(helper)
      const out: Record<string, any> = {}
      for (const key of Object.keys(val).sort()) {
        out[key] = helper(val[key])
      }
      return out
    }
    return val
  }
  return JSON.stringify(helper(value))
}

/**
 * Compute a simple deterministic hash for a string using a DJB2-like algorithm.
 * The result is returned as an unsigned hex string.
 *
 * @param {string} input - Input string to hash
 * @returns {string} Hex representation of the unsigned hash
 */
function hashString(input: string): string {
  // simple, fast DJB2 hash converted to hex
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

/**
 * StaleDataDetector tracks simple content hashes for market data entries and
 * determines whether a feed is stale based on configurable thresholds.
 *
 * Internally it stores the last seen hash and last change timestamp per
 * instrument id and exposes detectStaleFeed to evaluate staleness.
 */
export class StaleDataDetector {
  private previousHashes = new Map<string, string | null>()
  private lastChangeTimes = new Map<string, number>()

  // Thresholds in seconds (mapped by marketType; mirrors Python intent by exchange family)
  private thresholds: Record<string, number> = {
    equity: 15, // NSE/BSE/NFO/BFO
    derivatives: 15, // alias if needed
    currency: 300, // CDS/BCD
    commodity: 180, // MCX
  }

  private indexThreshold = 15 // seconds

  constructor(opts?: {
    thresholds?: Partial<Record<string, number>>
    indexThreshold?: number
  }) {
    if (opts?.thresholds) this.thresholds = { ...this.thresholds, ...opts.thresholds }
    if (typeof opts?.indexThreshold === "number") this.indexThreshold = opts.indexThreshold
  }

  /**
   * Generate a stable hash for the provided data or return null for null/unsupported values.
   * @param data - Market data object to hash
   * @returns Hex string hash or null
   */
  private generateHash(data: any): string | null {
    if (data == null) return null
    try {
      return hashString(stableStringify(data))
    } catch {
      return null
    }
  }

  /**
   * Analyze marketData for the given instrument and return staleness information.
   * @param instrumentId - Unique instrument identifier used as key for tracking
   * @param marketData - The market data object to inspect
   * @param opts - Optional parameters controlling thresholds and market classification
   * @returns StaleResult describing whether data is stale and related metadata
   */
  detectStaleFeed(
    instrumentId: string,
    marketData: any,
    opts?: {
      marketType?: MarketType
      isIndex?: boolean
      thresholdOverrideSec?: number
      nowMs?: number
    },
  ): StaleResult {
    const now = opts?.nowMs ?? Date.now()
    const baselineTime = now

    const currentHash = this.generateHash(marketData)

    let data_changed = false
    const prevHash = this.previousHashes.get(instrumentId)
    if (!this.previousHashes.has(instrumentId)) {
      data_changed = true
      this.previousHashes.set(instrumentId, currentHash)
      this.lastChangeTimes.set(instrumentId, now)
    } else if (currentHash !== prevHash) {
      data_changed = true
      this.previousHashes.set(instrumentId, currentHash)
      this.lastChangeTimes.set(instrumentId, now)
    }

    const lastChange = this.lastChangeTimes.get(instrumentId) ?? now
    const time_since_change = (now - lastChange) / 1000

    let threshold = opts?.thresholdOverrideSec ?? 0
    if (!threshold) {
      if (opts?.isIndex) {
        threshold = this.indexThreshold
      } else {
        const mt = (opts?.marketType || "").toLowerCase()
        // default to 60s if unknown
        threshold = this.thresholds[mt] ?? 60
      }
    }

    const is_stale = time_since_change > threshold
    let staleness_reason: string | null = null
    if (is_stale) {
      staleness_reason = opts?.isIndex
        ? `Index data unchanged for ${time_since_change.toFixed(1)}s (threshold: ${threshold}s)`
        : `Market data unchanged for ${time_since_change.toFixed(1)}s (threshold: ${threshold}s)`
    }

    return {
      is_stale,
      time_since_change,
      data_changed,
      staleness_reason,
      threshold_used: threshold,
      baseline_time: new Date(baselineTime).toISOString(),
      check_time: new Date(now).toISOString(),
    }
  }
}

/**
 * TimingAnalyzer provides a small utility to analyze timestamp differences
 * between baseline and data timestamps and classify discrepancies.
 */
export class TimingAnalyzer {
  constructor(
    private expectedSleep = 1.0,
    private delayThreshold = 2.0,
  ) {}

  /**
   * Analyze timing difference and classify discrepancy type.
   * @param baselineTimeMs - Baseline time in milliseconds
   * @param dataTimestampMs - Data timestamp in milliseconds
   * @returns Analysis result with discrepancy metadata
   */
  analyze(
    baselineTimeMs?: number,
    dataTimestampMs?: number,
  ): {
    has_discrepancy: boolean
    discrepancy_type: "insufficient_data" | "normal" | "cached_data" | "api_delay"
    time_diff: number | null
    expected_range?: [number, number]
    severity?: "low" | "high"
  } {
    if (!baselineTimeMs || !dataTimestampMs) {
      return { has_discrepancy: false, discrepancy_type: "insufficient_data", time_diff: null }
    }
    const time_diff = (dataTimestampMs - baselineTimeMs) / 1000
    const expected_min = this.expectedSleep - 0.5
    const expected_max = this.expectedSleep + this.delayThreshold

    let discrepancy_type: "normal" | "cached_data" | "api_delay" = "normal"
    let has_discrepancy = false

    if (time_diff < expected_min) {
      has_discrepancy = true
      discrepancy_type = "cached_data"
    } else if (time_diff > expected_max) {
      has_discrepancy = true
      discrepancy_type = "api_delay"
    }

    return {
      has_discrepancy,
      discrepancy_type,
      time_diff,
      expected_range: [expected_min, expected_max],
      severity: Math.abs(time_diff - this.expectedSleep) > this.delayThreshold ? "high" : "low",
    }
  }
}
