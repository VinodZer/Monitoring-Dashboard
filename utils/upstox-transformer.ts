import type { MarketDepth, DepthItem } from "@/hooks/use-tick-data"

/**
 * Upstox depth data structure from raw WebSocket message
 */
interface UpstoxBidAskQuote {
    bidQ: string | number
    bidP: number
    askQ: string | number
    askP: number
}

/**
 * Extract market level from Upstox data
 * Path: fullFeed.marketFF.marketLevel
 */
function extractMarketLevel(data: any): { bidAskQuote?: UpstoxBidAskQuote[] } | undefined {
    // Try fullFeed.marketFF.marketLevel (standard Upstox path)
    if (data?.fullFeed?.marketFF?.marketLevel) {
        return data.fullFeed.marketFF.marketLevel
    }

    // Try direct marketFF.marketLevel
    if (data?.marketFF?.marketLevel) {
        return data.marketFF.marketLevel
    }

    // Try direct marketLevel
    if (data?.marketLevel) {
        return data.marketLevel
    }

    return undefined
}

/**
 * Transform Upstox bid/ask quote format to Kite-style depth format
 * 
 * Kite format:
 * - depth.buy: sorted descending by price (highest bid first)
 * - depth.sell: sorted ascending by price (lowest ask first)
 * - Limited to top 5 levels
 * - Each entry: { quantity: number, price: number, orders: number }
 * 
 * Upstox format:
 * - bidAskQuote: array of {bidQ, bidP, askQ, askP}
 * - Quantities may be strings
 */
export function transformUpstoxDepth(data: any): MarketDepth | undefined {
    const marketLevel = extractMarketLevel(data)

    if (!marketLevel?.bidAskQuote || marketLevel.bidAskQuote.length === 0) {
        return undefined
    }

    const buy: DepthItem[] = []
    const sell: DepthItem[] = []

    // Extract bid/ask from paired entries
    marketLevel.bidAskQuote.forEach((level) => {
        // Process buy level (bid)
        if (level.bidP !== undefined && level.bidQ !== undefined) {
            const quantity = typeof level.bidQ === 'string' ? parseInt(level.bidQ, 10) : Number(level.bidQ)
            if (!isNaN(quantity) && quantity > 0) {
                buy.push({
                    price: Number(level.bidP),
                    quantity: quantity,
                    orders: 1, // Upstox doesn't provide order count
                })
            }
        }

        // Process sell level (ask)
        if (level.askP !== undefined && level.askQ !== undefined) {
            const quantity = typeof level.askQ === 'string' ? parseInt(level.askQ, 10) : Number(level.askQ)
            if (!isNaN(quantity) && quantity > 0) {
                sell.push({
                    price: Number(level.askP),
                    quantity: quantity,
                    orders: 1, // Upstox doesn't provide order count
                })
            }
        }
    })

    // Sort and limit to Kite standard (top 5 levels)
    // Buy: descending order (highest bid first)
    buy.sort((a, b) => b.price - a.price)
    const sortedBuy = buy.slice(0, 5)

    // Sell: ascending order (lowest ask first)
    sell.sort((a, b) => a.price - b.price)
    const sortedSell = sell.slice(0, 5)

    return sortedBuy.length > 0 || sortedSell.length > 0
        ? { buy: sortedBuy, sell: sortedSell }
        : undefined
}

/**
 * Check if data appears to be in Upstox format
 */
export function isUpstoxFormat(data: any): boolean {
    return !!data?.fullFeed?.marketFF || !!data?.marketFF
}

/**
 * Extract total buy and sell quantities from Upstox format
 * Path: fullFeed.marketFF.tbq/tsq
 */
export function extractUpstoxTotals(data: any): { totalBuyQuantity?: number; totalSellQuantity?: number } {
    // Try fullFeed.marketFF path first
    let marketFF = data?.fullFeed?.marketFF
    if (!marketFF) {
        marketFF = data?.marketFF
    }

    if (!marketFF) return {}

    return {
        totalBuyQuantity: Number(marketFF.tbq || marketFF.TBQ || 0),
        totalSellQuantity: Number(marketFF.tsq || marketFF.TSQ || 0),
    }
}
