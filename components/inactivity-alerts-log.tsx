"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  History,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Clock,
  Activity,
  ArrowUpRight,
} from "lucide-react"
import { format, startOfDay, subDays, startOfYesterday, endOfYesterday } from "date-fns"
import pb from "@/lib/pocketbase"
import type { InactivityAlert } from "@/hooks/use-inactivity-alerts"

interface InactivityAlertsLogProps {
  alerts: InactivityAlert[] // Kept for interface compatibility
  onClearAlerts: () => void
  onMarkAlertAsChecked: (alertId: string) => void
}

interface AlertLog {
  id: string
  created: string
  instrument_name: string
  alert_type: "ltp" | "dpltp"
  message: string
  duration: number
  missing_seconds: number
  market_session: string
}

type DateFilter = "today" | "yesterday" | "week" | "all"

export function InactivityAlertsLog({ }: InactivityAlertsLogProps) {
  const [logs, setLogs] = useState<AlertLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dateFilter, setDateFilter] = useState<DateFilter>("today")
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = async () => {
    setIsLoading(true)
    setError(null)
    try {
      let filter = ""
      const now = new Date()

      switch (dateFilter) {
        case "today":
          const todayStart = startOfDay(now).toISOString().replace("T", " ")
          filter = `created >= "${todayStart}"`
          break
        case "yesterday":
          const yestStart = startOfYesterday().toISOString().replace("T", " ")
          const yestEnd = endOfYesterday().toISOString().replace("T", " ")
          filter = `created >= "${yestStart}" && created <= "${yestEnd}"`
          break
        case "week":
          const weekStart = subDays(startOfDay(now), 7).toISOString().replace("T", " ")
          filter = `created >= "${weekStart}"`
          break
        case "all":
        default:
          filter = ""
          break
      }

      const result = await pb.collection("alert_logs").getList<AlertLog>(1, 50, {
        sort: "-created",
        filter: filter,
        fields: "id,created,instrument_name,alert_type,message,duration,missing_seconds,market_session",
      })
      setLogs(result.items)
    } catch (err: any) {
      console.error("Failed to fetch logs:", err)
      setError("Failed to load logs.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [dateFilter])

  return (
    <Card className="w-full max-w-full bg-white dark:bg-[#0E1217] border-gray-200 dark:border-gray-800 shadow-sm">
      <CardHeader className="pb-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
              <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Alert History
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {dateFilter === 'today' ? "Today's Activity" :
                  dateFilter === 'yesterday' ? "Yesterday's Activity" :
                    dateFilter === 'week' ? "Past 7 Days" : "All Time Records"}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#1a1f29] p-1 rounded-lg self-start sm:self-auto">
            <Tabs value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)} className="w-[320px]">
              <TabsList className="grid w-full grid-cols-4 h-8 bg-transparent p-0 gap-1">
                {['today', 'yesterday', 'week', 'all'].map((tab) => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="text-[10px] h-full uppercase tracking-wider font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-[#2C3440] data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm rounded-md transition-all duration-200"
                  >
                    {tab === 'week' ? '7 Days' : tab === 'yesterday' ? 'Yest' : tab}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button
              onClick={fetchLogs}
              variant="ghost"
              size="icon"
              className="h-8 w-8 ml-1 hover:bg-white dark:hover:bg-[#2C3440] text-gray-500 dark:text-gray-400 rounded-md transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {error ? (
          <div className="p-12 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/10 mb-2">
              <AlertTriangle className="h-6 w-6 text-red-500 opacity-80" />
            </div>
            <p className="font-medium text-sm text-red-600 dark:text-red-400">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchLogs} className="h-8 text-xs">Retry Connection</Button>
          </div>
        ) : logs.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">No logs found</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Everything looks quiet for {dateFilter}.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[60vh] sm:h-[500px]">
            <div className="divide-y divide-gray-100 dark:divide-gray-800/30">
              {isLoading && logs.length === 0 ? (
                // Skeleton
                [1, 2, 3, 4].map(i => (
                  <div key={i} className="px-5 py-4 flex items-center justify-between animate-pulse">
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded"></div>
                      <div className="h-3 w-48 bg-gray-100 dark:bg-gray-800 rounded"></div>
                    </div>
                    <div className="h-8 w-16 bg-gray-100 dark:bg-gray-800 rounded"></div>
                  </div>
                ))
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="group relative px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-[#151921] transition-all duration-200 border-l-2 border-transparent hover:border-blue-500 dark:hover:border-blue-400"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left Side: Icon & Info */}
                      <div className="flex items-start gap-4">
                        {/* Status Icon */}
                        <div className={`mt-1 min-w-[32px] h-8 rounded-lg flex items-center justify-center ${log.alert_type === 'dpltp'
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                          }`}>
                          <Activity className="w-4 h-4" />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                              {log.instrument_name}
                            </span>
                            <Badge
                              variant="secondary"
                              className={`h-5 text-[10px] font-mono uppercase tracking-wider px-1.5 ${log.alert_type === 'dpltp'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                                }`}
                            >
                              {log.alert_type}
                            </Badge>
                          </div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 line-clamp-1">
                            {log.message}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                            <span>{format(new Date(log.created), "MMM dd, HH:mm:ss")}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {log.missing_seconds}s
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Action/Time */}
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-600">
                          {format(new Date(log.created), "hh:mm a")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
