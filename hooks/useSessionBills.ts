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
  hasTicked: boolean // whether they have any items at all
  amountPaid: number // only counts if verified
  amountOwed: number // remaining unpaid
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

    const getItemSharers = (itemId: string): string[] => {
      return allAssignments
        .filter((a) => a.item_id === itemId && a.status !== "rejected")
        .map((a) => a.participant_id)
    }

    const totalSessionSubtotal = items.reduce((sum, item) => {
      const sharers = getItemSharers(item.id)
      if (sharers.length === 0) return sum
      return sum + Number(item.price)
    }, 0)

    const bills: ParticipantBill[] = participants.map((p) => {
      // Calculate this person's subtotal
      const subtotal = items.reduce((sum, item) => {
        const sharers = getItemSharers(item.id)
        if (!sharers.includes(p.id)) return sum
        return sum + Number(item.price) / sharers.length
      }, 0)

      const billCalc = calculateBill(subtotal, totalSessionSubtotal, session)
      const total = roundToTwoDecimals(billCalc.total)

      const payment = payments.find((pay) => pay.participant_id === p.id) || null
      const isClaimed = payment?.status === "claimed"
      const isVerified = payment?.status === "verified"
      const isUnverified = payment?.status === "unverified"

      // Only verified payments count toward amount paid
      const amountPaid = isVerified && payment ? Number(payment.amount_paid) : 0

      // Amount owed = full bill minus what's actually paid (verified)
      const amountOwed = Math.max(0, total - amountPaid)

      // Has the person ticked anything?
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

// Total bill = sum of all items + tax + service on the full bill
    const itemsSubtotal = items.reduce(
      (sum, item) => sum + Number(item.price),
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

    // Calculate collected and pending from payments
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

    // Outstanding = what's still owed
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