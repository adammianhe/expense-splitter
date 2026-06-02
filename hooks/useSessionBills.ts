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

    // Get total quantity of an item claimed across all non-rejected assignments
    const getItemTotalClaimed = (itemId: string): number => {
      return allAssignments
        .filter((a) => a.item_id === itemId && a.status !== "rejected")
        .reduce((sum, a) => sum + (Number(a.quantity) || 1), 0)
    }

    // Get quantity claimed by a specific participant
    const getParticipantItemQty = (itemId: string, participantId: string): number => {
      const assignment = allAssignments.find(
        (a) =>
          a.item_id === itemId &&
          a.participant_id === participantId &&
          a.status !== "rejected"
      )
      return assignment ? Number(assignment.quantity) || 1 : 0
    }

    // Total session subtotal — sum of (price × claimed quantity) for all items
    // Capped at item's ordered quantity so over-claiming doesn't inflate the total
    const totalSessionSubtotal = items.reduce((sum, item) => {
      const claimed = getItemTotalClaimed(item.id)
      const effectiveClaimed = Math.min(claimed, item.quantity)
      return sum + Number(item.price) * effectiveClaimed
    }, 0)

    const bills: ParticipantBill[] = participants.map((p) => {
      // Calculate this person's subtotal
      const subtotal = items.reduce((sum, item) => {
        const myQty = getParticipantItemQty(item.id, p.id)
        if (myQty === 0) return sum

        const totalClaimed = getItemTotalClaimed(item.id)
        // Split: my qty / total claimed qty × (price × min(claimed, ordered))
        const itemEffective = Math.min(totalClaimed, item.quantity)
        const myShare =
          totalClaimed > 0
            ? (myQty / totalClaimed) * (Number(item.price) * itemEffective)
            : 0

        return sum + myShare
      }, 0)

      const billCalc = calculateBill(subtotal, totalSessionSubtotal, session)
      const total = roundToTwoDecimals(billCalc.total)

      const payment = payments.find((pay) => pay.participant_id === p.id) || null
      const isClaimed = payment?.status === "claimed"
      const isVerified = payment?.status === "verified"
      const isUnverified = payment?.status === "unverified"

      const amountPaid = isVerified && payment ? Number(payment.amount_paid) : 0
      const amountOwed = Math.max(0, total - amountPaid)
      const hasTicked = subtotal > 0

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
      }
    })

    // Total bill = sum of all items × their quantity + tax + service
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
      if (b.isVerified) {
        totalCollected += b.amountPaid
      }
      if (b.isClaimed && b.payment) {
        totalPending += Number(b.payment.amount_paid)
      }
    })

    const totalOutstanding = Math.max(
      0,
      totalBill - totalCollected - totalPending
    )

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