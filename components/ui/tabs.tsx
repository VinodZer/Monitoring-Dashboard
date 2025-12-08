"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { ChevronRight, ChevronLeft } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Tabs component (Radix primitive re-export)
 */
const Tabs = TabsPrimitive.Root

/**
 * Custom TabsList - Single scrollable row for all tabs on mobile and desktop
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const [scrollPosition, setScrollPosition] = React.useState(0)
  const [maxScroll, setMaxScroll] = React.useState(0)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const container = scrollContainerRef.current
    if (container) {
      const updateScrollInfo = () => {
        setScrollPosition(container.scrollLeft)
        setMaxScroll(container.scrollWidth - container.clientWidth)
      }

      container.addEventListener("scroll", updateScrollInfo)
      updateScrollInfo() // Initial calculation

      const resizeObserver = new ResizeObserver(updateScrollInfo)
      resizeObserver.observe(container)

      return () => {
        container.removeEventListener("scroll", updateScrollInfo)
        resizeObserver.disconnect()
      }
    }
  }, [children])

  return (
    <div className="h-auto w-full">
      {/* Mobile and Desktop - Single scrollable row */}
      <div className="relative flex items-center">
        {/* Left Arrow - only show if scrolled right */}
        {scrollPosition > 0 && (
          <button
            onClick={() => {
              const container = scrollContainerRef.current
              if (container) {
                container.scrollLeft = Math.max(0, container.scrollLeft - 120)
              }
            }}
            className="mr-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0 z-10 sm:hidden"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        <TabsPrimitive.List
          ref={scrollContainerRef}
          className={cn(
            "flex items-center gap-1 overflow-x-auto rounded-md p-1 scroll-smooth bg-white dark:bg-gray-800 flex-1 scrollbar-hide border border-gray-200 dark:border-gray-700 sm:overflow-visible sm:justify-start sm:max-w-fit transition-colors",
            className,
          )}
          style={{
            touchAction: "pan-x",
            WebkitOverflowScrolling: "touch",
          }}
          {...props}
        >
          {children}
        </TabsPrimitive.List>

        {/* Right Arrow - only show if can scroll more */}
        {scrollPosition < maxScroll && (
          <button
            onClick={() => {
              const container = scrollContainerRef.current
              if (container) {
                container.scrollLeft = Math.min(maxScroll, container.scrollLeft + 120)
              }
            }}
            className="ml-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0 z-10 sm:hidden"
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

/**
 * TabsTrigger - unchanged styles except brand colours
 */
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, value, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm font-mono font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
      value === "kite" && "data-[state=active]:bg-[#f33d2c] data-[state=active]:text-white",
      (value === "individual" || value === "bulk") && "data-[state=active]:bg-[#f33d2c] data-[state=active]:text-white",
      (value === "alert-settings" || value === "inactivity-log" || value === "debug" || value === "compare") &&
      "data-[state=active]:bg-black dark:data-[state=active]:bg-gray-100 data-[state=active]:text-white dark:data-[state=active]:text-black",
      className,
    )}
    value={value}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

/**
 * TabsContent - passthrough
 */
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
