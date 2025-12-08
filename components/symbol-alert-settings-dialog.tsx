"use client"

import { useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { InactivityAlertConfig } from "@/hooks/use-inactivity-alerts"
import { getDefaultDpltpDuration, getExchangeFromName } from "@/utils/exchange-detection"

interface SymbolAlertSettingsDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  config?: InactivityAlertConfig
  onSave: (config: InactivityAlertConfig) => void
  symbolName: string
}

const DEFAULT_CONFIG: InactivityAlertConfig = {
  enabled: true,
  duration: 15,
  dpltpEnabled: false,
  dpltpDuration: 60,
  respectMarketHours: true,
}

// Helper function to check if an instrument is an index
const isIndex = (symbolName: string) => {
  const indicesNames = ["SENSEX", "NIFTY 50", "NIFTY", "NIFTY BANK", "BANKNIFTY", "BANKEX"]
  return indicesNames.includes(symbolName)
}

export function SymbolAlertSettingsDialog({
  isOpen,
  onOpenChange,
  config,
  onSave,
  symbolName,
}: SymbolAlertSettingsDialogProps) {
  const isIndexSymbol = isIndex(symbolName)
  const exchangeCode = getExchangeFromName(symbolName)
  const extendedDurationSegment = exchangeCode === "MCX" || exchangeCode === "CDS"
  const baseDuration = extendedDurationSegment ? 30 : 15
  const baseDpltpDuration = getDefaultDpltpDuration(exchangeCode)

  // Use actual config directly, auto-save on changes
  const defaultConfig = isIndexSymbol
    ? { ...DEFAULT_CONFIG, enabled: true, duration: 15, dpltpEnabled: false, dpltpDuration: 0 }
    : { ...DEFAULT_CONFIG, enabled: false, duration: baseDuration, dpltpEnabled: true, dpltpDuration: baseDpltpDuration }
  const currentConfig = config || defaultConfig
  const effectiveConfig: InactivityAlertConfig = isIndexSymbol
    ? { ...currentConfig, dpltpEnabled: false, dpltpDuration: 0 }
    : currentConfig

  // Auto-save helper function
  const updateConfig = (updates: Partial<InactivityAlertConfig>) => {
    const newConfig = { ...currentConfig, ...updates }
    onSave(newConfig)
  }

  useEffect(() => {
    if (!isOpen || !isIndexSymbol) return
    const enforced: InactivityAlertConfig = {
      ...currentConfig,
      dpltpEnabled: false,
      dpltpDuration: 0,
    }
    if (
      (currentConfig.dpltpEnabled ?? false) !== enforced.dpltpEnabled ||
      (currentConfig.dpltpDuration ?? 0) !== enforced.dpltpDuration
    ) {
      onSave(enforced)
    }
  }, [isOpen, isIndexSymbol])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px] p-5 gap-0 dark:bg-[#1e222d] dark:border-gray-800">
        <DialogHeader className="pb-4 mb-1 border-b border-gray-100 dark:border-gray-800">
          <DialogTitle className="text-base font-semibold text-gray-900 dark:text-gray-100 flex flex-col gap-0.5">
            <span>Alert Settings</span>
            <span className="text-[11px] font-normal text-muted-foreground">{symbolName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-4">
          {/* LTP Alerts */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ltpEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Price Freeze
              </Label>
              <p className="text-[10px] text-muted-foreground">Alert if LTP unchanged</p>
            </div>
            <div className="flex items-center gap-2">
              {effectiveConfig.enabled && (
                <div className="relative">
                  <Input
                    type="number"
                    value={effectiveConfig.duration}
                    onChange={(e) => updateConfig({ duration: Number(e.target.value) })}
                    className="w-14 h-7 text-xs text-right pr-1 px-1"
                    placeholder="15"
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground pointer-events-none hidden">s</span>
                </div>
              )}
              <Switch
                id="ltpEnabled"
                checked={effectiveConfig.enabled}
                onCheckedChange={(checked) => updateConfig({ enabled: checked })}
                className="scale-90"
              />
            </div>
          </div>

          {/* Depth + LTP Alerts (hidden for indices) */}
          {!isIndexSymbol && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="dpltpEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Depth Freeze
                </Label>
                <p className="text-[10px] text-muted-foreground">Alert if Depth & LTP unchanged</p>
              </div>
              <div className="flex items-center gap-2">
                {effectiveConfig.dpltpEnabled && (
                  <Input
                    type="number"
                    value={effectiveConfig.dpltpDuration || baseDpltpDuration}
                    onChange={(e) => updateConfig({ dpltpDuration: Number(e.target.value) })}
                    className="w-14 h-7 text-xs text-right pr-1 px-1"
                    placeholder="60"
                  />
                )}
                <Switch
                  id="dpltpEnabled"
                  checked={effectiveConfig.dpltpEnabled || false}
                  onCheckedChange={(checked) => updateConfig({ dpltpEnabled: checked })}
                  className="scale-90"
                />
              </div>
            </div>
          )}

          {/* Market Hours */}
          <div className="flex items-center justify-between pt-1">
            <div className="space-y-0.5">
              <Label htmlFor="marketHours" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Market Hours
              </Label>
              <p className="text-[10px] text-muted-foreground">Only alert if market is Open</p>
            </div>
            <Switch
              id="marketHours"
              checked={currentConfig.respectMarketHours}
              onCheckedChange={(checked) => updateConfig({ respectMarketHours: checked })}
              className="scale-90"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
