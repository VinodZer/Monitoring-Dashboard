/**
 * Calculate the price difference between two prices
 * @param price1 - First price
 * @param price2 - Second price
 * @returns Price difference (price1 - price2), or 0 if either price is invalid
 */
export function calculatePriceDiff(price1: number, price2: number): number {
    if (!price1 || !price2) return 0
    return price1 - price2
}

/**
 * Calculate the spread percentage between two prices
 * Formula: (|diff| / average) * 100
 * @param price1 - First price
 * @param price2 - Second price
 * @returns Spread percentage, or 0 if either price is invalid
 */
export function calculateSpreadPercentage(price1: number, price2: number): number {
    if (!price1 || !price2) return 0
    const diff = Math.abs(price1 - price2)
    const average = (price1 + price2) / 2
    return (diff / average) * 100
}

/**
 * Format a price value for display
 * @param price - Price to format
 * @returns Formatted price string with 2 decimal places
 */
export function formatPrice(price: number): string {
    return new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(price)
}

/**
 * Comparison data for two prices
 */
export interface PriceComparison {
    price1: number
    price2: number
    diff: number
    spread: number
}

/**
 * Calculate all comparison metrics for two prices
 * @param price1 - First price
 * @param price2 - Second price
 * @returns Object containing prices, difference, and spread
 */
export function comparePrices(price1: number, price2: number): PriceComparison {
    return {
        price1,
        price2,
        diff: calculatePriceDiff(price1, price2),
        spread: calculateSpreadPercentage(price1, price2),
    }
}
