"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export function useItemAssignments(sessionId: string, participantId: string | null) {
  // Map of item_id → quantity claimed by current user
  const [tickedQty, setTickedQty] = useState<Map<string, number>>(new Map())
  const [allAssignments, setAllAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadAssignments = async () => {
    const { data, error } = await supabase
      .from("item_assignments")
      .select("*, items!inner(session_id)")
      .eq("items.session_id", sessionId)

    if (!error && data) {
      setAllAssignments(data)

      if (participantId) {
        const myQty = new Map<string, number>()
        data.forEach((row: any) => {
          if (
            row.participant_id === participantId &&
            row.status !== "rejected"
          ) {
            myQty.set(row.item_id, Number(row.quantity) || 1)
          }
        })
        setTickedQty(myQty)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAssignments()

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

  // Set quantity for an item (0 = remove assignment)
  const setItemQty = async (itemId: string, newQty: number) => {
    if (!participantId) return

    const currentQty = tickedQty.get(itemId) || 0

    if (newQty === currentQty) return // No change

    // Optimistic UI update
    const newMap = new Map(tickedQty)
    if (newQty <= 0) {
      newMap.delete(itemId)
    } else {
      newMap.set(itemId, newQty)
    }
    setTickedQty(newMap)

    if (newQty <= 0) {
      // Delete assignment
      const { error } = await supabase
        .from("item_assignments")
        .delete()
        .eq("item_id", itemId)
        .eq("participant_id", participantId)

      if (error) {
        const reverted = new Map(newMap)
        reverted.set(itemId, currentQty)
        setTickedQty(reverted)
        alert("Error: " + error.message)
      }
    } else if (currentQty === 0) {
      // Create new assignment
      const { error } = await supabase.from("item_assignments").insert({
        item_id: itemId,
        participant_id: participantId,
        assigned_by_participant_id: participantId,
        status: "confirmed",
        quantity: newQty,
      })

      if (error) {
        const reverted = new Map(newMap)
        reverted.delete(itemId)
        setTickedQty(reverted)
        alert("Error: " + error.message)
      }
    } else {
      // Update existing assignment
      const { error } = await supabase
        .from("item_assignments")
        .update({ quantity: newQty })
        .eq("item_id", itemId)
        .eq("participant_id", participantId)

      if (error) {
        const reverted = new Map(newMap)
        reverted.set(itemId, currentQty)
        setTickedQty(reverted)
        alert("Error: " + error.message)
      }
    }
  }

  // Increment by 1
  const incrementItem = async (itemId: string) => {
    const current = tickedQty.get(itemId) || 0
    await setItemQty(itemId, current + 1)
  }

  // Decrement by 1
  const decrementItem = async (itemId: string) => {
    const current = tickedQty.get(itemId) || 0
    if (current <= 0) return
    await setItemQty(itemId, current - 1)
  }

  // Backwards-compat helpers (for code that still uses Set)
  const ticked = new Set(tickedQty.keys())

  return {
    tickedQty,
    ticked,
    allAssignments,
    loading,
    setItemQty,
    incrementItem,
    decrementItem,
  }
}