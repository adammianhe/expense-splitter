"use client"

import { useMemo } from "react"
import { Item, Participant, Session, Payment } from "@/types"
import { calculateBill, roundToTwoDecimals } from "@/lib/utils"

export type ParticipantBill = {
  participant: Participant
  subtotal: number
  tax: number
  service: number
  total: number
  payment: Payment | null
  isClaimed: boolean
  isVerified: boolean
  isUnverified: boolean
  hasTicked: boolean
  amountPaid: number
  amountOwed: number
  hasPendingShares: boolean
  // NEW: paid quantities per item, and paid share group IDs
  paidItemQuantities: Record<string, number>
  paidShareGroupIds: Set<string>
}

export function useSessionBills(
  session: Session | null,
  participants: Participant[],
  items: Item[],
  allAssignments: any[],
  payments: Payment[]
) {
  return useMemo(() => {
    if (!session) return { bills: [], summary: defaultSummary() }

    // Calculate participant's share of an item — from solo + confirmed shares
    const calculateParticipantItemShare = (
      itemId: string,
      participantId: string,
      itemPrice: number
    ): number => {
      let total = 0

      // Solo claim
      const soloAssignment = allAssignments.find(
        (a) =>
          a.item_id === itemId &&
          a.participant_id === participantId &&
          a.share_group_id === null &&
          a.status !== "rejected"
      )
      if (soloAssignment) {
        total += Number(soloAssignment.quantity) * itemPrice
      }

      // Share claims — only confirmed shares count
      const myShares = allAssignments.filter(
        (a) =>
          a.item_id === itemId &&
          a.participant_id === participantId &&
          a.share_group_id !== null
      )

      for (const myShare of myShares) {
        const groupMembers = allAssignments.filter(
          (a) => a.share_group_id === myShare.share_group_id
        )
        const allConfirmed = groupMembers.every((m) => m.status === "confirmed")
        if (allConfirmed) {
          const shareQty = Number(myShare.quantity)
          const memberCount = groupMembers.length
          total += (shareQty * itemPrice) / memberCount
        }
      }

      return total
    }

    const hasPendingShares = (participantId: string): boolean => {
      const myShareGroupIds = new Set(
        allAssignments
          .filter(
            (a) =>
              a.participant_id === participantId &&
              a.share_group_id !== null &&
              a.status !== "rejected"
          )
          .map((a) => a.share_group_id)
      )

      for (const groupId of myShareGroupIds) {
        const members = allAssignments.filter((a) => a.share_group_id === groupId)
        if (members.some((m) => m.status === "pending")) return true
      }
      return false
    }

    // Total session subtotal — solo + fully-confirmed shares (capped at qty)
    const totalSessionSubtotal = items.reduce((sum, item) => {
      const soloTotal = allAssignments
        .filter(
          (a) =>
            a.item_id === item.id &&
            a.share_group_id === null &&
            a.status === "confirmed"
        )
        .reduce((s, a) => s + Number(a.quantity), 0)

      const shareGroupIds = new Set(
        allAssignments
          .filter((a) => a.item_id === item.id && a.share_group_id !== null)
          .map((a) => a.share_group_id)
      )

      let shareTotal = 0
      for (const groupId of shareGroupIds) {
        const members = allAssignments.filter((a) => a.share_group_id === groupId)
        const allConfirmed = members.every((m) => m.status === "confirmed")
        if (allConfirmed) shareTotal += Number(members[0].quantity)
      }

      const totalClaimed = soloTotal + shareTotal
      const effective = Math.min(totalClaimed, item.quantity)
      return sum + Number(item.price) * effective
    }, 0)

    // Build bills per participant
    const bills: ParticipantBill[] = participants.map((p) => {
      const subtotal = items.reduce((sum, item) => {
        return sum + calculateParticipantItemShare(item.id, p.id, Number(item.price))
      }, 0)

      const billCalc = calculateBill(subtotal, totalSessionSubtotal, session)
      const total = roundToTwoDecimals(billCalc.total)

      const payment = payments.find((pay) => pay.participant_id === p.id) || null
      const isClaimed = payment?.status === "claimed"
      const isVerified = payment?.status === "verified"
      const isUnverified = payment?.status === "unverified"

      const amountPaid = isVerified && payment ? Number(payment.amount_paid) : 0
      const amountOwed = Math.max(0, total - amountPaid)
      const hasTicked = subtotal > 0 || hasPendingShares(p.id)

      // Extract paid item quantities and share group IDs
      const paidItemQuantities: Record<string, number> =
        (payment as any)?.paid_item_quantities || {}
      const paidShareGroupIds: Set<string> = new Set(
        (payment as any)?.paid_share_group_ids || []
      )

      return {
        participant: p,
        subtotal: billCalc.subtotal,
        tax: billCalc.tax,
        service: billCalc.service,
        total,
        payment,
        isClaimed,
        isVerified,
        isUnverified,
        hasTicked,
        amountPaid,
        amountOwed,
        hasPendingShares: hasPendingShares(p.id),
        paidItemQuantities,
        paidShareGroupIds,
      }
    })

    // Total restaurant bill (fixed)
    const itemsSubtotal = items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    )

    let billTax = 0
    let billService = 0

    if (session.tax_type === "percentage") {
      billTax = itemsSubtotal * (Number(session.tax_value) / 100)
    } else if (session.tax_type === "fixed") {
      billTax = Number(session.tax_value)
    }

    if (session.service_type === "percentage") {
      billService = itemsSubtotal * (Number(session.service_value) / 100)
    } else if (session.service_type === "fixed") {
      billService = Number(session.service_value)
    }

    const totalBill = itemsSubtotal + billTax + billService

    let totalCollected = 0
    let totalPending = 0

    bills.forEach((b) => {
      if (b.isVerified) totalCollected += b.amountPaid
      if (b.isClaimed && b.payment) totalPending += Number(b.payment.amount_paid)
    })

    const totalOutstanding = Math.max(0, totalBill - totalCollected - totalPending)

    return {
      bills,
      summary: {
        totalBill,
        totalCollected,
        totalPending,
        totalOutstanding,
      },
    }
  }, [session, participants, items, allAssignments, payments])
}

function defaultSummary() {
  return {
    totalBill: 0,
    totalCollected: 0,
    totalPending: 0,
    totalOutstanding: 0,
  }
}