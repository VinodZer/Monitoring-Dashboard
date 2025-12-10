"use client"


import Link from "next/link"
import { useState, useEffect } from "react"
import {
  ActivityIcon,
  Activity,
  TrendingUp,
  Wifi,
  Clock,
  Settings,
  Bell,
  History,
  Sliders,
  Menu,
  X,
  Eye,
  EyeOff,
  GitCompare,
  FileText,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MarketDataGrid } from "@/components/market-data-grid"
import { AlertSettingsTab } from "@/components/alert-settings-tab"
import { useTickData } from "@/hooks/use-tick-data"
import { InactivityAlertsLog } from "@/components/inactivity-alerts-log"
import { useInactivityAlerts } from "@/hooks/use-inactivity-alerts"
import { ThemeToggle } from "@/components/theme-toggle"
import { DebugDashboard } from "@/components/debug-dashboard"
import DashboardGuard from "@/components/dashboard-guard"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { CompareTab } from "@/components/compare-tab"

import { useTickStorage } from "@/hooks/use-tick-storage"
import { useAlertLogger } from "@/hooks/use-alert-logger"

/**
 * MarketDashboard is the main page-level component that composes the live
 * feed hook, inactivity alert hook, and various UI panels to present
 * real-time market monitoring information.
 */
export default function MarketDashboard() {
  const { onTick } = useTickStorage()

  const { logAlert } = useAlertLogger()

  const {
    ticks,
    isConnected,
    isFrozen,
    lastTickTime,
    averageDelay,
    totalTicks,
    freezingIncidents,
    alerts: systemAlerts,
    connectionStatus,
    clearAlerts,
    rawMessages,
    debugInfo,
    addTestTick,
    addDebugInfo,
    nextRetryIn,
  } = useTickData(undefined, { onTick })

  const {
    alerts: inactivityAlerts,
    inactiveSymbols,
    configurations,
    updateConfiguration,
    clearAllAlerts,
    markAlertAsChecked,
  } = useInactivityAlerts(ticks, isConnected, isFrozen, { onAlert: logAlert })

  const [selectedTab, setSelectedTab] = useState("kite")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState("")
  const [mobileTime, setMobileTime] = useState("")
  const [isNavHidden, setIsNavHidden] = useState(false)

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }))
      setMobileTime(
        now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        }),
      )
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  const uniqueInstruments = ticks.reduce(
    (acc, tick) => {
      if (!acc.find((t) => t.instrument_token === tick.instrument_token)) acc.push(tick)
      return acc
    },
    [] as typeof ticks,
  )

  const enabledAlertsCount = Array.from(configurations.values()).filter((c) => c.enabled || c.dpltpEnabled).length

  // Initialize Upstox feed (Feed 2) - connect immediately
  // Disable alerts for this secondary feed to avoid duplicate/conflicting alerts
  const {
    ticks: upstoxTicks,
    isConnected: upstoxIsConnected,
    isFrozen: upstoxIsFrozen,
    lastTickTime: upstoxLastTickTime,
    averageDelay: upstoxAverageDelay,
    totalTicks: upstoxTotalTicks,
    freezingIncidents: upstoxFreezingIncidents,
    alerts: upstoxAlerts,
    connectionStatus: upstoxConnectionStatus,
    clearAlerts: upstoxClearAlerts,
    rawMessages: upstoxRawMessages,
    debugInfo: upstoxDebugInfo,
    addTestTick: upstoxAddTestTick,
    addDebugInfo: upstoxAddDebugInfo,
  } = useTickData("wss://upstox.vinod.app/ticks?token=Dashboard%40Zerodha", { disableAlerts: true, onTick })

  return (
    <>
      <div
        id="dashboard-root"
        className="min-h-screen bg-gray-50 dark:bg-[#1e222d] p-4 sm:p-6 md:pb-4 pb-28 transition-colors relative"
      >
        {!isNavHidden && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#1e222d]/90 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm transition-colors">
            <div className="px-4 sm:px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[rgba(243,61,44,1)] flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path
                        d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"
                        style={{ backgroundColor: "rgba(255, 255, 255, 1)" }}
                      />
                    </svg>
                  </div>
                  <div className="hidden sm:block">
                    <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight transition-colors">
                      Market Ticks Monitor
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed transition-colors">
                      Real-Time Inactivity Alert System
                    </p>
                  </div>
                  <div className="block sm:hidden">
                    <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight transition-colors">
                      Market Monitor
                    </h1>
                  </div>
                </div>

                <div className="hidden lg:flex items-center gap-6">
                  <div className="flex text-xs sm:text-sm flex-row gap-x-3 sm:gap-x-4 items-center">
                    <div className="flex items-center gap-1 bg-sky-50 dark:bg-sky-900/50 px-2 sm:px-2.5 rounded-md py-0.5 transition-colors">
                      <TrendingUp className="w-3 sm:w-4 h-3 sm:h-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Instruments:</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{uniqueInstruments.length}</span>
                    </div>
                    <div className="flex items-center gap-1 bg-green-50 dark:bg-green-900/50 px-2 sm:px-2.5 rounded-md py-0.5 transition-colors">
                      <Wifi className="w-3 sm:w-4 h-3 sm:h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Connection:</span>
                      <div className="flex items-center gap-x-1.5">
                        <span className="text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 font-medium">
                          Kite:
                        </span>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                      </div>
                      <div className="w-px h-3 bg-gray-300 dark:bg-gray-600 mx-1.5" />
                      <div className="flex items-center gap-x-1.5">
                        <span className="text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 font-medium">
                          Upstox:
                        </span>
                        <div className={`w-2 h-2 rounded-full ${upstoxIsConnected ? "bg-green-500" : "bg-red-500"}`} />
                      </div>
                    </div>
                    {!isConnected && (
                      <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/40 px-2 sm:px-2.5 rounded-md py-0.5 transition-colors">
                        <Clock className="w-3 sm:w-4 h-3 sm:h-4 text-red-600 dark:text-red-400" />
                        <span className="text-gray-700 dark:text-gray-300 font-medium text-[10px] sm:text-xs">
                          Retry in {typeof nextRetryIn === "number" ? Math.max(0, nextRetryIn) : 0}s
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 px-2 sm:px-2.5 rounded-md py-0.5 transition-colors">
                      <Bell className="w-3 sm:w-4 h-3 sm:h-4 text-green-600 dark:text-green-400" />
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Alerts:</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{enabledAlertsCount}</span>
                    </div>
                    <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/50 px-2 sm:px-2.5 rounded-md py-0.5 transition-colors">
                      <Activity className="w-3 sm:w-4 h-3 sm:h-4 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Alerting:</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{inactiveSymbols.size}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                        {currentTime}
                      </span>
                      <div
                        className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
                      />
                    </div>

                    <ThemeToggle />
                    <button
                      onClick={() => setIsNavHidden(true)}
                      className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors"
                      title="Hide navigation"
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 lg:hidden">
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                  </div>

                  <ThemeToggle />
                  <button
                    onClick={() => setIsNavHidden(true)}
                    className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors"
                    title="Hide navigation"
                  >
                    <EyeOff className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors"
                    aria-expanded="false"
                  >
                    <span className="sr-only">Open main menu</span>
                    {isMobileMenuOpen ? (
                      <X className="block h-6 w-6" aria-hidden="true" />
                    ) : (
                      <Menu className="block h-6 w-6" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {isMobileMenuOpen && (
                <div className="lg:hidden">
                  <div className="px-2 pt-2 pb-3 space-y-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg mt-2 border border-gray-200/50 dark:border-gray-700/50 shadow-lg transition-colors">
                    <div className="grid grid-cols-2 gap-2 p-2 text-xs sm:text-sm">
                      <div className="flex items-center gap-1 bg-sky-50 dark:bg-sky-900/50 px-2 rounded py-1 transition-colors">
                        <TrendingUp className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 font-medium">
                          Instruments:
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-[10px] sm:text-xs">
                          {uniqueInstruments.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 px-2 rounded py-1 transition-colors">
                        <Bell className="w-3 h-3 text-green-600 dark:text-green-400" />
                        <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 font-medium">
                          Alerts:
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-[10px] sm:text-xs">
                          {enabledAlertsCount}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/50 px-2 rounded py-1 transition-colors">
                        <Activity className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                        <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 font-medium">
                          Alerting:
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-[10px] sm:text-xs">
                          {inactiveSymbols.size}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-green-50 dark:bg-green-900/50 px-2 rounded py-1 transition-colors">
                        <Clock className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                        <span className="text-[10px] sm:text-xs font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                          {mobileTime}
                        </span>
                      </div>
                    </div>

                    <div className="px-2 py-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Navigation
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setSelectedTab("kite")
                            setIsMobileMenuOpen(false)
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${selectedTab === "kite"
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                            }`}
                        >
                          <ActivityIcon className="w-4 h-4" />
                          Kite
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTab("compare")
                            setIsMobileMenuOpen(false)
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${selectedTab === "compare"
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                            }`}
                        >
                          <GitCompare className="w-4 h-4" />
                          Compare
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTab("alert-settings")
                            setIsMobileMenuOpen(false)
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${selectedTab === "alert-settings"
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                            }`}
                        >
                          <Sliders className="w-4 h-4" />
                          Settings
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTab("inactivity-log")
                            setIsMobileMenuOpen(false)
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${selectedTab === "inactivity-log"
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                            }`}
                        >
                          <History className="w-4 h-4" />
                          Log
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTab("debug")
                            setIsMobileMenuOpen(false)
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${selectedTab === "debug"
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                            }`}
                        >
                          <Settings className="w-4 h-4" />
                          Debug
                        </button>
                      </div>
                    </div>

                    <div className="px-2 py-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Connection Status
                      </div>
                      <div className="flex flex-col gap-1 text-[10px] sm:text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-900 dark:text-gray-100">Kite:</span>
                            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                            <span className={isConnected ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                              {isConnected ? "Connected" : "Disconnected"}
                            </span>
                          </div>
                          {!isConnected && (
                            <span className="text-red-600 dark:text-red-400">
                              Retry in {typeof nextRetryIn === "number" ? Math.max(0, nextRetryIn) : 0}s
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-900 dark:text-gray-100">Upstox:</span>
                          <div className={`w-2 h-2 rounded-full ${upstoxIsConnected ? "bg-green-500" : "bg-red-500"}`} />
                          <span className={upstoxIsConnected ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                            {upstoxIsConnected ? "Connected" : "Disconnected"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isNavHidden && (
          <button
            onClick={() => setIsNavHidden(false)}
            className="fixed top-4 right-4 z-50 p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
            title="Show navigation"
          >
            <Eye className="w-5 h-5" />
          </button>
        )}

        <div className={`space-y-4 sm:space-y-6 ${isNavHidden ? "" : "pt-16 sm:pt-[52px]"}`}>
          <div className="flex items-center justify-between">
            <div />
          </div>

          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
            {!isNavHidden && (
              <TabsList className="hidden md:flex bg-white dark:bg-gray-900 border dark:border-gray-800 text-sm">
                <TabsTrigger value="kite" className="flex items-center gap-1.5 text-xs sm:text-sm font-medium">
                  <ActivityIcon className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  Kite
                  {uniqueInstruments.length > 0 && (
                    <span
                      style={{
                        backgroundColor: "rgb(209, 250, 229)",
                        borderRadius: "9999px",
                        color: "rgb(21, 128, 61)",
                        fontSize: "10px",
                        fontWeight: "600",
                        height: "20px",
                        marginLeft: "8px",
                        width: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingTop: "2px",
                      }}
                    >
                      {uniqueInstruments.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="compare" className="flex items-center gap-1.5 text-xs sm:text-sm font-medium">
                  <GitCompare className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  Compare
                </TabsTrigger>
                <TabsTrigger
                  value="alert-settings"
                  className="flex items-center gap-1.5 text-xs sm:text-sm font-medium"
                >
                  <Sliders className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  Alert Settings
                  {enabledAlertsCount > 0 && (
                    <span
                      style={{
                        backgroundColor: "rgb(220, 252, 231)",
                        borderRadius: "9999px",
                        color: "rgb(22, 163, 74)",
                        fontSize: "10px",
                        fontWeight: "600",
                        height: "20px",
                        marginLeft: "8px",
                        width: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingTop: "2px",
                      }}
                    >
                      {enabledAlertsCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="inactivity-log"
                  className="flex items-center gap-1.5 text-xs sm:text-sm font-medium"
                >
                  <History className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  Alert Log
                  {inactivityAlerts.length > 0 && (
                    <span className="ml-1 sm:ml-2 flex h-4 sm:h-5 w-4 sm:w-5 items-center justify-center rounded-full bg-red-100 text-[10px] font-semibold text-red-600">
                      {inactivityAlerts.length}
                    </span>
                  )}
                </TabsTrigger>


                <TabsTrigger value="debug" className="flex items-center gap-1.5 text-xs sm:text-sm font-medium">
                  <Settings className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  Debug
                </TabsTrigger>

              </TabsList>
            )}

            <TabsContent value="kite">
              <MarketDataGrid
                ticks={ticks}
                inactiveSymbols={inactiveSymbols}
                alertConfigurations={configurations}
                onConfigurationChange={updateConfiguration}
                onMarkAlertAsChecked={(instrumentToken: number) => {
                  const alertsForInstrument = inactivityAlerts.filter(
                    (alert) => alert.instrumentToken === instrumentToken && !alert.checked,
                  )
                  if (alertsForInstrument.length > 0) {
                    const mostRecentAlert = alertsForInstrument.sort((a, b) => b.timestamp - a.timestamp)[0]
                    markAlertAsChecked(mostRecentAlert.id)
                  }
                }}
              />
            </TabsContent>

            <TabsContent value="compare">
              <CompareTab
                feed1Ticks={ticks}
                feed1IsConnected={isConnected}
                feed2Ticks={upstoxTicks}
                feed2IsConnected={upstoxIsConnected}
              />
            </TabsContent>

            <TabsContent value="alert-settings">
              <AlertSettingsTab
                ticks={ticks}
                alertConfigurations={configurations}
                onConfigurationChange={updateConfiguration}
                inactiveSymbols={inactiveSymbols}
              />
            </TabsContent>

            <TabsContent value="inactivity-log">
              <InactivityAlertsLog
                alerts={inactivityAlerts}
                onClearAlerts={clearAllAlerts}
                onMarkAlertAsChecked={markAlertAsChecked}
                ticks={ticks}
              />
            </TabsContent>



            <TabsContent value="debug">
              <DebugDashboard
                kiteData={{
                  name: "Kite",
                  url: "wss://kite.rvinod.com/ticks",
                  ticks,
                  isConnected,
                  isFrozen,
                  lastTickTime,
                  averageDelay,
                  totalTicks,
                  freezingIncidents,
                  alerts: systemAlerts,
                  connectionStatus,
                  clearAlerts,
                  rawMessages,
                  debugInfo,
                  addTestTick,
                  addDebugInfo,
                }}
                upstoxData={{
                  name: "Upstox",
                  url: "wss://upstox.vinod.app/ticks",
                  ticks: upstoxTicks,
                  isConnected: upstoxIsConnected,
                  isFrozen: upstoxIsFrozen,
                  lastTickTime: upstoxLastTickTime,
                  averageDelay: upstoxAverageDelay,
                  totalTicks: upstoxTotalTicks,
                  freezingIncidents: upstoxFreezingIncidents,
                  alerts: upstoxAlerts,
                  connectionStatus: upstoxConnectionStatus,
                  clearAlerts: upstoxClearAlerts,
                  rawMessages: upstoxRawMessages,
                  debugInfo: upstoxDebugInfo,
                  addTestTick: upstoxAddTestTick,
                  addDebugInfo: upstoxAddDebugInfo,
                }}
              />
            </TabsContent>


          </Tabs>
        </div>
      </div>

      <MobileBottomNav
        selectedTab={selectedTab}
        onTabChange={setSelectedTab}
        instrumentCount={uniqueInstruments.length}
        alertCount={enabledAlertsCount}
        alertingCount={inactiveSymbols.size}
        isConnected={isConnected}
        connectionStatus={connectionStatus}
        nextRetryIn={nextRetryIn}
      />

      <DashboardGuard targetId="dashboard-root" />
    </>
  )
}
