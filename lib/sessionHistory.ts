export type StoredSession = {
  sessionId: string
  participantId: string
  role: "owner" | "friend"
  sessionName: string
  joinedAt: string
}

const KEY = "splitto:sessions"
const MAX = 50

function readRaw(): StoredSession[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]")
  } catch {
    return []
  }
}

export function getStoredSessions(): StoredSession[] {
  return readRaw()
}

export function addStoredSession(session: StoredSession): void {
  if (typeof window === "undefined") return
  try {
    const existing = readRaw().filter((s) => s.sessionId !== session.sessionId)
    const updated = [session, ...existing].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(updated))
  } catch {
    // best effort
  }
}

export function removeStoredSession(sessionId: string): void {
  if (typeof window === "undefined") return
  try {
    const updated = readRaw().filter((s) => s.sessionId !== sessionId)
    localStorage.setItem(KEY, JSON.stringify(updated))
  } catch {
    // best effort
  }
}

export function clearAllStoredSessions(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(KEY)
  } catch {
    // best effort
  }
}
