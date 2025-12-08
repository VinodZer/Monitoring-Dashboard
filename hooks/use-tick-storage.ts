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

        try {
            // Send batch to PocketBase
            // PocketBase doesn't support bulk create natively in one API call unless using custom route or batch endpoint
            // But standard SDK 'create' is one by one. 
            // HOWEVER, concurrent requests are fine.

            const promises = batch.map(tick => {
                return pb.collection('ticks').create({
                    instrument_token: tick.instrument_token,
                    last_price: tick.last_price,
                    volume: tick.volume || 0,
                    timestamp: new Date(tick.timestamp),
                    raw_data: tick
                }, { requestKey: null }) // requestKey: null prevents auto-cancellation of concurrent requests
            })

            await Promise.allSettled(promises)
            console.log(`[PocketBase] Flushed ${batch.length} ticks to DB`)

        } catch (error) {
            console.error("[PocketBase] Error flushing ticks:", error)
        }
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
