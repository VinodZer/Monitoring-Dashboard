"use client"

import { useCallback } from "react"
import type { InactivityAlert } from "./use-inactivity-alerts"

const STORAGE_KEY = 'local_alert_logs'
const MAX_LOGS = 200

/**
 * Hook to persist inactivity alerts to localStorage
 */
export function useAlertLogger() {
    const logAlert = useCallback(async (alert: InactivityAlert) => {
        try {
            const message = `LTP: ₹${alert.ltpAtTrigger.toFixed(2)}`
            const usedSeconds = alert.missingSeconds ?? alert.duration

            const newItem = {
                id: alert.id,
                created: new Date().toISOString(),
                instrument_token: alert.instrumentToken,
                instrument_name: alert.instrumentName,
                alert_type: alert.alertType,
                message,
                duration: usedSeconds,
                missing_seconds: alert.missingSeconds || 0,
                market_session: alert.marketSession,
                raw_data: {
                    exchange: alert.exchange,
                    baselinePrice: alert.baselinePrice,
                    currentPrice: alert.currentPrice,
                    priceRange: alert.priceRange,
                    ltpAtTrigger: alert.ltpAtTrigger,
                    timestamp: alert.timestamp,
                },
            }

            // Read existing logs safely
            let existingLogs = []
            try {
                const stored = localStorage.getItem(STORAGE_KEY)
                existingLogs = stored ? JSON.parse(stored) : []
            } catch (e) {
                console.error("Failed to parse existing logs", e)
            }

            // Prepend new item
            const updatedLogs = [newItem, ...existingLogs].slice(0, MAX_LOGS)

            // Save back
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs))

            // Dispatch storage event so other tabs/components sync immediately if listening
            window.dispatchEvent(new Event("storage"))

        } catch (err) {
            console.error("[AlertLogger] Failed to log alert locally:", err)
        }
    }, [])

    return { logAlert }
}
