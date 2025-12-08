"use client"

import * as React from "react"
import { useMediaQuery } from "@/hooks/use-mobile"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  BottomSheetContent,
} from "@/components/ui/bottom-sheet"

interface ResponsiveDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  trigger?: React.ReactNode
}

interface ResponsiveDialogContentProps {
  children: React.ReactNode
  title?: string
  description?: string
  className?: string
}

interface ResponsiveDialogHeaderProps {
  children?: React.ReactNode
  title?: string
  description?: string
}

interface ResponsiveDialogFooterProps {
  children: React.ReactNode
}

interface ResponsiveDialogTitleProps {
  children: React.ReactNode
  className?: string
}

interface ResponsiveDialogDescriptionProps {
  children: React.ReactNode
  className?: string
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  children,
  trigger,
}: ResponsiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      {children}
    </Dialog>
  )
}

export const ResponsiveDialogTrigger = Dialog["__root"] ? undefined : null

export function ResponsiveDialogContent({
  children,
  title,
  description,
  className,
}: ResponsiveDialogContentProps) {
  const isMobile = useMediaQuery("(max-width: 768px)")

  if (isMobile) {
    return (
      <BottomSheetContent className={className}>
        {title && <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>}
        {description && <ResponsiveDialogDescription>{description}</ResponsiveDialogDescription>}
        <div className="mt-4">{children}</div>
      </BottomSheetContent>
    )
  }

  return (
    <DialogContent className={className}>
      {title && <DialogHeader>{title}</DialogHeader>}
      {description && <p>{description}</p>}
      <div>{children}</div>
    </DialogContent>
  )
}

export function ResponsiveDialogHeader({
  children,
  title,
  description,
}: ResponsiveDialogHeaderProps) {
  return (
    <DialogHeader>
      {title && <DialogTitle>{title}</DialogTitle>}
      {description && <DialogDescription>{description}</DialogDescription>}
      {children}
    </DialogHeader>
  )
}

export function ResponsiveDialogTitle({
  children,
  className,
}: ResponsiveDialogTitleProps) {
  return <DialogTitle className={className}>{children}</DialogTitle>
}

export function ResponsiveDialogDescription({
  children,
  className,
}: ResponsiveDialogDescriptionProps) {
  return <DialogDescription className={className}>{children}</DialogDescription>
}

export function ResponsiveDialogFooter({
  children,
}: ResponsiveDialogFooterProps) {
  return <DialogFooter>{children}</DialogFooter>
}
