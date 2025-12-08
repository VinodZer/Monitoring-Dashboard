import { useMemo } from "react"
import type { TickData } from "@/hooks/use-tick-data"
import { normalizeSymbol } from "@/utils/symbol-normalizer"

export interface FeedComparisonData {
    /** Sorted list of all unique normalized instrument symbols */
    instruments: string[]
    /** Map for O(1) lookup of tick data by normalized symbol for feed 1 */
    feed1Map: Map<string, TickData>
    /** Map for O(1) lookup of tick data by normalized symbol for feed 2 */
    feed2Map: Map<string, TickData>
    /** Map of normalized symbol to original symbols from both feeds */
    originalSymbolsMap: Map<string, { feed1?: string; feed2?: string }>
}

/**
 * Custom hook to process and organize feed comparison data with symbol normalization
 * Creates efficient lookup structures for comparing two tick data feeds
 * Handles different naming conventions between feeds (e.g., Kite vs Upstox)
 * 
 * @param feed1Ticks - Tick data array from first feed
 * @param feed2Ticks - Tick data array from second feed
 * @returns Object containing sorted instruments and lookup maps
 */
export function useFeedComparison(
    feed1Ticks: TickData[],
    feed2Ticks: TickData[]
): FeedComparisonData {
    return useMemo(() => {
        // Collect all unique normalized instrument symbols
        const instrumentSet = new Set<string>()

        // Create maps for O(1) lookup
        const feed1Map = new Map<string, TickData>()
        const feed2Map = new Map<string, TickData>()
        const originalSymbolsMap = new Map<string, { feed1?: string; feed2?: string }>()

        // Process feed 1
        feed1Ticks.forEach(tick => {
            if (tick.tradingsymbol) {
                // Pass exchange to normalization
                const normalized = normalizeSymbol(tick.tradingsymbol, tick.exchange)
                instrumentSet.add(normalized)
                feed1Map.set(normalized, tick)

                const existing = originalSymbolsMap.get(normalized) || {}
                originalSymbolsMap.set(normalized, { ...existing, feed1: tick.tradingsymbol })
            }
        })

        // Process feed 2
        feed2Ticks.forEach(tick => {
            if (tick.tradingsymbol) {
                // Pass exchange to normalization
                const normalized = normalizeSymbol(tick.tradingsymbol, tick.exchange)
                instrumentSet.add(normalized)
                feed2Map.set(normalized, tick)

                const existing = originalSymbolsMap.get(normalized) || {}
                originalSymbolsMap.set(normalized, { ...existing, feed2: tick.tradingsymbol })
            }
        })

        // Convert to sorted array
        const instruments = Array.from(instrumentSet).sort()

        return {
            instruments,
            feed1Map,
            feed2Map,
            originalSymbolsMap,
        }
    }, [feed1Ticks, feed2Ticks])
}
