"use client"

import React from "react"
import { useTickData } from "@/hooks/use-tick-data"
import { useFeedComparison } from "@/hooks/use-feed-comparison"
import { CompareFeedStatus } from "@/components/compare-feed-status"
import { CompareInstrumentCard } from "@/components/compare-instrument-card"
import { getDisplayName } from "@/utils/symbol-normalizer"

/**
 * Compare Tab Component
 * Displays side-by-side comparison of two market data feeds
 * Shows connection status, prices, spreads, and market depth for each instrument
 */
import type { TickData } from "@/hooks/use-tick-data"

interface CompareTabProps {
    feed1Ticks: TickData[]
    feed1IsConnected: boolean
    feed2Ticks: TickData[]
    feed2IsConnected: boolean
}

/**
 * Compare Tab Component
 * Displays side-by-side comparison of two market data feeds
 * Shows connection status, prices, spreads, and market depth for each instrument
 */
export function CompareTab({
    feed1Ticks,
    feed1IsConnected,
    feed2Ticks,
    feed2IsConnected
}: CompareTabProps) {
    // Process feeds into efficient comparison data structure with symbol normalization
    const { instruments, feed1Map, feed2Map, originalSymbolsMap } = useFeedComparison(feed1Ticks, feed2Ticks)

    // Filter instruments: show only instruments matching these keywords
    const filteredInstruments = React.useMemo(() => {
        // 1. Instruments that are allowed unconditionally (Stocks, Commodities, Currencies)
        const unconditionalTargets = [
            'CRUDEOIL',
            'USDINR',
            'RELIANCE',
        ]

        // 2. Indices that MUST be Futures (Must have expiry date)
        const indexTargets = ['NIFTY', 'SENSEX', 'BANKEX', 'BANKNIFTY']

        // Regex to detect month codes (indicating expiry/future)
        // Normalized symbols for futures will contain these (e.g. 25DEC)
        const expiryPattern = /JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC/

        return instruments.filter((normalizedSymbol) => {
            const upper = normalizedSymbol.toUpperCase()

            // Check unconditional targets first
            if (unconditionalTargets.some(t => upper.includes(t))) {
                return true
            }

            // Check indices - MUST have expiry pattern to be a future
            const isIndex = indexTargets.some(i => upper.includes(i))
            if (isIndex) {
                return expiryPattern.test(upper)
            }

            return false
        })
    }, [instruments])

    // Log feed source verification
    React.useEffect(() => {
        if (filteredInstruments.length > 0) {
            const firstNormalized = filteredInstruments[0]
            const tick1 = feed1Map.get(firstNormalized)
            const tick2 = feed2Map.get(firstNormalized)
            const originalSymbols = originalSymbolsMap.get(firstNormalized)

            console.log('=== FEED SOURCE VERIFICATION ===')
            console.log('Feed 1 URL: wss://kite.rvinod.com/ticks')
            console.log('Feed 2 URL: wss://upstox.vinod.app/ticks')
            console.log(`Normalized symbol: ${firstNormalized}`)
            console.log(`Original symbol Feed 1: ${originalSymbols?.feed1 || 'N/A'}`)
            console.log(`Original symbol Feed 2: ${originalSymbols?.feed2 || 'N/A'}`)
            console.log('Total instruments after filter:', filteredInstruments.length)
            console.log('Filtered instruments:', filteredInstruments.join(', '))
            console.log('Feed 1 price:', tick1?.last_price)
            console.log('Feed 2 price:', tick2?.last_price)
            console.log('Feed 1 depth buy levels:', tick1?.depth?.buy?.length || 0)
            console.log('Feed 2 depth buy levels:', tick2?.depth?.buy?.length || 0)

            if (tick1?.depth?.buy?.[0] && tick2?.depth?.buy?.[0]) {
                console.log('Feed 1 best bid:', tick1.depth.buy[0].price, 'qty:', tick1.depth.buy[0].quantity)
                console.log('Feed 2 best bid:', tick2.depth.buy[0].price, 'qty:', tick2.depth.buy[0].quantity)
                console.log('Are they identical?', tick1.depth.buy[0].price === tick2.depth.buy[0].price)
            }
        }
    }, [filteredInstruments, feed1Map, feed2Map, originalSymbolsMap])

    return (
        <div className="space-y-4">
            {/* Feed Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CompareFeedStatus
                    feedName="Kite"
                    isConnected={feed1IsConnected}
                    feedUrl="kite.rvinod.com"
                />
                <CompareFeedStatus
                    feedName="Upstox"
                    isConnected={feed2IsConnected}
                    feedUrl="upstox.vinod.app"
                />
            </div>

            {/* Instrument Comparison Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {filteredInstruments.map((normalizedSymbol) => {
                    const originalSymbols = originalSymbolsMap.get(normalizedSymbol)
                    // If normalized symbol has spaces (e.g. "RELIANCE NSE"), use it as display name
                    // Otherwise fall back to original symbol logic
                    const displayName = normalizedSymbol.includes(' ')
                        ? normalizedSymbol
                        : getDisplayName(originalSymbols?.feed1, originalSymbols?.feed2)

                    return (
                        <CompareInstrumentCard
                            key={normalizedSymbol}
                            symbol={displayName}
                            tick1={feed1Map.get(normalizedSymbol)}
                            tick2={feed2Map.get(normalizedSymbol)}
                        />
                    )
                })}

                {filteredInstruments.length === 0 && (
                    <div className="col-span-1 xl:col-span-2 text-center text-gray-500 py-8">
                        {instruments.length > 0
                            ? "No matching instruments found (showing only: CRUDEOIL, SENSEX, NIFTY, RELIANCE, USDINR)"
                            : "Waiting for data..."}
                    </div>
                )}
            </div>
        </div>
    )
}
