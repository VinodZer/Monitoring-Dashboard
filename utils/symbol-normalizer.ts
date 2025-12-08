/**
 * Normalize symbol names for cross-feed comparison
 * Handles different naming conventions between Kite and Upstox
 */

/**
 * Normalize exchange name
 * e.g. NSE_EQ -> NSE, BSE_EQ -> BSE
 */
export function normalizeExchange(exchange?: string): string {
    if (!exchange) return ''
    const upper = exchange.toUpperCase()

    if (upper.startsWith('NSE')) return 'NSE'
    if (upper.startsWith('BSE')) return 'BSE'
    if (upper.startsWith('NFO')) return 'NFO'
    if (upper.startsWith('MCX')) return 'MCX'
    if (upper.startsWith('CDS')) return 'CDS'
    if (upper.startsWith('BCD')) return 'BCD'

    return upper
}

export function normalizeSymbol(symbol: string, exchange?: string): string {
    if (!symbol) return ''

    let normalized = symbol.toUpperCase().trim()
    const normExchange = normalizeExchange(exchange)

    // 1. Remove "FUT" keyword variations
    // Remove " FUT" (preceded by space)
    normalized = normalized.replace(/\s+FUT\b/g, '')
    // Remove "FUT" at the end
    normalized = normalized.replace(/FUT$/g, '')
    // Remove "FUTIDX"
    normalized = normalized.replace(/FUTIDX/g, '')

    // 2. Remove all spaces
    normalized = normalized.replace(/\s+/g, '')

    // 3. Normalize Date Formats
    // Convert "DDMMMYY" (e.g., 18DEC25) to "YYMMM" (e.g., 25DEC)
    // Regex looks for: 1 or 2 digits (Day), 3 letters (Month), 2 digits (Year)
    const dateMatch = normalized.match(/(\d{1,2})([A-Z]{3})(\d{2})/)
    if (dateMatch) {
        const [, day, month, year] = dateMatch
        // Replace the whole date part with Year + Month (e.g., 25DEC)
        normalized = normalized.replace(dateMatch[0], year + month)
    }

    // 4. Handle specific instrument patterns

    // For RELIANCE (and other equities), append exchange to differentiate NSE vs BSE
    // Only if exchange is available
    if (normalized.includes('RELIANCE')) {
        // If we have an exchange, append it
        if (normExchange) {
            // Return "RELIANCE NSE" or "RELIANCE BSE"
            // We use a space to make it readable, as this is also used for display
            return `RELIANCE ${normExchange}`
        }
        return 'RELIANCE'
    }

    return normalized
}

/**
 * Get display name for a symbol (prefer the longer, more readable version)
 */
export function getDisplayName(symbol1?: string, symbol2?: string): string {
    if (!symbol1 && !symbol2) return ''
    if (!symbol1) return symbol2 || ''
    if (!symbol2) return symbol1

    // Prefer the one with spaces (more readable)
    if (symbol1.includes(' ') && !symbol2.includes(' ')) return symbol1
    if (symbol2.includes(' ') && !symbol1.includes(' ')) return symbol2

    // Otherwise prefer the longer one
    return symbol1.length >= symbol2.length ? symbol1 : symbol2
}
