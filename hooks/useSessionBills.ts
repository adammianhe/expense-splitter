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

  // All payment rounds for this participant (multi-record model — verify/
  // unverify act on one round, not a single cumulative record).
  payments: Payment[]
  claimedPayments: Payment[]
  verifiedPayments: Payment[]
  unverifiedPayments: Payment[]

  verifiedAmount: number
  pendingAmount: number // sum of "claimed" rows
  unverifiedAmount: number
  overpaidAmount: number

  isClaimed: boolean
  isVerified: boolean
  isUnverified: boolean
  hasTicked: boolean
  amountPaid: number // = verifiedAmount, kept for backward-compat call sites
  amountOwed: number // = max(0, total - verifiedAmount - pendingAmount)
  hasPendingShares: boolean

  // Paid quantities/shares aggregated from verified + claimed rows only
  // (unverified rows don't count as paid).
  paidItemQuantities: Record<string, number>
  paidShareGroupIds: Set<string>

  // The DELTA — what's currently unpaid right now, given claims minus what's
  // already been paid (verified/claimed). This is what a new payment round
  // (Pay / Pay Again / Mark as Paid / owner self-confirm) should cover.
  unpaidItemIds: string[]
  unpaidItemQuantities: Record<string, number>
  unpaidShareGroupIds: string[]
  unpaidSubtotal: number
  unpaidChargeLines: ChargeLine[]
  unpaidTotal: number
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

    const appliedCharges = resolveCharges(session, charges)

    const calculateParticipantItemShare = (
      itemId: string,
      participantId: string,
      itemPrice: number
    ): number => {
      let total = 0

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

    const getSoloQty = (participantId: string, itemId: string): number => {
      const a = allAssignments.find(
        (a) =>
          a.item_id === itemId &&
          a.participant_id === participantId &&
          a.share_group_id === null &&
          a.status !== "rejected"
      )
      return a ? Number(a.quantity) : 0
    }

    // Confirmed share groups this participant belongs to, for a given item
    const getConfirmedShareGroups = (participantId: string, itemId: string) => {
      const groupIds = new Set(
        allAssignments
          .filter(
            (a) =>
              a.item_id === itemId &&
              a.share_group_id !== null &&
              a.participant_id === participantId
          )
          .map((a) => a.share_group_id)
      )
      return Array.from(groupIds)
        .map((groupId) => {
          const members = allAssignments.filter((a) => a.share_group_id === groupId)
          return {
            groupId: groupId as string,
            quantity: Number(members[0]?.quantity || 0),
            memberCount: members.length,
            allConfirmed: members.every((m) => m.status === "confirmed"),
          }
        })
        .filter((g) => g.allConfirmed)
    }

    // Items where this participant has a share still pending confirmation —
    // not payable yet, so excluded from unpaid delta.
    const hasPendingShareOnItem = (participantId: string, itemId: string): boolean => {
      const groupIds = new Set(
        allAssignments
          .filter(
            (a) =>
              a.item_id === itemId &&
              a.share_group_id !== null &&
              a.participant_id === participantId
          )
          .map((a) => a.share_group_id)
      )
      for (const groupId of groupIds) {
        const members = allAssignments.filter((a) => a.share_group_id === groupId)
        if (!members.every((m) => m.status === "confirmed")) return true
      }
      return false
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

      const participantPayments = payments
        .filter((pay) => pay.participant_id === p.id)
        .sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )

      const claimedPayments = participantPayments.filter((pay) => pay.status === "claimed")
      const verifiedPayments = participantPayments.filter((pay) => pay.status === "verified")
      const unverifiedPayments = participantPayments.filter(
        (pay) => pay.status === "unverified"
      )

      const sumAmount = (rows: Payment[]) =>
        rows.reduce((s, pay) => s + Number(pay.amount_paid), 0)

      const verifiedAmount = sumAmount(verifiedPayments)
      const pendingAmount = sumAmount(claimedPayments)
      const unverifiedAmount = sumAmount(unverifiedPayments)

      const amountOwed = Math.max(0, total - verifiedAmount - pendingAmount)
      const overpaidAmount = Math.max(0, verifiedAmount - total)

      const isClaimed = pendingAmount > 0
      const isVerified = verifiedAmount > 0 && amountOwed === 0 && pendingAmount === 0

      const hasTicked = subtotal > 0 || hasPendingShares(p.id)

      // Aggregate paid quantities/shares from verified + claimed rows (NOT
      // unverified — those don't count as paid).
      const countedPayments = [...verifiedPayments, ...claimedPayments]
      const paidItemQuantities: Record<string, number> = {}
      const paidShareGroupIds = new Set<string>()
      for (const pay of countedPayments) {
        const qtyMap = pay.paid_item_quantities || {}
        for (const [itemId, qty] of Object.entries(qtyMap)) {
          paidItemQuantities[itemId] = (paidItemQuantities[itemId] || 0) + Number(qty)
        }
        for (const gid of pay.paid_share_group_ids || []) {
          paidShareGroupIds.add(gid)
        }
      }

      // Delta: current claims minus what's already paid (verified/claimed)
      const unpaidItemIds: string[] = []
      const unpaidItemQuantities: Record<string, number> = {}
      let unpaidSubtotal = 0

      items.forEach((item) => {
        if (hasPendingShareOnItem(p.id, item.id)) return
        const soloQty = getSoloQty(p.id, item.id)
        const paidQty = paidItemQuantities[item.id] || 0
        const deltaQty = Math.max(0, soloQty - paidQty)
        if (deltaQty > 0) {
          unpaidItemIds.push(item.id)
          unpaidItemQuantities[item.id] = deltaQty
          unpaidSubtotal += deltaQty * Number(item.price)
        }
      })

      const unpaidShareGroupIds: string[] = []
      items.forEach((item) => {
        const shares = getConfirmedShareGroups(p.id, item.id).filter(
          (g) => !paidShareGroupIds.has(g.groupId)
        )
        for (const g of shares) {
          unpaidShareGroupIds.push(g.groupId)
          unpaidSubtotal += (g.quantity * Number(item.price)) / g.memberCount
          if (!unpaidItemIds.includes(item.id)) unpaidItemIds.push(item.id)
        }
      })

      const unpaidBill = calculateBillWithCharges(
        unpaidSubtotal,
        totalSessionSubtotal,
        appliedCharges
      )
      const unpaidTotal = roundToTwoDecimals(unpaidBill.total)

      // An unverified round only matters while it's still the reason for an
      // outstanding balance. `unverifiedAmount > 0` alone isn't enough —
      // once the participant pays again (a newer verified/claimed round) or
      // simply owes nothing right now, stale unverified history shouldn't
      // keep flagging them. Cancelled rounds are excluded entirely before
      // picking "most recent" — they're history-only, never actionable.
      const activePayments = participantPayments.filter((pay) => pay.status !== "cancelled")
      const mostRecentPayment = activePayments[0] || null
      const isUnverified = mostRecentPayment?.status === "unverified" && unpaidTotal > 0

      return {
        participant: p,
        subtotal: billCalc.subtotal,
        chargeLines: billCalc.chargeLines,
        totalCharges: billCalc.totalCharges,
        total,
        payments: participantPayments,
        claimedPayments,
        verifiedPayments,
        unverifiedPayments,
        verifiedAmount,
        pendingAmount,
        unverifiedAmount,
        overpaidAmount,
        isClaimed,
        isVerified,
        isUnverified,
        hasTicked,
        amountPaid: verifiedAmount,
        amountOwed,
        hasPendingShares: hasPendingShares(p.id),
        paidItemQuantities,
        paidShareGroupIds,
        unpaidItemIds,
        unpaidItemQuantities,
        unpaidShareGroupIds,
        unpaidSubtotal: unpaidBill.subtotal,
        unpaidChargeLines: unpaidBill.chargeLines,
        unpaidTotal,
      }
    })

    // Total restaurant bill (fixed)
    const itemsSubtotal = items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    )

    const summaryChargeLines = computeChargeLines(
      itemsSubtotal,
      itemsSubtotal,
      appliedCharges
    )
    const totalChargesFull = summaryChargeLines.reduce((s, l) => s + l.amount, 0)

    const totalBill = itemsSubtotal + totalChargesFull

    let totalCollected = 0
    let totalPending = 0

    bills.forEach((b) => {
      totalCollected += b.verifiedAmount
      totalPending += b.pendingAmount
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
