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

  // Claim a payment round for specific items. Each round is its own row —
  // verify/unverify then act on that one round, not a cumulative total.
  // `amount`/`paidItemIds`/etc are expected to be the DELTA (what's newly
  // being paid for), computed by the caller from ParticipantBill.unpaid*.
  const claimPayment = async (
    participantId: string,
    amount: number,
    method: "qr" | "cash",
    paidItemIds: string[],
    paidItemQuantities: Record<string, number>,
    paidShareGroupIds: string[]
  ) => {
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
    await loadPayments()
  }

  const getPayments = (participantId: string): Payment[] => {
    return payments.filter((p) => p.participant_id === participantId)
  }

  // Verify a claimed payment (owner action)
  const verifyPayment = async (paymentId: string) => {
    const { error } = await supabase
      .from("payments")
      .update({ status: "verified" })
      .eq("id", paymentId)
    if (error) throw error
    // Don't rely solely on the realtime echo to refresh local state — that
    // depends on Supabase realtime round-trip timing. Reload immediately so
    // the UI is consistent right after the write, same as claimPayment/etc.
    await loadPayments()
  }

  // Unverify a payment (owner caught false claim)
  const unverifyPayment = async (paymentId: string) => {
    const { error } = await supabase
      .from("payments")
      .update({ status: "unverified" })
      .eq("id", paymentId)
    if (error) throw error
    await loadPayments()
  }

  // Cancel an unverified payment (participant action — they reduced/removed
  // a claim that round covered, so it's no longer a debt to repay). Kept in
  // the DB for the owner's history view, but excluded everywhere else.
  const cancelPayment = async (paymentId: string) => {
    console.log("[CANCEL] Cancelling payment", paymentId)
    const { error } = await supabase
      .from("payments")
      .update({ status: "cancelled" })
      .eq("id", paymentId)

    if (error) {
      console.error("[CANCEL] Failed:", error)
      throw error
    }
    console.log("[CANCEL] Success, payment", paymentId, "cancelled")
    await loadPayments()
  }

  // Mark someone as paid in cash (owner action) — new verified round for
  // the given delta amount/items.
  const markAsCash = async (
    participantId: string,
    amount: number,
    paidItemIds: string[],
    paidItemQuantities: Record<string, number>,
    paidShareGroupIds: string[]
  ) => {
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
    await loadPayments()
  }

  // Owner confirms their own items - bypasses claim, goes straight to
  // verified. New round for the given delta amount/items.
  const ownerConfirmPayment = async (
    participantId: string,
    amount: number,
    paidItemIds: string[],
    paidItemQuantities: Record<string, number>,
    paidShareGroupIds: string[]
  ) => {
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
    await loadPayments()
  }

  return {
    payments,
    loading,
    claimPayment,
    getPayments,
    verifyPayment,
    unverifyPayment,
    cancelPayment,
    markAsCash,
    ownerConfirmPayment,
  }
}