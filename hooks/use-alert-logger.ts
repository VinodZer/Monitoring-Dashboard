"use client"

import { useCallback } from "react"
import pb from "@/lib/pocketbase"
import type { InactivityAlert } from "./use-inactivity-alerts"

/**
 * Hook to persist inactivity alerts to PocketBase
 */
export function useAlertLogger() {
    const logAlert = useCallback(async (alert: InactivityAlert) => {
        try {
            const message = `LTP: ₹${alert.ltpAtTrigger.toFixed(2)}`

            const usedSeconds = alert.missingSeconds ?? alert.duration

            const payload = {
                alert_id: alert.id,
                instrument_token: alert.instrumentToken,
                instrument_name: alert.instrumentName,
                alert_type: alert.alertType,
                message,
                duration: usedSeconds,
                missing_seconds: alert.missingSeconds || 0,
                market_session: alert.marketSession,
                raw_data: JSON.stringify({
                    exchange: alert.exchange,
                    baselinePrice: alert.baselinePrice,
                    currentPrice: alert.currentPrice,
                    priceRange: alert.priceRange,
                    ltpAtTrigger: alert.ltpAtTrigger,
                    timestamp: alert.timestamp,
                }),
            }

            await pb.collection("alert_logs").create(payload)
            // console.log("[AlertLogger] Logged alert to DB:", alert.instrumentName)
        } catch (err) {
            console.error("[AlertLogger] Failed to log alert:", err)
        }
    }, [])

    return { logAlert }
}
