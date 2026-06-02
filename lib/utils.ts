import { Session } from "@/types"

// Save current participant ID for a session
export function saveParticipantId(sessionId: string, participantId: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(`session_${sessionId}_participant`, participantId)
}

// Get saved participant ID for a session
export function getParticipantId(sessionId: string): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(`session_${sessionId}_participant`)
}

// Remove saved participant
export function clearParticipantId(sessionId: string) {
  if (typeof window === "undefined") return
  localStorage.removeItem(`session_${sessionId}_participant`)
}

// ============================================
// TAX CALCULATIONS
// ============================================

// Calculate tax/service amount given a subtotal and config
export function calculateTaxAmount(
  subtotal: number,
  type: "percentage" | "fixed" | null,
  value: number,
  totalSubtotal: number
): number {
  if (!type || !value) return 0

  if (type === "percentage") {
    // Percentage of person's subtotal
    return subtotal * (value / 100)
  } else {
    // Fixed amount — split proportionally based on subtotal
    if (totalSubtotal === 0) return 0
    return (subtotal / totalSubtotal) * value
  }
}

// Calculate full bill breakdown for a person
export type BillBreakdown = {
  subtotal: number
  tax: number
  service: number
  total: number
}

export function calculateBill(
  personSubtotal: number,
  totalSessionSubtotal: number,
  session: Session
): BillBreakdown {
  const tax = calculateTaxAmount(
    personSubtotal,
    session.tax_type,
    Number(session.tax_value),
    totalSessionSubtotal
  )

  const service = calculateTaxAmount(
    personSubtotal,
    session.service_type,
    Number(session.service_value),
    totalSessionSubtotal
  )

  return {
    subtotal: personSubtotal,
    tax,
    service,
    total: personSubtotal + tax + service,
  }
}

// Round to 2 decimal places (standard)
export function roundToTwoDecimals(amount: number): number {
  return Math.round(amount * 100) / 100
}

// Format date smartly — "today", "yesterday", or full date
export function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()

  const isToday = date.toDateString() === now.toDateString()

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const timeStr = date.toLocaleTimeString("en-MY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  if (isToday) return `today at ${timeStr}`
  if (isYesterday) return `yesterday at ${timeStr}`

  return date.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }) + ` at ${timeStr}`
}