import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MarketDepthView } from "@/components/market-depth-view"
import type { TickData } from "@/hooks/use-tick-data"
import { comparePrices, formatPrice } from "@/utils/price-comparison"

interface CompareInstrumentCardProps {
    /** Trading symbol of the instrument */
    symbol: string
    /** Tick data from feed 1 (may be undefined if not available) */
    tick1?: TickData
    /** Tick data from feed 2 (may be undefined if not available) */
    tick2?: TickData
}

/**
 * Component that displays a comparison card for a single instrument
 * Shows prices from both feeds, the difference, spread percentage, and side-by-side market depth
 */
export function CompareInstrumentCard({ symbol, tick1, tick2 }: CompareInstrumentCardProps) {
    const price1 = tick1?.last_price || 0
    const price2 = tick2?.last_price || 0
    const { diff, spread } = comparePrices(price1, price2)

    const getPriceColor = (price: number, avgPrice: number) => {
        if (!price || !avgPrice) return "text-gray-900 dark:text-gray-100"
        return price >= avgPrice ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"
    }

    return (
        <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800 bg-white dark:bg-gray-900">
            <CardHeader className="py-2 px-3 border-b border-gray-50 dark:border-gray-800">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-center mb-1">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight truncate text-center">{symbol}</h2>
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-center">
                        {/* Left: Kite Price */}
                        <div className="text-center">
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#f6461a" }}>KITE</div>
                            <div className={`text-lg font-bold font-mono ${getPriceColor(price1, tick1?.average_price || 0)}`}>
                                {price1 ? formatPrice(price1) : "-"}
                            </div>
                        </div>

                        {/* Center: Difference */}
                        <div className="text-center">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">DIFF</div>
                            <div className={`text-lg font-bold font-mono ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-900 dark:text-gray-100"}`}>
                                {diff !== 0 ? diff.toFixed(2) : "0.00"}
                            </div>
                        </div>

                        {/* Right: Upstox Price */}
                        <div className="text-center">
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#5c288c" }}>UPSTOX</div>
                            <div className={`text-lg font-bold font-mono ${getPriceColor(price2, tick2?.average_price || 0)}`}>
                                {price2 ? formatPrice(price2) : "-"}
                            </div>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-3 bg-white dark:bg-gray-950">
                <div className="grid grid-cols-2 gap-3">
                    {/* Kite Depth Section */}
                    <div
                        className="p-2 rounded-lg border"
                        style={{
                            backgroundColor: "rgba(246, 70, 26, 0.05)",
                            borderColor: "rgba(246, 70, 26, 0.2)"
                        }}
                    >
                        <div className="text-[10px] font-bold mb-2 text-center uppercase tracking-wide" style={{ color: "#f6461a" }}>KITE DEPTH</div>
                        {tick1?.depth ? (
                            <MarketDepthView
                                depth={tick1.depth}
                                totalBuyQuantity={tick1.total_buy_quantity}
                                totalSellQuantity={tick1.total_sell_quantity}
                                formatPrice={formatPrice}
                                fixedRows={5}
                            />
                        ) : (
                            <div className="h-[150px] flex items-center justify-center text-gray-400 text-xs">
                                Waiting...
                            </div>
                        )}
                    </div>

                    {/* Upstox Depth Section */}
                    <div
                        className="p-2 rounded-lg border"
                        style={{
                            backgroundColor: "rgba(92, 40, 140, 0.05)",
                            borderColor: "rgba(92, 40, 140, 0.2)"
                        }}
                    >
                        <div className="text-[10px] font-bold mb-2 text-center uppercase tracking-wide" style={{ color: "#5c288c" }}>UPSTOX DEPTH</div>
                        {tick2?.depth ? (
                            <MarketDepthView
                                depth={tick2.depth}
                                totalBuyQuantity={tick2.total_buy_quantity}
                                totalSellQuantity={tick2.total_sell_quantity}
                                formatPrice={formatPrice}
                                fixedRows={5}
                            />
                        ) : (
                            <div className="h-[150px] flex items-center justify-center text-gray-400 text-xs">
                                Waiting...
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
