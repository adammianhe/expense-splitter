"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export function useItemAssignments(sessionId: string, participantId: string | null) {
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [allAssignments, setAllAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Load all assignments for this session (so we can show shared dishes later)
  const loadAssignments = async () => {
    // Get all assignments for items in this session
    const { data, error } = await supabase
      .from("item_assignments")
      .select("*, items!inner(session_id)")
      .eq("items.session_id", sessionId)

    if (!error && data) {
      setAllAssignments(data)

      // Filter for current user
      if (participantId) {
        const myTicked = data
          .filter(
            (row: any) =>
              row.participant_id === participantId && row.status !== "rejected"
          )
          .map((row: any) => row.item_id)
        setTicked(new Set(myTicked))
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAssignments()

    // Real-time subscription for assignments
    const channel = supabase
      .channel(`assignments-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "item_assignments",
        },
        () => loadAssignments()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, participantId])

  // Toggle an item (add or remove)
  const toggleItem = async (itemId: string) => {
    if (!participantId) return

    const isCurrentlyTicked = ticked.has(itemId)

    // Optimistic UI update
    const newTicked = new Set(ticked)
    if (isCurrentlyTicked) {
      newTicked.delete(itemId)
    } else {
      newTicked.add(itemId)
    }
    setTicked(newTicked)

    if (isCurrentlyTicked) {
      const { error } = await supabase
        .from("item_assignments")
        .delete()
        .eq("item_id", itemId)
        .eq("participant_id", participantId)

      if (error) {
        const reverted = new Set(newTicked)
        reverted.add(itemId)
        setTicked(reverted)
        alert("Error: " + error.message)
      }
    } else {
      const { error } = await supabase.from("item_assignments").insert({
        item_id: itemId,
        participant_id: participantId,
        assigned_by_participant_id: participantId,
        status: "confirmed",
      })

      if (error) {
        const reverted = new Set(newTicked)
        reverted.delete(itemId)
        setTicked(reverted)
        alert("Error: " + error.message)
      }
    }
  }

  return { ticked, allAssignments, loading, toggleItem }
}