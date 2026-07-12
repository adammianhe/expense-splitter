export type PendingSync = {
  sessionId: string
  participantId: string
  role: "owner" | "friend"
  joinedAt: string
  attemptedAt: string
}

const RETRY_QUEUE_KEY = "splitto:sync_retry_queue"

function readRaw(): PendingSync[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(RETRY_QUEUE_KEY) || "[]")
  } catch {
    return []
  }
}

export function addToRetryQueue(item: PendingSync): void {
  if (typeof window === "undefined") return
  try {
    const existing = readRaw().filter((s) => s.sessionId !== item.sessionId)
    const updated = [item, ...existing]
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(updated))
  } catch {
    // best effort
  }
}

export function getRetryQueue(): PendingSync[] {
  return readRaw()
}

export function removeFromRetryQueue(sessionId: string): void {
  if (typeof window === "undefined") return
  try {
    const updated = readRaw().filter((s) => s.sessionId !== sessionId)
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(updated))
  } catch {
    // best effort
  }
}

export function clearRetryQueue(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(RETRY_QUEUE_KEY)
  } catch {
    // best effort
  }
}
