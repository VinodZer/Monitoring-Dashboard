"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface MobileLayoutWrapperProps {
  children: ReactNode
  className?: string
  showPadding?: boolean
}

export function MobileLayoutWrapper({
  children,
  className,
  showPadding = true,
}: MobileLayoutWrapperProps) {
  return (
    <div
      className={cn(
        "w-full",
        "md:max-w-7xl md:mx-auto",
        showPadding && "p-4 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  )
}

interface MobileContentPanelProps {
  children: ReactNode
  className?: string
}

export function MobileContentPanel({ children, className }: MobileContentPanelProps) {
  return (
    <div
      className={cn(
        "w-full",
        "bg-white dark:bg-gray-950",
        "rounded-lg md:rounded-xl",
        "border border-gray-200 dark:border-gray-800",
        "p-4 sm:p-6",
        "shadow-sm hover:shadow-md transition-shadow",
        className,
      )}
    >
      {children}
    </div>
  )
}

interface MobileCardProps {
  children: ReactNode
  className?: string
  interactive?: boolean
  onClick?: () => void
}

export function MobileCard({
  children,
  className,
  interactive = false,
  onClick,
}: MobileCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-gray-900",
        "rounded-lg border border-gray-200 dark:border-gray-800",
        "p-4",
        "transition-all duration-200",
        interactive && "cursor-pointer active:scale-95 hover:shadow-md",
        className,
      )}
    >
      {children}
    </div>
  )
}

interface MobileHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}

export function MobileHeader({
  title,
  subtitle,
  action,
  className,
}: MobileHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4",
        "mb-4 sm:mb-6",
        className,
      )}
    >
      <div className="flex-1 min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

interface MobileGridProps {
  children: ReactNode
  columns?: 1 | 2 | 3 | 4
  gap?: "small" | "medium" | "large"
  className?: string
}

export function MobileGrid({
  children,
  columns = 1,
  gap = "medium",
  className,
}: MobileGridProps) {
  const columnClasses = {
    1: "grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }

  const gapClasses = {
    small: "gap-2 sm:gap-3",
    medium: "gap-4 sm:gap-6",
    large: "gap-6 sm:gap-8",
  }

  return (
    <div
      className={cn(
        "grid",
        columnClasses[columns],
        gapClasses[gap],
        className,
      )}
    >
      {children}
    </div>
  )
}

interface MobileListItemProps {
  children: ReactNode
  className?: string
  interactive?: boolean
  onClick?: () => void
  divider?: boolean
}

export function MobileListItem({
  children,
  className,
  interactive = false,
  onClick,
  divider = true,
}: MobileListItemProps) {
  return (
    <>
      <div
        onClick={onClick}
        className={cn(
          "px-0 py-4 sm:py-3",
          "flex items-center justify-between",
          "transition-all duration-200",
          interactive && "cursor-pointer active:bg-gray-100 dark:active:bg-gray-800",
          className,
        )}
      >
        {children}
      </div>
      {divider && (
        <div className="h-px bg-gray-200 dark:bg-gray-800" />
      )}
    </>
  )
}

export function MobileSection({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("mb-6 sm:mb-8", className)}>
      {children}
    </section>
  )
}
