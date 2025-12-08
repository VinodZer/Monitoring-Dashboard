"use client"

import { memo } from "react"
import type { TickData } from "@/hooks/use-tick-data"

interface MarketDepthViewProps {
    depth: NonNullable<TickData["depth"]>
    totalBuyQuantity?: number
    totalSellQuantity?: number
    formatPrice: (price: number) => string
    fixedRows?: number
}

export const MarketDepthView = memo(function MarketDepthView({
    depth,
    totalBuyQuantity,
    totalSellQuantity,
    formatPrice,
    fixedRows,
}: MarketDepthViewProps) {
    const buyLevels = depth.buy || []
    const sellLevels = depth.sell || []
    const maxRows = fixedRows || Math.max(buyLevels.length, sellLevels.length, 5)

    // Calculate total quantities if not provided
    const totalBuyQty =
        totalBuyQuantity ||
        (depth.buy ? depth.buy.reduce((sum, level) => sum + level.quantity, 0) : 0)
    const totalSellQty =
        totalSellQuantity ||
        (depth.sell ? depth.sell.reduce((sum, level) => sum + level.quantity, 0) : 0)
    const totalBuyOrders = buyLevels.reduce((sum, level) => sum + level.orders, 0)
    const totalSellOrders = sellLevels.reduce((sum, level) => sum + level.orders, 0)

    return (
        <div className="text-[13px] sm:text-[14px]">
            {/* Header Row */}
            <div className="grid grid-cols-6 gap-0 mb-2 text-gray-500 dark:text-gray-400 text-[11px] sm:text-[12px]">
                <div className="text-center pb-2">Bids</div>
                <div className="text-center pb-2">Ord</div>
                <div className="text-center pb-2">Qty</div>
                <div className="text-center pb-2">Offer</div>
                <div className="text-center pb-2">Ord</div>
                <div className="text-center pb-2">Qty</div>
            </div>

            {/* Data Rows */}
            <div className="space-y-[1px]">
                {Array.from({ length: maxRows }).map((_, index) => {
                    const buyLevel = buyLevels[index]
                    const sellLevel = sellLevels[index]

                    // Calculate bar widths based on max quantities
                    const maxBuyQty = Math.max(...buyLevels.map((l) => l.quantity), 1)
                    const maxSellQty = Math.max(...sellLevels.map((l) => l.quantity), 1)
                    const buyBarWidth = buyLevel ? (buyLevel.quantity / maxBuyQty) * 100 : 0
                    const sellBarWidth = sellLevel ? (sellLevel.quantity / maxSellQty) * 100 : 0

                    return (
                        <div key={index} className="grid grid-cols-6 gap-0 items-center h-8 text-[11px] relative">
                            {/* Full-width Backgrounds */}
                            {buyLevel && (
                                <div className="absolute inset-y-0 left-0 w-1/2 pointer-events-none overflow-hidden z-0">
                                    <svg className="h-full w-full" preserveAspectRatio="none">
                                        <defs>
                                            <linearGradient id={`buyGradient-${index}`} x1="100%" y1="0%" x2="0%" y2="0%">
                                                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.2)" />
                                                <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
                                            </linearGradient>
                                        </defs>
                                        <rect
                                            x={`${100 - buyBarWidth}%`}
                                            y="0"
                                            width={`${buyBarWidth}%`}
                                            height="100%"
                                            fill={`url(#buyGradient-${index})`}
                                        />
                                    </svg>
                                </div>
                            )}
                            {sellLevel && (
                                <div className="absolute inset-y-0 right-0 w-1/2 pointer-events-none overflow-hidden z-0">
                                    <svg className="h-full w-full" preserveAspectRatio="none">
                                        <defs>
                                            <linearGradient id={`sellGradient-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="rgba(239, 68, 68, 0.2)" />
                                                <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
                                            </linearGradient>
                                        </defs>
                                        <rect
                                            x="0"
                                            y="0"
                                            width={`${sellBarWidth}%`}
                                            height="100%"
                                            fill={`url(#sellGradient-${index})`}
                                        />
                                    </svg>
                                </div>
                            )}

                            {/* Content Cells (Relative z-10) */}
                            {/* Buy Side */}
                            <div className="text-center text-blue-500 dark:text-blue-400 font-medium relative z-10">
                                {buyLevel ? formatPrice(buyLevel.price) : "-"}
                            </div>
                            <div className="text-center text-gray-600 dark:text-gray-400 relative z-10">
                                {buyLevel ? buyLevel.orders : "-"}
                            </div>
                            <div className="text-center text-gray-700 dark:text-gray-300 font-medium relative z-10">
                                {buyLevel ? buyLevel.quantity.toLocaleString() : "-"}
                            </div>

                            {/* Sell Side */}
                            <div className="text-center text-red-500 dark:text-red-400 font-medium relative z-10">
                                {sellLevel ? formatPrice(sellLevel.price) : "-"}
                            </div>
                            <div className="text-center text-gray-600 dark:text-gray-400 relative z-10">
                                {sellLevel ? sellLevel.orders : "-"}
                            </div>
                            <div className="text-center text-gray-700 dark:text-gray-300 font-medium relative z-10">
                                {sellLevel ? sellLevel.quantity.toLocaleString() : "-"}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Totals Row */}
            <div className="grid grid-cols-6 gap-0 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 font-medium text-gray-900 dark:text-gray-100 text-[11px]">
                <div className="text-center">Total</div>
                <div className="text-center">{totalBuyOrders}</div>
                <div className="text-center">{totalBuyQty.toLocaleString()}</div>
                <div className="text-center">Total</div>
                <div className="text-center">{totalSellOrders}</div>
                <div className="text-center">{totalSellQty.toLocaleString()}</div>
            </div>
        </div>
    )
})
