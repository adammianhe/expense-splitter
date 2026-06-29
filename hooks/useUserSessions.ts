"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { UserSession } from "@/types"

export function useUserSessions() {
  const { user, isSignedIn } = useAuth()
  const [userSessions, setUserSessions] = useState<UserSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetch = async (userId: string) => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })

    if (error) {
      setError(new Error(error.message))
    } else {
      setUserSessions(data ?? [])
    }
    setLoading(false)
  }

  const subscribe = (userId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    channelRef.current = supabase
      .channel(`user_sessions:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_sessions",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetch(userId)
        }
      )
      .subscribe()
  }

  useEffect(() => {
    if (!isSignedIn || !user) {
      setUserSessions([])
      setLoading(false)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      return
    }

    fetch(user.id)
    subscribe(user.id)

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [isSignedIn, user?.id])

  const refetch = () => {
    if (user) fetch(user.id)
  }

  return { userSessions, loading, error, refetch }
}
