"use client"

import { useEffect } from "react"

export default function GlobalErrorGuard() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      try {
        e.preventDefault()
      } catch (err) {
        // ignore
      }
      console.warn("Suppressed window error:", e.message)
    }

    const onRejection = (e: PromiseRejectionEvent) => {
      try {
        e.preventDefault()
      } catch (err) {
        // ignore
      }
      console.warn("Suppressed unhandled rejection:", e.reason)
    }

    // In development preview environments FullStory fetches may fail and cause noisy errors.
    // Intercept fetch calls to FullStory hosts in non-production to avoid breaking dev hot-reload.
    const isProd = process.env.NODE_ENV === "production"
    const originalFetch = (window as any).fetch
    const fetchStub = (input: RequestInfo, init?: RequestInit) => {
      try {
        const url = typeof input === "string" ? input : (input as Request)?.url
        if (url && /fullstory\.com/.test(url) && !isProd) {
          return Promise.resolve(new Response(null, { status: 204 }))
        }
      } catch (err) {
        // fallthrough to original fetch
      }
      return originalFetch.call(window, input, init)
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)

    if (!isProd && typeof originalFetch === "function") {
      ;(window as any).fetch = fetchStub
    }

    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
      if (!isProd && typeof originalFetch === "function") {
        ;(window as any).fetch = originalFetch
      }
    }
  }, [])

  return null
}
