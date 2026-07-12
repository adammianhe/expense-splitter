"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/useToast"
import { supabase } from "@/lib/supabase"
import { syncSessionsToAccount } from "@/lib/syncSessionsToAccount"
import { addUserSession } from "@/lib/userSessionsApi"
import { addStoredSession } from "@/lib/sessionHistory"
import { getRetryQueue, removeFromRetryQueue } from "@/lib/syncRetryQueue"
import ToastContainer from "@/components/ui/ToastContainer"

async function backfillLocalStorage(userId: string) {
  const { data } = await supabase
    .from("user_sessions")
    .select("session_id, participant_id, role, joined_at, sessions(name)")
    .eq("user_id", userId)

  if (!data) return

  for (const us of data as any[]) {
    addStoredSession({
      sessionId: us.session_id,
      participantId: us.participant_id,
      role: us.role,
      sessionName: us.sessions?.name || "Session",
      joinedAt: us.joined_at,
    })
  }
}

async function processRetryQueue(userId: string) {
  const retryQueue = getRetryQueue()
  for (const pending of retryQueue) {
    try {
      const result = await addUserSession({
        userId,
        sessionId: pending.sessionId,
        participantId: pending.participantId,
        role: pending.role,
        joinedAt: pending.joinedAt,
      })
      if (!result.error) {
        removeFromRetryQueue(pending.sessionId)
      }
    } catch {
      // leave in queue for next retry
    }
  }
}

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

    showToast("Syncing your sessions...", "info")

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
        return backfillLocalStorage(user.id)
      })
      .catch((err) => {
        console.error("Sync failed:", err)
      })
      .finally(() => {
        processRetryQueue(user.id).catch((err) => {
          console.error("Retry queue processing failed:", err)
        })
      })
  }, [user, showToast])

  return <ToastContainer toasts={toasts} onDismiss={dismissToast} />
}
