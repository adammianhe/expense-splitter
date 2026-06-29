import { supabase } from "@/lib/supabase"
import { UserSession } from "@/types"

export async function addUserSession(params: {
  userId: string
  sessionId: string
  participantId: string
  role: "owner" | "friend"
  joinedAt?: string
}): Promise<{ data?: UserSession; error?: Error }> {
  const { data, error } = await supabase
    .from("user_sessions")
    .upsert(
      {
        user_id: params.userId,
        session_id: params.sessionId,
        participant_id: params.participantId,
        role: params.role,
        joined_at: params.joinedAt ?? new Date().toISOString(),
      },
      { onConflict: "user_id,session_id", ignoreDuplicates: true }
    )
    .select()
    .single()

  if (error && error.code !== "PGRST116") {
    return { error: new Error(error.message) }
  }
  return { data: data ?? undefined }
}

export async function removeUserSession(params: {
  userId: string
  sessionId: string
}): Promise<{ error?: Error }> {
  const { error } = await supabase
    .from("user_sessions")
    .delete()
    .eq("user_id", params.userId)
    .eq("session_id", params.sessionId)

  if (error) return { error: new Error(error.message) }
  return {}
}

export async function getUserSessions(
  userId: string
): Promise<{ data?: UserSession[]; error?: Error }> {
  const { data, error } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })

  if (error) return { error: new Error(error.message) }
  return { data: data ?? [] }
}

export async function userHasSession(params: {
  userId: string
  sessionId: string
}): Promise<boolean> {
  const { data } = await supabase
    .from("user_sessions")
    .select("id")
    .eq("user_id", params.userId)
    .eq("session_id", params.sessionId)
    .maybeSingle()

  return data !== null
}
