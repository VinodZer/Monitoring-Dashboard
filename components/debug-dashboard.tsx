"use client"

import { AlertTriangle, Activity, Clock, Bell, Bug, Play, TestTube, TrendingUp, Wifi } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { TickData, Alert as AlertType } from "@/hooks/use-tick-data"
import { findAvailableEndpoints } from "@/utils/endpoint-tester"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"

export interface FeedDebugData {
  name: string
  url: string
  ticks: TickData[]
  isConnected: boolean
  isFrozen: boolean
  lastTickTime: number | null
  averageDelay: number
  totalTicks: number
  freezingIncidents: number
  alerts: AlertType[]
  connectionStatus: string
  clearAlerts: () => void
  rawMessages: string[]
  debugInfo: string[]
  addTestTick?: (data: string) => void
  addDebugInfo?: (data: string) => void
}

interface DebugDashboardProps {
  kiteData: FeedDebugData
  upstoxData: FeedDebugData
}

function FeedDebugView({ data }: { data: FeedDebugData }) {
  const [endpointResults, setEndpointResults] = useState<any[]>([])

  const handleAddTestTick = () => {
    const testTick = {
      instrument_token: 12345,
      last_price: Math.random() * 1000 + 100,
      volume_traded: Math.floor(Math.random() * 10000),
      average_traded_price: Math.random() * 1000 + 100,
      last_traded_quantity: Math.floor(Math.random() * 100),
      timestamp: new Date().toISOString(),
      tradingsymbol: "TEST",
    }

    if (data.addTestTick) {
      data.addTestTick(JSON.stringify([testTick]))
    }
  }

  const testDirectConnection = async () => {
    try {
      data.addDebugInfo?.("🧪 Testing WebSocket connection...")
      const ws = new WebSocket(data.url)

      ws.onopen = () => {
        data.addDebugInfo?.("📡 WebSocket connection opened")
        ws.close()
      }

      ws.onerror = (error) => {
        data.addDebugInfo?.(`❌ WebSocket error: ${String(error)}`)
      }

      ws.onmessage = (event) => {
        data.addDebugInfo?.(`📦 Message received: ${event.data.substring(0, 50)}...`)
      }

    } catch (error) {
      data.addDebugInfo?.(`❌ Connection error: ${String(error)}`)
    }
  }


  const checkPriceTrends = () => {
    data.addDebugInfo?.("🔍 PRICE TREND ANALYSIS:")

    // Group ticks by instrument
    const instrumentGroups = data.ticks.reduce(
      (acc, tick) => {
        if (!acc[tick.instrument_token]) {
          acc[tick.instrument_token] = []
        }
        acc[tick.instrument_token].push(tick)
        return acc
      },
      {} as Record<number, TickData[]>,
    )

    Object.entries(instrumentGroups).forEach(([token, instrumentTicks]) => {
      const sortedTicks = instrumentTicks.sort((a, b) => a.timestamp - b.timestamp)
      if (sortedTicks.length >= 2) {
        const firstPrice = sortedTicks[0].last_price
        const lastPrice = sortedTicks[sortedTicks.length - 1].last_price
        const change = lastPrice - firstPrice
        const changePercent = (change / firstPrice) * 100

        data.addDebugInfo?.(`Token ${token}: ${JSON.stringify({ tickCount: sortedTicks.length, firstPrice, lastPrice, change: change.toFixed(4), changePercent: changePercent.toFixed(4) + "%", priceHistory: sortedTicks.slice(-5).map((t) => t.last_price) })}`)
      }
    })

    if (data.addDebugInfo) {
      data.addDebugInfo("✅ Price trend analysis completed - check console for details")
    }
  }

  const checkDataAuthenticity = () => {
    data.addDebugInfo?.("🔍 REAL DATA VERIFICATION:")
    data.addDebugInfo?.(`📡 Endpoint: ${data.url}`)
    data.addDebugInfo?.(`📊 Recent raw messages: ${JSON.stringify(data.rawMessages.slice(0, 3))}`)

    const recentTicks = data.ticks.slice(0, 5)
    data.addDebugInfo?.("🎯 Real vs Processed comparison:")

    recentTicks.forEach((tick, i) => {
      try {
        const rawData = JSON.parse(tick.raw_data || "{}")
        data.addDebugInfo?.(`Tick ${i + 1}: ${JSON.stringify({ instrument_token: tick.instrument_token, raw_last_price: rawData.last_price, displayed_last_price: tick.last_price, raw_volume: rawData.volume_traded, displayed_volume: tick.volume, is_authentic: rawData.last_price === tick.last_price, tradingsymbol: tick.tradingsymbol || "Not provided" })}`)
      } catch (e) {
        data.addDebugInfo?.(`Tick ${i + 1}: Error parsing raw data`)
      }
    })

    if (data.addDebugInfo) {
      data.addDebugInfo("✅ Real data verification completed - check console for details")
    }
  }

  const testAllEndpoints = async () => {
    data.addDebugInfo?.("Testing all available endpoints...")
    try {
      const results = await findAvailableEndpoints()
      setEndpointResults(results)
      data.addDebugInfo?.(
        `Endpoint test completed. Found ${results.filter((r) => r.result.available).length} available endpoints`,
      )

      results.forEach((result) => {
        const status = result.result.available ? "✅ Available" : "❌ Unavailable"
        data.addDebugInfo?.(`${result.name}: ${status} (${result.result.status || result.result.error})`)
      })
    } catch (error) {
      data.addDebugInfo?.(`Endpoint testing failed: ${error}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={data.isConnected ? "default" : "destructive"} className="text-sm px-2 py-0.5">
            {data.name}
          </Badge>
          <span className={`text-xs font-mono ${data.isConnected ? "text-green-600" : "text-red-600"}`}>
            {data.isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div className="text-xs text-gray-500 font-mono">{data.url}</div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="bg-gray-50 dark:bg-gray-900/50">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Ticks</div>
            <div className="text-lg font-bold">{data.totalTicks.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 dark:bg-gray-900/50">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Avg Delay</div>
            <div className={`text-lg font-bold ${data.averageDelay > 1000 ? "text-red-600" : "text-green-600"}`}>
              {data.averageDelay.toFixed(0)}ms
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Controls */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleAddTestTick} variant="outline" size="sm" className="h-7 text-xs">
          <Play className="w-3 h-3 mr-1" /> Test Tick
        </Button>
        <Button onClick={testDirectConnection} variant="outline" size="sm" className="h-7 text-xs">
          <Wifi className="w-3 h-3 mr-1" /> Test Conn
        </Button>
        <Button onClick={checkDataAuthenticity} variant="outline" size="sm" className="h-7 text-xs">
          <Bug className="w-3 h-3 mr-1" /> Verify Data
        </Button>
        <Button onClick={checkPriceTrends} variant="outline" size="sm" className="h-7 text-xs">
          <TrendingUp className="w-3 h-3 mr-1" /> Trends
        </Button>
      </div>

      {/* Debug Log */}
      <Card className="h-[300px] flex flex-col">
        <CardHeader className="py-2 px-3 border-b">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <Bug className="w-3 h-3" /> Debug Log
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <div className="h-full overflow-y-auto p-2 space-y-1 font-mono text-[10px] bg-black/5 dark:bg-black/20">
            {data.debugInfo.length > 0 ? (
              data.debugInfo.map((info, i) => (
                <div key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0 pb-0.5">
                  {info}
                </div>
              ))
            ) : (
              <div className="text-muted-foreground italic">No debug info...</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Raw Messages */}
      <Card className="h-[300px] flex flex-col">
        <CardHeader className="py-2 px-3 border-b">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <Activity className="w-3 h-3" /> Raw Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <div className="h-full overflow-y-auto p-2 space-y-1 font-mono text-[10px] bg-black/5 dark:bg-black/20">
            {data.rawMessages.length > 0 ? (
              data.rawMessages.map((msg, i) => (
                <div key={i} className="break-all border-b border-gray-100 dark:border-gray-800 last:border-0 pb-0.5">
                  {msg}
                </div>
              ))
            ) : (
              <div className="text-muted-foreground italic">No messages...</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function DebugDashboard({ kiteData, upstoxData }: DebugDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kite Feed Column */}
        <div className="space-y-4">
          <FeedDebugView data={kiteData} />
        </div>

        {/* Upstox Feed Column */}
        <div className="space-y-4">
          <FeedDebugView data={upstoxData} />
        </div>
      </div>
    </div>
  )
}
