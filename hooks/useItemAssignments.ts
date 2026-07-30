"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export function useItemAssignments(sessionId: string, participantId: string | null) {
  // Solo claims map: item_id → quantity (only counts solo rows where share_group_id is null)
  const [soloQty, setSoloQty] = useState<Map<string, number>>(new Map())
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
        const myMap = new Map<string, number>()
        data.forEach((row: any) => {
          if (
            row.participant_id === participantId &&
            row.share_group_id === null &&
            row.status !== "rejected"
          ) {
            myMap.set(row.item_id, Number(row.quantity) || 1)
          }
        })
        setSoloQty(myMap)
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

  // ============================================
  // SOLO CLAIMS
  // ============================================

  // Patches the LOCAL allAssignments array to match a solo qty change. This
  // matters because useSessionBills computes bill totals from
  // `allAssignments`, not `soloQty` — without this, the item's own +/-
  // counter feels instant (soloQty is optimistic) but "Total to pay" lags a
  // full DB round-trip behind, since it was only ever refreshed by the
  // realtime echo from loadAssignments().
  const patchAssignmentsForSolo = (
    prev: any[],
    itemId: string,
    newQty: number
  ): any[] => {
    const idx = prev.findIndex(
      (a) =>
        a.item_id === itemId &&
        a.participant_id === participantId &&
        a.share_group_id === null
    )
    if (newQty <= 0) {
      if (idx === -1) return prev
      const next = [...prev]
      next.splice(idx, 1)
      return next
    }
    if (idx === -1) {
      return [
        ...prev,
        {
          id: `optimistic-${itemId}-${participantId}`,
          item_id: itemId,
          participant_id: participantId,
          assigned_by_participant_id: participantId,
          status: "confirmed",
          quantity: newQty,
          share_group_id: null,
        },
      ]
    }
    const next = [...prev]
    next[idx] = { ...next[idx], quantity: newQty }
    return next
  }

  const setSoloItemQty = async (itemId: string, newQty: number) => {
    if (!participantId) return

    const currentQty = soloQty.get(itemId) || 0
    if (newQty === currentQty) return

    // Optimistic UI — both soloQty (item counter) and allAssignments (bill
    // totals) update immediately; the realtime echo will reconcile them
    // with the real row once the write lands.
    const newMap = new Map(soloQty)
    if (newQty <= 0) newMap.delete(itemId)
    else newMap.set(itemId, newQty)
    setSoloQty(newMap)

    const previousAssignments = allAssignments
    setAllAssignments((prev) => patchAssignmentsForSolo(prev, itemId, newQty))

    if (newQty <= 0) {
      // Delete solo assignment (only the solo row, not share rows)
      const { error } = await supabase
        .from("item_assignments")
        .delete()
        .eq("item_id", itemId)
        .eq("participant_id", participantId)
        .is("share_group_id", null)

      if (error) {
        const reverted = new Map(newMap)
        reverted.set(itemId, currentQty)
        setSoloQty(reverted)
        setAllAssignments(previousAssignments)
        alert("Error: " + error.message)
      }
    } else if (currentQty === 0) {
      // Create new solo assignment
      const { error } = await supabase.from("item_assignments").insert({
        item_id: itemId,
        participant_id: participantId,
        assigned_by_participant_id: participantId,
        status: "confirmed",
        quantity: newQty,
        share_group_id: null,
      })

      if (error) {
        const reverted = new Map(newMap)
        reverted.delete(itemId)
        setSoloQty(reverted)
        setAllAssignments(previousAssignments)
        alert("Error: " + error.message)
      }
    } else {
      // Update existing solo assignment
      const { error } = await supabase
        .from("item_assignments")
        .update({ quantity: newQty })
        .eq("item_id", itemId)
        .eq("participant_id", participantId)
        .is("share_group_id", null)

      if (error) {
        const reverted = new Map(newMap)
        reverted.set(itemId, currentQty)
        setSoloQty(reverted)
        setAllAssignments(previousAssignments)
        alert("Error: " + error.message)
      }
    }
  }

  const incrementSolo = async (itemId: string) => {
    const current = soloQty.get(itemId) || 0
    await setSoloItemQty(itemId, current + 1)
  }

  const decrementSolo = async (itemId: string) => {
    const current = soloQty.get(itemId) || 0
    if (current <= 0) return
    await setSoloItemQty(itemId, current - 1)
  }

  // ============================================
  // SHARE GROUPS
  // ============================================

  // Create a new share - initiator + tagged people
  // Initiator is auto-confirmed, others are pending
  const createShare = async (
    itemId: string,
    quantity: number,
    taggedParticipantIds: string[]
  ) => {
    if (!participantId) return
    if (taggedParticipantIds.length === 0) {
      throw new Error("Tag at least one person")
    }
    if (quantity < 1) {
      throw new Error("Quantity must be at least 1")
    }

    // Generate share_group_id client-side using crypto
    const shareGroupId = crypto.randomUUID()

    // Build rows: initiator (confirmed) + tagged (pending)
    const rows = [
      {
        item_id: itemId,
        participant_id: participantId,
        assigned_by_participant_id: participantId,
        status: "confirmed" as const,
        quantity,
        share_group_id: shareGroupId,
      },
      ...taggedParticipantIds.map((pid) => ({
        item_id: itemId,
        participant_id: pid,
        assigned_by_participant_id: participantId,
        status: "pending" as const,
        quantity,
        share_group_id: shareGroupId,
      })),
    ]

    const { error } = await supabase.from("item_assignments").insert(rows)
    if (error) throw error
  }

  // Confirm participation in a share
  const confirmShare = async (shareGroupId: string) => {
    if (!participantId) return

    const { error } = await supabase
      .from("item_assignments")
      .update({ status: "confirmed" })
      .eq("share_group_id", shareGroupId)
      .eq("participant_id", participantId)

    if (error) throw error
  }

  // Reject participation in a share
  const rejectShare = async (shareGroupId: string) => {
    if (!participantId) return

    const { error } = await supabase
      .from("item_assignments")
      .update({ status: "rejected" })
      .eq("share_group_id", shareGroupId)
      .eq("participant_id", participantId)

    if (error) throw error
  }

  // Remove an entire share group (only initiator can do this)
  const removeShare = async (shareGroupId: string) => {
    const { error } = await supabase
      .from("item_assignments")
      .delete()
      .eq("share_group_id", shareGroupId)

    if (error) throw error
  }

  // Re-tag someone in an existing share (replace a rejected member)
  // For now, simplest: just delete the rejected row, add a new pending row
  const addShareMember = async (shareGroupId: string, newParticipantId: string) => {
    if (!participantId) return

    // Get the share's item and quantity
    const existing = allAssignments.find(
      (a) => a.share_group_id === shareGroupId && a.participant_id === participantId
    )
    if (!existing) throw new Error("Share not found")

    const { error } = await supabase.from("item_assignments").insert({
      item_id: existing.item_id,
      participant_id: newParticipantId,
      assigned_by_participant_id: participantId,
      status: "pending",
      quantity: existing.quantity,
      share_group_id: shareGroupId,
    })

    if (error) throw error
  }

  return {
    soloQty,
    allAssignments,
    loading,
    incrementSolo,
    decrementSolo,
    createShare,
    confirmShare,
    rejectShare,
    removeShare,
    addShareMember,
  }
}