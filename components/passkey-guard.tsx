"use client"

import React, { useState, useEffect } from "react"

interface Props {
  children?: React.ReactNode
  onUnlock?: () => void
}

const PASSKEY = "Zerodha@123"

/**
 * PasskeyGuard is a small client-side component that renders a password input
 * overlay. When the user supplies the correct predefined passkey, the
 * onUnlock callback is invoked. This component intentionally does not
 * persist unlock state and is intended only for light client-side protection.
 *
 * @param props.children - Optional children (unused)
 * @param props.onUnlock - Callback invoked when the passkey is validated
 */
export default function PasskeyGuard({ children, onUnlock }: Props) {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Stateless: parent is responsible for unlocking and persisting state
  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    setError(null)
    if (value === PASSKEY) {
      // Do NOT persist unlock — require passkey on every load
      onUnlock?.()
    } else {
      setError("Invalid passkey")
      setValue("")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="max-w-md w-full bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Enter passkey to access dashboard</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">This page is protected. Enter the predefined passkey to view the dashboard.</p>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            placeholder="Passkey"
            autoFocus
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
            >
              Unlock
            </button>
          </div>
        </form>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Note: This is a client-side only protection. Do not use for sensitive data.
        </div>
      </div>
    </div>
  )
}
