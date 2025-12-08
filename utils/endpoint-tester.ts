export async function testEndpoint(url: string): Promise<{
  available: boolean
  status?: number
  headers?: Record<string, string>
  error?: string
}> {
  if (url.startsWith("ws://") || url.startsWith("wss://")) {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(url)
        let resolved = false

        const cleanup = () => {
          try {
            ws.close()
          } catch { }
        }

        ws.onopen = () => {
          if (!resolved) {
            resolved = true
            resolve({
              available: true,
              status: 101, // Switching Protocols
            })
            cleanup()
          }
        }

        ws.onerror = (error) => {
          if (!resolved) {
            resolved = true
            resolve({
              available: false,
              error: "WebSocket connection failed",
            })
            cleanup()
          }
        }

        // Timeout
        setTimeout(() => {
          if (!resolved) {
            resolved = true
            resolve({
              available: false,
              error: "Connection timeout",
            })
            cleanup()
          }
        }, 5000)
      } catch (error) {
        resolve({
          available: false,
          error: String(error),
        })
      }
    })
  }

  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TickMonitor/1.0)",
        Accept: "text/event-stream",
      },
    })

    return {
      available: response.ok,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    }
  } catch (error) {
    return {
      available: false,
      error: String(error),
    }
  }
}

export async function findAvailableEndpoints(): Promise<
  Array<{
    url: string
    name: string
    result: Awaited<ReturnType<typeof testEndpoint>>
  }>
> {
  const endpoints = [
    { url: "wss://kite.rvinod.com/ticks?token=Dashboard@Zerodha", name: "WebSocket Feed" },
  ]

  const results = await Promise.all(
    endpoints.map(async (endpoint) => ({
      ...endpoint,
      result: await testEndpoint(endpoint.url),
    })),
  )

  return results
}
