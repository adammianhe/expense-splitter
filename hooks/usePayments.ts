"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Payment } from "@/types"

export function usePayments(sessionId: string) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  const loadPayments = async () => {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("session_id", sessionId)

    if (!error && data) {
      setPayments(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPayments()

    const channel = supabase
      .channel(`payments-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
          filter: `session_id=eq.${sessionId}`,
        },
        () => loadPayments()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  // Claim payment for specific items
  const claimPayment = async (
  participantId: string,
  amount: number,
  method: "qr" | "cash",
  paidItemIds: string[],
  paidItemQuantities: Record<string, number>,
  paidShareGroupIds: string[]
) => {
  // Check if payment record exists
  const existing = payments.find((p) => p.participant_id === participantId)

  if (existing) {
    // Update existing - merge paid items, quantities, share groups, increase amount
    const newItemIds = Array.from(
      new Set([...(existing.paid_item_ids || []), ...paidItemIds])
    )
    const newQuantities = {
      ...(existing.paid_item_quantities || {}),
      ...paidItemQuantities,
    }
    const newShareGroupIds = Array.from(
      new Set([
        ...(existing.paid_share_group_ids || []),
        ...paidShareGroupIds,
      ])
    )
    const newAmount = Number(existing.amount_paid) + amount

    const { error } = await supabase
      .from("payments")
      .update({
        amount_paid: newAmount,
        method,
        paid_item_ids: newItemIds,
        paid_item_quantities: newQuantities,
        paid_share_group_ids: newShareGroupIds,
        status: "claimed",
      })
      .eq("id", existing.id)

    if (error) throw error
  } else {
    // Create new payment
    const { error } = await supabase.from("payments").insert({
      session_id: sessionId,
      participant_id: participantId,
      amount_paid: amount,
      method,
      paid_item_ids: paidItemIds,
      paid_item_quantities: paidItemQuantities,
      paid_share_group_ids: paidShareGroupIds,
      status: "claimed",
    })

    if (error) throw error
  }

  await loadPayments()
}

  const getPayment = (participantId: string): Payment | null => {
    return payments.find((p) => p.participant_id === participantId) || null
  }

  // Verify a claimed payment (owner action)
  const verifyPayment = async (paymentId: string) => {
    const { error } = await supabase
      .from("payments")
      .update({ status: "verified" })
      .eq("id", paymentId)
    if (error) throw error
  }

  // Unverify a payment (owner caught false claim)
  const unverifyPayment = async (paymentId: string) => {
    const { error } = await supabase
      .from("payments")
      .update({ status: "unverified" })
      .eq("id", paymentId)
    if (error) throw error
  }

  // Mark someone as paid in cash (owner action)
  const markAsCash = async (
  participantId: string,
  amount: number,
  paidItemIds: string[],
  paidItemQuantities: Record<string, number>,
  paidShareGroupIds: string[]
) => {
  const existing = payments.find((p) => p.participant_id === participantId)

  if (existing) {
    const { error } = await supabase
      .from("payments")
      .update({
        amount_paid: amount,
        paid_item_ids: paidItemIds,
        paid_item_quantities: paidItemQuantities,
        paid_share_group_ids: paidShareGroupIds,
        status: "verified",
        method: "cash",
      })
      .eq("id", existing.id)

    if (error) throw error
  } else {
    const { error } = await supabase.from("payments").insert({
      session_id: sessionId,
      participant_id: participantId,
      amount_paid: amount,
      paid_item_ids: paidItemIds,
      paid_item_quantities: paidItemQuantities,
      paid_share_group_ids: paidShareGroupIds,
      status: "verified",
      method: "cash",
    })

    if (error) throw error
  }

  await loadPayments()
}

  

  // Owner confirms their own items - bypasses claim, goes straight to verified
  const ownerConfirmPayment = async (
  participantId: string,
  amount: number,
  paidItemIds: string[],
  paidItemQuantities: Record<string, number>,
  paidShareGroupIds: string[]
) => {
  const existing = payments.find((p) => p.participant_id === participantId)

  if (existing) {
    // Replace owner's data - they confirm whatever's currently ticked
    const { error } = await supabase
      .from("payments")
      .update({
        amount_paid: amount,
        paid_item_ids: paidItemIds,
        paid_item_quantities: paidItemQuantities,
        paid_share_group_ids: paidShareGroupIds,
        status: "verified",
        method: "cash",
      })
      .eq("id", existing.id)

    if (error) throw error
  } else {
    const { error } = await supabase.from("payments").insert({
      session_id: sessionId,
      participant_id: participantId,
      amount_paid: amount,
      paid_item_ids: paidItemIds,
      paid_item_quantities: paidItemQuantities,
      paid_share_group_ids: paidShareGroupIds,
      status: "verified",
      method: "cash",
    })

    if (error) throw error
  }

  await loadPayments()
}

  return {
    payments,
    loading,
    claimPayment,
    getPayment,
    verifyPayment,
    unverifyPayment,
    markAsCash,
    ownerConfirmPayment,
  }
}