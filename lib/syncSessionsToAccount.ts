import { supabase } from "@/lib/supabase"
import { getStoredSessions } from "@/lib/sessionHistory"
import { addUserSession } from "@/lib/userSessionsApi"

export type SyncResult = {
  newlySynced: number
  alreadySynced: number
  failed: number
  errors: string[]
}

export async function syncSessionsToAccount(userId: string): Promise<SyncResult> {
  const stored = getStoredSessions()

  if (stored.length === 0) {
    return { newlySynced: 0, alreadySynced: 0, failed: 0, errors: [] }
  }

  // Single query: which sessions are already linked to this user
  const { data: existingLinks } = await supabase
    .from("user_sessions")
    .select("session_id")
    .eq("user_id", userId)

  const linkedIds = new Set(existingLinks?.map((r) => r.session_id) ?? [])

  const alreadySynced = stored.filter((s) => linkedIds.has(s.sessionId)).length
  const toSync = stored.filter((s) => !linkedIds.has(s.sessionId))

  if (toSync.length === 0) {
    return { newlySynced: 0, alreadySynced, failed: 0, errors: [] }
  }

  // Batch check: which sessions still exist in DB (avoids FK errors)
  const { data: validSessions } = await supabase
    .from("sessions")
    .select("id")
    .in("id", toSync.map((s) => s.sessionId))

  const validIds = new Set(validSessions?.map((s) => s.id) ?? [])

  let newlySynced = 0
  let failed = 0
  const errors: string[] = []

  for (const session of toSync) {
    if (!validIds.has(session.sessionId)) {
      // Session deleted from DB — skip silently
      continue
    }

    const { error } = await addUserSession({
      userId,
      sessionId: session.sessionId,
      participantId: session.participantId,
      role: session.role,
      joinedAt: session.joinedAt,
    })

    if (error) {
      failed++
      errors.push(`${session.sessionName}: ${error.message}`)
    } else {
      newlySynced++
    }
  }

  return { newlySynced, alreadySynced, failed, errors }
}
