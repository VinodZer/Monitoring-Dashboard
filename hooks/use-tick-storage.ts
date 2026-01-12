import { useCallback } from "react"
import { TickData } from "./use-tick-data"

export function useTickStorage() {
    // Tick storage is disabled for local-only mode as it would overwhelm localStorage
    const onTick = useCallback((newTicks: TickData[]) => {
        // No-op or debug log only
        // if (Math.random() < 0.01) console.log("[TickStorage] Processing ticks (Storage Disabled)", newTicks.length)
    }, [])

    return { onTick }
}
