"use client"

import { useEffect, useState } from "react"
import PasskeyGuard from "./passkey-guard"

interface Props {
  targetId?: string
}

/**
 * DashboardGuard is a client-side wrapper that blurs the target dashboard DOM
 * node and presents the PasskeyGuard overlay until the correct passkey is
 * entered. It does not persist unlock state and requires the passkey on every
 * page load by design.
 *
 * @param props.targetId - DOM id of the element to blur while locked (default: "dashboard-root")
 */
export default function DashboardGuard({ targetId = "dashboard-root" }: Props) {
  const [unlocked, setUnlocked] = useState<boolean>(false)

  const applyBlur = (on: boolean) => {
    try {
      const el = document.getElementById(targetId)
      if (!el) return
      if (on) {
        el.classList.add("filter", "blur-sm", "pointer-events-none", "select-none")
      } else {
        el.classList.remove("filter", "blur-sm", "pointer-events-none", "select-none")
        el.style.filter = ""
        el.offsetHeight // Trigger reflow
      }
    } catch {}
  }

  const handleUnlock = () => {
    console.log("[v0] Passkey authenticated, removing blur")
    setUnlocked(true)
    setTimeout(() => {
      applyBlur(false)
      console.log("[v0] Blur removed successfully")
    }, 100)
  }

  useEffect(() => {
    // Always require passkey on page load — show overlay and blur
    setUnlocked(false)
    setTimeout(() => {
      applyBlur(true)
      console.log("[v0] Blur applied on page load")
    }, 50)

    // No storage listeners or persistence
    return () => {
      applyBlur(false)
    }
  }, [])

  if (unlocked) return null

  return <PasskeyGuard onUnlock={handleUnlock} />
}
