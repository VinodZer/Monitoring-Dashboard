"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar as CalendarIcon, Search, Download, Loader2, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react"
import type { TickData } from "@/hooks/use-tick-data"

// Helper to format date for input
const formatDateForInput = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0')
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    const hours = pad(date.getHours())
    const minutes = pad(date.getMinutes())
    return `${year}-${month}-${day}T${hours}:${minutes}`
}

interface HistoricalDataViewerProps {
    // Optional: pass list of known instruments to populate dropdown
    knownInstruments?: { token: number; name: string }[]
}

export function HistoricalDataViewer({ knownInstruments = [] }: HistoricalDataViewerProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [debugInfo, setDebugInfo] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [ticks, setTicks] = useState<any[]>([])

    // Filters
    // Default to last 1 hour
    const [startTime, setStartTime] = useState(formatDateForInput(new Date(Date.now() - 60 * 60 * 1000)))
    const [endTime, setEndTime] = useState(formatDateForInput(new Date()))
    const [selectedToken, setSelectedToken] = useState<string>("all")
    const [limit, setLimit] = useState("100")

    // Pagination
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalItems, setTotalItems] = useState(0)

    const fetchData = async (newPage = 1) => {
        setIsLoading(false)
        setTicks([])
        setError("Historical data storage is disabled in local mode.")
    }

    const handleSearch = () => {
        setPage(1)
        fetchData(1)
    }

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            fetchData(newPage)
        }
    }

    return (
        <Card className="w-full h-full border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0 pb-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-lg font-medium">Historical Market Data</CardTitle>
                        <CardDescription>Query and analyze past market ticks stored in the database.</CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-0 space-y-4">
                {error && (
                    <div className="px-4">
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>
                                {error}
                            </AlertDescription>
                        </Alert>
                    </div>
                )}
                {/* Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-white dark:bg-[#1e222d] rounded-lg border border-gray-200 dark:border-gray-700/50">

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Instrument</label>
                        <Select value={selectedToken} onValueChange={setSelectedToken}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="All Instruments" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Instruments</SelectItem>
                                {knownInstruments.map((inst) => (
                                    <SelectItem key={inst.token} value={inst.token.toString()}>
                                        {inst.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">From</label>
                        <Input
                            type="datetime-local"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="h-9"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">To</label>
                        <Input
                            type="datetime-local"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="h-9"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">Limit</label>
                        <Select value={limit} onValueChange={setLimit}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="100" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="50">50 records</SelectItem>
                                <SelectItem value="100">100 records</SelectItem>
                                <SelectItem value="500">500 records</SelectItem>
                                <SelectItem value="1000">1000 records</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-end">
                        <Button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                            Fetch Data
                        </Button>
                    </div>
                </div>

                {/* Results Table */}
                <div className="rounded-md border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-[#1e222d] overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                                <TableRow>
                                    <TableHead className="w-[180px]">Timestamp</TableHead>
                                    <TableHead>Instrument</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="text-right">Volume</TableHead>
                                    <TableHead className="text-right">Delay (ms)</TableHead>
                                    <TableHead className="w-[100px]">ID</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ticks.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                                            {isLoading ? "Loading..." : "No data found matching criteria."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    ticks.map((tick) => {
                                        // Try to find name in known instruments, or just show token
                                        const instName = knownInstruments.find(i => i.token.toString() === tick.instrument_token.toString())?.name
                                            || tick.instrument_token

                                        // Extract raw data fields if available, otherwise use top level
                                        const delay = tick.raw_data?.delay || tick.delay || 0

                                        return (
                                            <TableRow key={tick.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                <TableCell className="font-mono text-xs">
                                                    {new Date(tick.timestamp).toLocaleString("en-IN")}
                                                </TableCell>
                                                <TableCell className="font-medium text-sm">
                                                    {instName}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    ₹{tick.last_price.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs text-gray-500">
                                                    {tick.volume?.toLocaleString() || 0}
                                                </TableCell>
                                                <TableCell className={`text-right font-mono text-xs ${delay > 1000 ? 'text-red-500' : 'text-gray-500'}`}>
                                                    {delay}ms
                                                </TableCell>
                                                <TableCell className="font-mono text-[10px] text-gray-400">
                                                    {tick.id.substring(0, 8)}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination Controls */}
                    {totalItems > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/30">
                            <div className="text-xs text-gray-500">
                                Showing {(page - 1) * parseInt(limit) + 1} to {Math.min(page * parseInt(limit), totalItems)} of {totalItems} results
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handlePageChange(page - 1)}
                                    disabled={page <= 1 || isLoading}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="text-xs font-medium px-2">
                                    Page {page} of {totalPages}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handlePageChange(page + 1)}
                                    disabled={page >= totalPages || isLoading}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Debug Info Panel */}
                {debugInfo && (
                    <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono overflow-auto max-h-40">
                        <div className="font-bold mb-2">Debug Info:</div>
                        <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
