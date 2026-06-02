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
    paidItemIds: string[]
  ) => {
    const existing = payments.find((p) => p.participant_id === participantId)

    if (existing) {
      // Combine previous paid items with new ones
      const combinedItems = Array.from(
        new Set([...(existing.paid_item_ids || []), ...paidItemIds])
      )
      const combinedAmount = Number(existing.amount_paid) + amount

      const { error } = await supabase
        .from("payments")
        .update({
          amount_paid: combinedAmount,
          status: "claimed",
          method,
          paid_item_ids: combinedItems,
        })
        .eq("id", existing.id)

      if (error) throw error
    } else {
      const { error } = await supabase.from("payments").insert({
        session_id: sessionId,
        participant_id: participantId,
        amount_paid: amount,
        status: "claimed",
        method,
        paid_item_ids: paidItemIds,
      })

      if (error) throw error
    }
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
  const markAsCash = async (participantId: string, amount: number, paidItemIds: string[]) => {
    const existing = payments.find((p) => p.participant_id === participantId)

    if (existing) {
      const { error } = await supabase
        .from("payments")
        .update({
          amount_paid: amount,
          status: "verified",
          method: "cash",
          paid_item_ids: paidItemIds,
        })
        .eq("id", existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from("payments").insert({
        session_id: sessionId,
        participant_id: participantId,
        amount_paid: amount,
        status: "verified",
        method: "cash",
        paid_item_ids: paidItemIds,
      })
      if (error) throw error
    }
  }

  

  // Owner confirms their own items — bypasses claim, goes straight to verified
  const ownerConfirmPayment = async (
    participantId: string,
    amount: number,
    paidItemIds: string[]
  ) => {
    const existing = payments.find((p) => p.participant_id === participantId)

    if (existing) {
      // If no items left, delete the payment entirely
      if (paidItemIds.length === 0) {
        const { error } = await supabase
          .from("payments")
          .delete()
          .eq("id", existing.id)
        if (error) throw error
        return
      }

      // Otherwise update with new items and amount
      const { error } = await supabase
        .from("payments")
        .update({
          amount_paid: amount,
          status: "verified",
          method: "cash",
          paid_item_ids: paidItemIds,
        })
        .eq("id", existing.id)
      if (error) throw error
    } else {
      // No existing payment — create new one (skip if nothing to confirm)
      if (paidItemIds.length === 0) return

      const { error } = await supabase.from("payments").insert({
        session_id: sessionId,
        participant_id: participantId,
        amount_paid: amount,
        status: "verified",
        method: "cash",
        paid_item_ids: paidItemIds,
      })
      if (error) throw error
    }
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