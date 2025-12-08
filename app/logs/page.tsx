"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, RefreshCw, AlertTriangle, Calendar, Clock, Activity, Search, Filter } from "lucide-react"
import { format, startOfDay, subDays, startOfYesterday, endOfYesterday } from "date-fns"
import pb from "@/lib/pocketbase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

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

export default function LogsPage() {
    const [logs, setLogs] = useState<AlertLog[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [dateFilter, setDateFilter] = useState<DateFilter>("today")
    const [searchTerm, setSearchTerm] = useState("")

    const fetchLogs = async () => {
        setIsLoading(true)
        setError(null)
        try {
            let filterString = ""
            const now = new Date()

            // Date Filter
            switch (dateFilter) {
                case "today":
                    const todayStart = startOfDay(now).toISOString().replace("T", " ")
                    filterString = `created >= "${todayStart}"`
                    break
                case "yesterday":
                    const yestStart = startOfYesterday().toISOString().replace("T", " ")
                    const yestEnd = endOfYesterday().toISOString().replace("T", " ")
                    filterString = `created >= "${yestStart}" && created <= "${yestEnd}"`
                    break
                case "week":
                    const weekStart = subDays(startOfDay(now), 7).toISOString().replace("T", " ")
                    filterString = `created >= "${weekStart}"`
                    break
                default:
                    filterString = ""
                    break
            }

            // Combine with search if present (Client-side filtering is often smoother for small datasets, 
            // but here we might need server-side if data is huge. For now, sticking to date filter on server)

            const result = await pb.collection("alert_logs").getList<AlertLog>(1, 100, {
                sort: "-created",
                filter: filterString,
                fields: "id,created,instrument_name,alert_type,message,duration,missing_seconds,market_session",
                skipTotal: true,
            })
            setLogs(result.items)
        } catch (err: any) {
            console.error("Failed to fetch logs:", err)
            setError("Failed to load logs. Is PocketBase running?")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchLogs()
    }, [dateFilter])

    const filteredLogs = logs.filter(log =>
        log.instrument_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.message.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-[#0E1217] text-gray-900 dark:text-gray-100 p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="outline" size="icon" className="h-10 w-10 bg-white dark:bg-[#151921] hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-800 shadow-sm rounded-xl">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Alert History</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Full archive of inactivity events
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search logs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 w-[200px] bg-white dark:bg-[#151921] border-gray-200 dark:border-gray-800"
                            />
                        </div>
                        <div className="flex items-center gap-1 bg-white dark:bg-[#151921] p-1 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                            <Tabs value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)} className="w-full md:w-auto">
                                <TabsList className="h-9 bg-transparent p-0 gap-1">
                                    {['today', 'yesterday', 'week', 'all'].map((tab) => (
                                        <TabsTrigger
                                            key={tab}
                                            value={tab}
                                            className="px-4 text-xs font-medium uppercase tracking-wider data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-[#2C3440] data-[state=active]:text-primary rounded-lg transition-all"
                                        >
                                            {tab === 'week' ? '7 Days' : tab === 'yesterday' ? 'Yesterday' : tab}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                            <Button onClick={fetchLogs} variant="ghost" size="icon" className="h-9 w-9 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                                <RefreshCw className={`h-4 w-4 text-gray-500 ${isLoading ? "animate-spin" : ""}`} />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Mobile Search - Visible only on small screens */}
                <div className="md:hidden relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 w-full bg-white dark:bg-[#151921]"
                    />
                </div>

                {/* Content Card */}
                <div className="bg-white dark:bg-[#151921] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden min-h-[500px]">
                    {error ? (
                        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
                            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/10 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="h-8 w-8 text-red-500 opacity-80" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Connection Error</h3>
                            <p className="text-gray-500 max-w-sm mb-6">{error}</p>
                            <Button onClick={fetchLogs} variant="outline">Try Again</Button>
                        </div>
                    ) : (
                        <ScrollArea className="h-[70vh]">
                            <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
                                {isLoading && logs.length === 0 ? (
                                    // Skeleton Loading
                                    Array.from({ length: 8 }).map((_, i) => (
                                        <div key={i} className="px-6 py-5 flex items-center justify-between animate-pulse">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl"></div>
                                                <div className="space-y-2">
                                                    <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded"></div>
                                                    <div className="h-3 w-48 bg-gray-100 dark:bg-gray-800 rounded"></div>
                                                </div>
                                            </div>
                                            <div className="h-4 w-12 bg-gray-100 dark:bg-gray-800 rounded"></div>
                                        </div>
                                    ))
                                ) : filteredLogs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-32 text-center">
                                        <div className="w-20 h-20 bg-gray-50 dark:bg-[#1a1f29] rounded-2xl flex items-center justify-center mb-4">
                                            <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No logs found</h3>
                                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                                            {searchTerm ? 'No alerts match your search.' : `No alerts recorded for ${dateFilter}.`}
                                        </p>
                                    </div>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <div
                                            key={log.id}
                                            className="group px-6 py-4 hover:bg-gray-50 dark:hover:bg-[#1a1f29] transition-all duration-200 border-l-4 border-transparent hover:border-blue-500 dark:hover:border-blue-400"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                {/* Left: Info */}
                                                <div className="flex items-start gap-4">
                                                    <div className={`mt-1 p-2.5 rounded-xl flex items-center justify-center shadow-sm ${log.alert_type === 'dpltp'
                                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                                                        : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                                                        }`}>
                                                        <Activity className="w-5 h-5" />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                                                                {log.instrument_name}
                                                            </span>
                                                            <Badge
                                                                variant="secondary"
                                                                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md ${log.alert_type === 'dpltp'
                                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                                                                    }`}
                                                            >
                                                                {log.alert_type}
                                                            </Badge>
                                                            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-md">
                                                                <Clock className="w-3 h-3" />
                                                                {log.missing_seconds}s
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300 max-w-2xl">
                                                            {log.message}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 font-mono mt-1">
                                                            <span>{format(new Date(log.created), "MMM dd, yyyy")}</span>
                                                            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></span>
                                                            <span>{format(new Date(log.created), "hh:mm:ss a")}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Actions/Visuals */}
                                                <div className="flex items-center gap-4 pl-14 sm:pl-0">
                                                    {/* Additional metrics or actions could go here */}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </div>
        </div>
    )
}
