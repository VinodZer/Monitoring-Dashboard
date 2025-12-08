"use client"

import { useState, useCallback } from "react"
import {
  ActivityIcon,
  Sliders,
  History,
  Settings,
  Home,
  Menu,
  X,
  GitCompare,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileBottomNavProps {
  selectedTab: string
  onTabChange: (tab: string) => void
  instrumentCount: number
  alertCount: number
  alertingCount: number
  isConnected: boolean
  connectionStatus: string
  nextRetryIn?: number | null
}

export function MobileBottomNav({
  selectedTab,
  onTabChange,
  instrumentCount,
  alertCount,
  alertingCount,
  isConnected,
  connectionStatus,
  nextRetryIn,
}: MobileBottomNavProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  const navItems = [
    {
      id: "kite",
      label: "Home",
      icon: Home,
      badge: instrumentCount > 0 ? instrumentCount : null,
    },
    {
      id: "compare",
      label: "Compare",
      icon: GitCompare,
      badge: null,
    },
    {
      id: "alert-settings",
      label: "Alerts",
      icon: Sliders,
      badge: alertCount > 0 ? alertCount : null,
    },
    {
      id: "inactivity-log",
      label: "Log",
      icon: History,
      badge: alertingCount > 0 ? alertingCount : null,
    },
  ]

  const moreItems = [
    {
      id: "debug",
      label: "Debug",
      icon: Settings,
    },
  ]

  const handleNavClick = useCallback(
    (tabId: string) => {
      onTabChange(tabId)
      setShowMoreMenu(false)
    },
    [onTabChange],
  )

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700/50 shadow-lg">
        <div className="flex items-center justify-between h-20">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = selectedTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  "flex-1 h-20 flex flex-col items-center justify-center gap-1 transition-colors relative",
                  isActive
                    ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100",
                )}
                aria-label={item.label}
              >
                <div className="relative">
                  <Icon className="w-6 h-6" />
                  {item.badge !== null && (
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium leading-none">{item.label}</span>
              </button>
            )
          })}

          <div className="relative flex-1 h-20 flex flex-col items-center justify-center">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="flex flex-col items-center justify-center gap-1 w-full h-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="More options"
            >
              {showMoreMenu ? (
                <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              )}
              <span className="text-xs font-medium leading-none">More</span>
            </button>

            {showMoreMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 min-w-48">
                {moreItems.map((item) => {
                  const Icon = item.icon
                  const isActive = selectedTab === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={cn(
                        "w-full px-4 py-3 flex items-center gap-3 transition-colors text-sm font-medium",
                        isActive
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </button>
                  )
                })}
                <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-2">
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Status</div>
                  <div className="flex items-center gap-2 text-xs">
                    <div
                      className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"
                        }`}
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {isConnected ? "Connected" : "Disconnected"}
                    </span>
                    {!isConnected && nextRetryIn !== null && (
                      <span className="text-gray-500 dark:text-gray-500">
                        ({Math.max(0, nextRetryIn || 0)}s)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
