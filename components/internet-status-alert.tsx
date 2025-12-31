"use client"

import { useState, useEffect } from "react"
import { AlertCircle, WifiOff } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

export function InternetStatusAlert() {
    const [isOnline, setIsOnline] = useState(true)

    useEffect(() => {
        // Only run on client-side
        if (typeof window === "undefined") return

        // Set initial status
        setIsOnline(navigator.onLine)

        // Define event listeners
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        // Add event listeners
        window.addEventListener("online", handleOnline)
        window.addEventListener("offline", handleOffline)

        // Poll every 3 seconds to catch edge cases
        const interval = setInterval(() => {
            if (navigator.onLine !== isOnline) {
                setIsOnline(navigator.onLine)
            }
        }, 3000)

        // Cleanup
        return () => {
            window.removeEventListener("online", handleOnline)
            window.removeEventListener("offline", handleOffline)
            clearInterval(interval)
        }
    }, [isOnline])

    if (isOnline) return null

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] p-4 animate-in slide-in-from-top duration-300 pointer-events-none">
            <div className="pointer-events-auto">
                <Alert variant="destructive" className="max-w-2xl mx-auto shadow-2xl border-2 border-red-600 bg-red-950/95 backdrop-blur-md text-white">
                    <WifiOff className="h-6 w-6 mt-0.5" />
                    <div className="ml-2">
                        <AlertTitle className="text-xl font-bold">Internet Connection Lost</AlertTitle>
                        <AlertDescription className="text-base mt-1 text-red-100">
                            You are currently offline. Market data updates have stopped. Use caution.
                        </AlertDescription>
                    </div>
                </Alert>
            </div>
        </div>
    )
}
