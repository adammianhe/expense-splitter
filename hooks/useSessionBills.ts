"use client"

import { useMemo } from "react"
import { Item, Participant, Session, Payment, SessionCharge } from "@/types"
import {
  ChargeLine,
  calculateBillWithCharges,
  computeChargeLines,
  resolveCharges,
  roundToTwoDecimals,
} from "@/lib/utils"

export type ParticipantBill = {
  participant: Participant
  subtotal: number
  chargeLines: ChargeLine[]
  totalCharges: number
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
  payments: Payment[],
  charges: SessionCharge[] = []
) {
  return useMemo(() => {
    if (!session) return { bills: [], summary: defaultSummary() }

    // Charges to apply: new session_charges rows if any, else legacy tax/service
    // columns (so old sessions still display and bill correctly).
    const appliedCharges = resolveCharges(session, charges)

    // Calculate participant's share of an item - from solo + confirmed shares.
    // NOTE: a participant is only BILLED for a share once the whole group is
    // confirmed. A pending share reserves item capacity (see totalSessionSubtotal)
    // but is not yet charged to anyone's personal bill.
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

      // Share claims - only confirmed shares count toward the personal bill
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

    // Total session subtotal - solo + reserved shares (capped at qty).
    // NUANCE: for capacity / the "X left" counter we count ANY non-rejected
    // share (pending OR confirmed) so a pending share reserves its slot and
    // others can't claim over the item quantity. This differs from
    // calculateParticipantItemShare above, which only charges a participant
    // once the whole share group is confirmed. So a pending share affects
    // capacity here but is not yet billed to anyone personally.
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
        const anyActive = members.some((m) => m.status !== "rejected")
        if (anyActive) shareTotal += Number(members[0].quantity)
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

      const billCalc = calculateBillWithCharges(
        subtotal,
        totalSessionSubtotal,
        appliedCharges
      )
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
        chargeLines: billCalc.chargeLines,
        totalCharges: billCalc.totalCharges,
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

    // Charges applied to the full restaurant subtotal (for the owner summary).
    // Using personSubtotal === totalSessionSubtotal === itemsSubtotal means a
    // fixed charge resolves to its full value and a percentage to its full %.
    const summaryChargeLines = computeChargeLines(
      itemsSubtotal,
      itemsSubtotal,
      appliedCharges
    )
    const totalChargesFull = summaryChargeLines.reduce(
      (s, l) => s + l.amount,
      0
    )

    const totalBill = itemsSubtotal + totalChargesFull

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
        itemsSubtotal,
        chargeLines: summaryChargeLines,
        totalCollected,
        totalPending,
        totalOutstanding,
      },
    }
  }, [session, participants, items, allAssignments, payments, charges])
}

function defaultSummary() {
  return {
    totalBill: 0,
    itemsSubtotal: 0,
    chargeLines: [] as ChargeLine[],
    totalCollected: 0,
    totalPending: 0,
    totalOutstanding: 0,
  }
}