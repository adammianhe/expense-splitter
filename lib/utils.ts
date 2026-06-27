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
    // Fixed amount - split proportionally based on subtotal
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

// ============================================
// SESSION CHARGES (unified tax / service / tip / etc.)
// ============================================

export type ChargeLike = {
  label: string | null
  charge_type: "percentage" | "fixed"
  charge_value: number
}

export type ChargeLine = ChargeLike & { amount: number }

// Build a charge list from legacy session.tax_* / service_* columns.
// Used as a fallback for old sessions created before session_charges existed.
export function legacySessionCharges(session: Session): ChargeLike[] {
  const out: ChargeLike[] = []
  if (session.tax_type && Number(session.tax_value) > 0) {
    out.push({
      label: "Tax",
      charge_type: session.tax_type,
      charge_value: Number(session.tax_value),
    })
  }
  if (session.service_type && Number(session.service_value) > 0) {
    out.push({
      label: "Service Charge",
      charge_type: session.service_type,
      charge_value: Number(session.service_value),
    })
  }
  return out
}

// Resolve which charges to apply: new session_charges rows if present,
// otherwise fall back to the legacy tax/service columns on the session.
export function resolveCharges(
  session: Session,
  charges: ChargeLike[]
): ChargeLike[] {
  return charges && charges.length > 0 ? charges : legacySessionCharges(session)
}

// Compute the RM amount for each charge given a person's subtotal.
// percentage: subtotal * value / 100
// fixed: split proportionally by the person's share of the session subtotal
export function computeChargeLines(
  personSubtotal: number,
  totalSessionSubtotal: number,
  charges: ChargeLike[]
): ChargeLine[] {
  return charges.map((c) => {
    let amount = 0
    if (c.charge_type === "percentage") {
      amount = personSubtotal * (Number(c.charge_value) / 100)
    } else {
      amount =
        totalSessionSubtotal > 0
          ? (personSubtotal / totalSessionSubtotal) * Number(c.charge_value)
          : 0
    }
    return { ...c, charge_value: Number(c.charge_value), amount }
  })
}

// Human-readable label for a charge, e.g. "SST (6%)" or "Tip (RM 5.00)".
// Falls back to a generic "Charge" prefix when no label was provided.
export function formatChargeLabel(c: ChargeLike): string {
  const base = c.label && c.label.trim() ? c.label.trim() : "Charge"
  const suffix =
    c.charge_type === "percentage"
      ? `(${c.charge_value}%)`
      : `(RM ${Number(c.charge_value).toFixed(2)})`
  return `${base} ${suffix}`
}

// Full bill breakdown using a charge list (replaces calculateBill for the
// unified-charges model; calculateBill is kept for any legacy callers).
export function calculateBillWithCharges(
  personSubtotal: number,
  totalSessionSubtotal: number,
  charges: ChargeLike[]
): {
  subtotal: number
  chargeLines: ChargeLine[]
  totalCharges: number
  total: number
} {
  const chargeLines = computeChargeLines(
    personSubtotal,
    totalSessionSubtotal,
    charges
  )
  const totalCharges = chargeLines.reduce((s, l) => s + l.amount, 0)
  return {
    subtotal: personSubtotal,
    chargeLines,
    totalCharges,
    total: personSubtotal + totalCharges,
  }
}

// Format date smartly - "today", "yesterday", or full date
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