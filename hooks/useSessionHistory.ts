"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getStoredSessions, StoredSession } from "@/lib/sessionHistory"
import { resolveCharges, computeChargeLines, calculateBillWithCharges } from "@/lib/utils"
import { Session, Item, SessionCharge } from "@/types"
import { useAuth } from "@/contexts/AuthContext"
import { useUserSessions } from "@/hooks/useUserSessions"

export type SessionHistoryItem = {
  sessionId: string
  participantId: string
  sessionName: string
  role: "owner" | "friend"
  joinedAt: string
  lastVisitedAt: string
  createdAt: string
  status: "settled" | "pending" | "active"
  outstandingAmount: number
  totalAmount: number
  isStale: boolean
  fetchError: boolean
}

function calcTotalSessionSubtotal(items: Item[], allAssignments: any[]): number {
  return items.reduce((sum, item) => {
    const soloTotal = allAssignments
      .filter(
        (a) =>
          a.item_id === item.id &&
          a.share_group_id === null &&
          a.status === "confirmed"
      )
      .reduce((s: number, a: any) => s + Number(a.quantity), 0)

    const shareGroupIds = new Set(
      allAssignments
        .filter((a) => a.item_id === item.id && a.share_group_id !== null)
        .map((a) => a.share_group_id)
    )
    let shareTotal = 0
    for (const groupId of shareGroupIds) {
      const members = allAssignments.filter((a) => a.share_group_id === groupId)
      if (members.some((m: any) => m.status !== "rejected")) {
        shareTotal += Number(members[0].quantity)
      }
    }
    const effective = Math.min(soloTotal + shareTotal, item.quantity)
    return sum + Number(item.price) * effective
  }, 0)
}

function calcParticipantSubtotal(
  participantId: string,
  items: Item[],
  allAssignments: any[]
): number {
  return items.reduce((sum, item) => {
    const solo = allAssignments.find(
      (a) =>
        a.item_id === item.id &&
        a.participant_id === participantId &&
        a.share_group_id === null &&
        a.status !== "rejected"
    )
    let total = solo ? Number(solo.quantity) * Number(item.price) : 0

    const myShares = allAssignments.filter(
      (a) =>
        a.item_id === item.id &&
        a.participant_id === participantId &&
        a.share_group_id !== null
    )
    for (const share of myShares) {
      const group = allAssignments.filter(
        (a) => a.share_group_id === share.share_group_id
      )
      if (group.every((m: any) => m.status === "confirmed")) {
        total += (Number(share.quantity) * Number(item.price)) / group.length
      }
    }
    return sum + total
  }, 0)
}

function cachedErrorItem(stored: StoredSession): SessionHistoryItem {
  return {
    sessionId: stored.sessionId,
    participantId: stored.participantId,
    sessionName: stored.sessionName,
    role: stored.role,
    joinedAt: stored.joinedAt,
    lastVisitedAt: stored.lastVisitedAt || stored.joinedAt,
    createdAt: stored.joinedAt,
    status: "active",
    outstandingAmount: 0,
    totalAmount: 0,
    isStale: false,
    fetchError: true,
  }
}

async function fetchOne(stored: StoredSession): Promise<SessionHistoryItem> {
  const staleResult: SessionHistoryItem = {
    sessionId: stored.sessionId,
    participantId: stored.participantId,
    sessionName: stored.sessionName,
    role: stored.role,
    joinedAt: stored.joinedAt,
    lastVisitedAt: stored.lastVisitedAt || stored.joinedAt,
    createdAt: stored.joinedAt,
    status: "active",
    outstandingAmount: 0,
    totalAmount: 0,
    isStale: true,
    fetchError: false,
  }

  try {
    const [sessionRes, itemsRes, chargesRes, assignmentsRes, paymentsRes] =
      await Promise.all([
        supabase
          .from("sessions")
          .select("*")
          .eq("id", stored.sessionId)
          .maybeSingle(),
        supabase
          .from("items")
          .select("*")
          .eq("session_id", stored.sessionId),
        supabase
          .from("session_charges")
          .select("*")
          .eq("session_id", stored.sessionId)
          .order("display_order"),
        supabase
          .from("item_assignments")
          .select("*, items!inner(session_id)")
          .eq("items.session_id", stored.sessionId),
        supabase
          .from("payments")
          .select("*")
          .eq("session_id", stored.sessionId),
      ])

    // Network / auth error on the primary session query
    if (sessionRes.error) return cachedErrorItem(stored)

    // Session deleted from DB
    if (!sessionRes.data) return staleResult

    const session = sessionRes.data as Session
    // Use empty arrays for secondary table failures (non-critical)
    const items = (itemsRes.data || []) as Item[]
    const charges = (chargesRes.data || []) as SessionCharge[]
    const allAssignments = assignmentsRes.data || []
    const payments = paymentsRes.data || []

    const appliedCharges = resolveCharges(session, charges)

    const itemsTotal = items.reduce(
      (s, item) => s + Number(item.price) * Number(item.quantity),
      0
    )
    const summaryLines = computeChargeLines(itemsTotal, itemsTotal, appliedCharges)
    const totalBill =
      itemsTotal + summaryLines.reduce((s, l) => s + l.amount, 0)

    // Multi-record model: a participant may have many payment rows across
    // rounds. Any still-"claimed" (unverified-by-owner) row means the
    // session isn't fully settled yet, even if verified sums cover the bill.
    const hasAnyPendingPayment = payments.some((p: any) => p.status === "claimed")

    if (stored.role === "owner") {
      const totalVerified = payments
        .filter((p: any) => p.status === "verified")
        .reduce((s: number, p: any) => s + Number(p.amount_paid), 0)
      const outstanding = Math.max(0, totalBill - totalVerified)
      const settled =
        (session.status === "settled" || outstanding === 0) && !hasAnyPendingPayment
      return {
        sessionId: stored.sessionId,
        participantId: stored.participantId,
        sessionName: session.name,
        role: "owner",
        joinedAt: stored.joinedAt,
        lastVisitedAt: stored.lastVisitedAt || stored.joinedAt,
        createdAt: session.created_at,
        status: settled ? "settled" : "pending",
        outstandingAmount: outstanding,
        totalAmount: totalBill,
        isStale: false,
        fetchError: false,
      }
    } else {
      const totalSessionSubtotal = calcTotalSessionSubtotal(items, allAssignments)
      const mySubtotal = calcParticipantSubtotal(
        stored.participantId,
        items,
        allAssignments
      )
      const myBill = calculateBillWithCharges(
        mySubtotal,
        totalSessionSubtotal,
        appliedCharges
      )
      const myPayments = payments.filter(
        (p: any) => p.participant_id === stored.participantId
      )
      const myVerified = myPayments
        .filter((p: any) => p.status === "verified")
        .reduce((s: number, p: any) => s + Number(p.amount_paid), 0)
      const myPending = myPayments
        .filter((p: any) => p.status === "claimed")
        .reduce((s: number, p: any) => s + Number(p.amount_paid), 0)
      const outstanding = Math.max(0, myBill.total - myVerified - myPending)

      let status: "settled" | "pending" | "active"
      if (outstanding > 0 || myPending > 0) {
        status = "pending"
      } else if (myVerified > 0) {
        status = "settled"
      } else {
        status = "active"
      }

      return {
        sessionId: stored.sessionId,
        participantId: stored.participantId,
        sessionName: session.name,
        role: "friend",
        joinedAt: stored.joinedAt,
        lastVisitedAt: stored.lastVisitedAt || stored.joinedAt,
        createdAt: session.created_at,
        status,
        outstandingAmount: outstanding,
        totalAmount: myBill.total,
        isStale: false,
        fetchError: false,
      }
    }
  } catch {
    return cachedErrorItem(stored)
  }
}

export function useSessionHistory() {
  const { user } = useAuth()
  const { userSessions, loading: userSessionsLoading } = useUserSessions()

  const [items, setItems] = useState<SessionHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Read localStorage synchronously on init so page can skip skeletons
  // when there are truly no stored sessions (avoids layout flicker)
  const [storedCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0
    try {
      const raw = localStorage.getItem("splitto:sessions")
      return raw ? (JSON.parse(raw) as unknown[]).length : 0
    } catch {
      return 0
    }
  })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const stored = getStoredSessions()

      // Merge localStorage + DB sources, deduped by sessionId. localStorage
      // wins on conflict since it carries the user's own device state.
      const sessionMap = new Map<string, StoredSession>()
      for (const s of stored) {
        sessionMap.set(s.sessionId, s)
      }
      if (user) {
        for (const us of userSessions) {
          if (!sessionMap.has(us.session_id)) {
            sessionMap.set(us.session_id, {
              sessionId: us.session_id,
              participantId: us.participant_id,
              role: us.role,
              sessionName: "Session",
              joinedAt: us.joined_at,
              lastVisitedAt: us.joined_at,
            })
          }
        }
      }

      const merged = Array.from(sessionMap.values())
      if (merged.length === 0) {
        setItems([])
        setLoading(false)
        return
      }
      const results = await Promise.all(merged.map(fetchOne))
      results.sort((a, b) => {
        const aTime = a.lastVisitedAt || a.joinedAt
        const bTime = b.lastVisitedAt || b.joinedAt
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })
      setItems(results)
    } catch (e: any) {
      // Total failure (e.g. Supabase down) — fall back to cached names with fetchError
      const stored = getStoredSessions()
      setItems(stored.map(cachedErrorItem))
      setError(e?.message || "Failed to load sessions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Wait for user_sessions to resolve before merging, so signed-in loads
    // don't briefly show a localStorage-only list then jump.
    if (user && userSessionsLoading) {
      setLoading(true)
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userSessions, userSessionsLoading])

  return { items, loading, error, storedCount, refresh: load }
}
