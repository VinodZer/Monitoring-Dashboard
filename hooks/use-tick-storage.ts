import { useCallback, useRef, useEffect } from "react"
import pb from "@/lib/pocketbase"
import { TickData } from "./use-tick-data"

const BATCH_SIZE = 50
const BATCH_INTERVAL_MS = 5000

export function useTickStorage() {
    const bufferRef = useRef<TickData[]>([])
    const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const flush = useCallback(async () => {
        if (bufferRef.current.length === 0) return

        const batch = [...bufferRef.current]
        bufferRef.current = [] // Clear buffer immediately

        console.log(`[TickStorage] Flushing ${batch.length} ticks sequentially...`)

        // SEQUENTIAL WRITE: Process one by one to avoid 503 (Too Many Requests)
        let successCount = 0
        for (const tick of batch) {
            try {
                await pb.collection('ticks').create({
                    instrument_token: tick.instrument_token,
                    last_price: tick.last_price,
                    volume: tick.volume || 0,
                    timestamp: new Date(tick.timestamp),
                    raw_data: tick
                }, { requestKey: null })
                successCount++
            } catch (err) {
                console.warn("[TickStorage] Failed to save individual tick:", err)
            }
        }

        console.log(`[TickStorage] Successfully saved ${successCount}/${batch.length} ticks.`)
    }, [])

    const onTick = useCallback((newTicks: TickData[]) => {
        // Add new ticks to buffer
        bufferRef.current.push(...newTicks)

        // Flush if buffer is too big
        if (bufferRef.current.length >= BATCH_SIZE) {
            if (flushTimeoutRef.current) {
                clearTimeout(flushTimeoutRef.current)
                flushTimeoutRef.current = null
            }
            flush()
        } else {
            // Schedule flush if not already scheduled
            if (!flushTimeoutRef.current) {
                flushTimeoutRef.current = setTimeout(() => {
                    flushTimeoutRef.current = null
                    flush()
                }, BATCH_INTERVAL_MS)
            }
        }
    }, [flush])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (flushTimeoutRef.current) {
                clearTimeout(flushTimeoutRef.current)
            }
        }
    }, [flush])

    return { onTick }
}
