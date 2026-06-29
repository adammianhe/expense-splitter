"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/useToast"
import { syncSessionsToAccount } from "@/lib/syncSessionsToAccount"
import ToastContainer from "@/components/ui/ToastContainer"

export default function SyncManager() {
  const { user } = useAuth()
  const { toasts, showToast, dismissToast } = useToast()
  const lastSyncedUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user) {
      lastSyncedUserIdRef.current = null
      return
    }

    // Already synced for this user in this session (handles re-renders + page focus)
    if (lastSyncedUserIdRef.current === user.id) return
    lastSyncedUserIdRef.current = user.id

    syncSessionsToAccount(user.id)
      .then((result) => {
        if (result.newlySynced > 0) {
          const label = result.newlySynced === 1 ? "session" : "sessions"
          showToast(`Synced ${result.newlySynced} ${label} to your account`, "success")
        }
        if (result.failed > 0) {
          const label = result.failed === 1 ? "session" : "sessions"
          showToast(`${result.failed} ${label} couldn't sync. Still saved locally.`, "warning")
          console.error("Sync errors:", result.errors)
        }
      })
      .catch((err) => {
        console.error("Sync failed:", err)
      })
  }, [user, showToast])

  return <ToastContainer toasts={toasts} onDismiss={dismissToast} />
}
