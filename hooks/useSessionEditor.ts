"use client"

import { supabase } from "@/lib/supabase"
import { Payment } from "@/types"

export function useSessionEditor(
  sessionId: string,
  payments: Payment[],
  onChangeReload: () => Promise<void>
) {
  // Check if item is locked (paid by anyone)
  const isItemLocked = (itemId: string): boolean => {
    return payments.some((p) => p.paid_item_ids?.includes(itemId))
  }

  // Add new item
const addItem = async (name: string, price: number, quantity: number = 1) => {
  if (!name.trim()) throw new Error("Item name required")
  if (price < 0) throw new Error("Price cannot be negative")
  if (quantity < 1) throw new Error("Quantity must be at least 1")

  const { error } = await supabase.from("items").insert({
    session_id: sessionId,
    name: name.trim(),
    price,
    quantity,
  })

  if (error) throw error
  await onChangeReload()
}

  // Update item
  const updateItem = async (itemId: string, name: string, price: number, quantity: number = 1) => {
  if (isItemLocked(itemId)) {
    throw new Error("Cannot edit — item already paid by someone")
  }
  if (!name.trim()) throw new Error("Item name required")
  if (price < 0) throw new Error("Price cannot be negative")
  if (quantity < 1) throw new Error("Quantity must be at least 1")

  const { error } = await supabase
    .from("items")
    .update({ name: name.trim(), price, quantity })
    .eq("id", itemId)

  if (error) throw error
  await onChangeReload()
}

  // Delete item
  const deleteItem = async (itemId: string) => {
    if (isItemLocked(itemId)) {
      throw new Error("Cannot delete — item already paid by someone")
    }

    const { error } = await supabase.from("items").delete().eq("id", itemId)

    if (error) throw error
    await onChangeReload()
  }

  // Check if participant can be deleted
  const canDeleteParticipant = (
    participantId: string,
    allAssignments: any[]
  ): boolean => {
    const hasTicks = allAssignments.some(
      (a) => a.participant_id === participantId && a.status !== "rejected"
    )
    const hasPayment = payments.some((p) => p.participant_id === participantId)
    return !hasTicks && !hasPayment
  }

  // Add new participant
  const addParticipant = async (name: string) => {
    if (!name.trim()) throw new Error("Name required")

    const { error } = await supabase.from("participants").insert({
      session_id: sessionId,
      name: name.trim(),
      is_owner: false,
    })

    if (error) {
      if (error.code === "23505") {
        throw new Error("Name already exists in the list")
      }
      throw error
    }
    await onChangeReload()
  }

  // Delete participant
  const deleteParticipant = async (participantId: string) => {
    const { error } = await supabase
      .from("participants")
      .delete()
      .eq("id", participantId)

    if (error) throw error
    await onChangeReload()
  }

  return {
    isItemLocked,
    addItem,
    updateItem,
    deleteItem,
    canDeleteParticipant,
    addParticipant,
    deleteParticipant,
  }
}