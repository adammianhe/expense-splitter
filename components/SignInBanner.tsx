"use client"

import { useState, useEffect } from "react"
import { Save, X } from "lucide-react"
import { motion } from "framer-motion"

const DISMISS_KEY = "splitto:sign_in_banner_dismissed"
const DISMISS_DURATION_DAYS = 7

type Props = {
  onSignInClick: () => void
}

export default function SignInBanner({ onSignInClick }: Props) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY)
    if (stored) {
      const dismissedAt = new Date(stored)
      const daysSince = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince < DISMISS_DURATION_DAYS) {
        return
      }
    }
    setDismissed(false)
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString())
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 mt-6"
    >
      <Save size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-blue-900 font-medium">Sessions saved on this device only</p>
        <p className="text-xs text-blue-700 mt-1 mb-3">Sign in to sync across devices.</p>
        <div className="flex gap-3">
          <button
            onClick={onSignInClick}
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            Sign in to sync
          </button>
          <button
            onClick={handleDismiss}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Dismiss
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="text-blue-400 hover:text-blue-600 flex-shrink-0"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </motion.div>
  )
}
