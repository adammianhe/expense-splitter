"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { LoadedSession } from "@/types"

export function useSession(sessionId: string) {
  const [data, setData] = useState<LoadedSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch session, participants, items in parallel
  const loadSession = async () => {
    try {
      const [sessionRes, participantsRes, itemsRes] = await Promise.all([
        supabase.from("sessions").select("*").eq("id", sessionId).single(),
        supabase.from("participants").select("*").eq("session_id", sessionId).order("created_at"),
        supabase.from("items").select("*").eq("session_id", sessionId).order("created_at"),
      ])

      if (sessionRes.error) throw sessionRes.error
      if (participantsRes.error) throw participantsRes.error
      if (itemsRes.error) throw itemsRes.error

      setData({
        session: sessionRes.data,
        participants: participantsRes.data,
        items: itemsRes.data,
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSession()

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        () => loadSession()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        () => loadSession()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
          filter: `session_id=eq.${sessionId}`,
        },
        () => loadSession()
      )
      .subscribe()

    // Cleanup subscription when component unmounts
    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  return { data, loading, error, reload: loadSession }
}