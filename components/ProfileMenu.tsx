"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, LogOut, RefreshCw } from "lucide-react"
import { motion } from "framer-motion"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/useToast"
import { useUserSessions } from "@/hooks/useUserSessions"
import { syncSessionsToAccount } from "@/lib/syncSessionsToAccount"
import ToastContainer from "@/components/ui/ToastContainer"

type Props = {
  onClose: () => void
  onSignedOut: () => void
}

const LAST_SYNCED_KEY = "splitto:last_synced_at"

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function ProfileMenu({ onClose, onSignedOut }: Props) {
  const { user, signOut } = useAuth()
  const { toasts, showToast, dismissToast } = useToast()
  const { userSessions } = useUserSessions()
  const [signingOut, setSigningOut] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  useEffect(() => {
    setLastSyncedAt(localStorage.getItem(LAST_SYNCED_KEY))
  }, [])

  const handleSyncNow = async () => {
    if (!user) return
    setSyncing(true)
    try {
      const result = await syncSessionsToAccount(user.id)
      const now = new Date().toISOString()
      localStorage.setItem(LAST_SYNCED_KEY, now)
      setLastSyncedAt(now)
      if (result.newlySynced > 0) {
        const label = result.newlySynced === 1 ? "session" : "sessions"
        showToast(`Synced ${result.newlySynced} new ${label}`, "success")
      } else {
        showToast("Everything is up to date", "info")
      }
    } catch {
      showToast("Sync failed. Try again.", "error")
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
    onClose()
    onSignedOut()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Profile menu"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* User info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">
                {user?.email?.[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">
                {user?.email}
              </p>
              <p className="text-xs text-gray-400">Signed in</p>
              <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                <Check size={12} className="flex-shrink-0" />
                {userSessions.length} {userSessions.length === 1 ? "session" : "sessions"} synced
                {lastSyncedAt && (
                  <span className="text-gray-400">· {relativeTime(lastSyncedAt)}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition text-2xl leading-none ml-4 flex-shrink-0"
          >
            ×
          </button>
        </div>

        <div className="border-t border-gray-100" />

        <button
          onClick={handleSyncNow}
          disabled={syncing}
          className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={16} className={`text-gray-500 ${syncing ? "animate-spin" : ""}`} />
          <span className="font-medium text-sm text-gray-700">
            {syncing ? "Syncing..." : "Sync Now"}
          </span>
        </button>

        <motion.button
          whileTap={!signingOut ? { scale: 0.94, opacity: 0.85 } : undefined}
          whileHover={!signingOut ? { scale: 1.02 } : undefined}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {signingOut ? (
            <Loader2 size={16} className="animate-spin text-gray-500" />
          ) : (
            <LogOut size={16} className="text-gray-500" />
          )}
          <span className="font-medium text-sm text-gray-700">
            {signingOut ? "Signing out..." : "Sign Out"}
          </span>
        </motion.button>
      </motion.div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </motion.div>
  )
}
