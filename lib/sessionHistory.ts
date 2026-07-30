export type StoredSession = {
  sessionId: string
  participantId: string
  role: "owner" | "friend"
  sessionName: string
  joinedAt: string
  lastVisitedAt?: string
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
    const withVisited: StoredSession = {
      ...session,
      lastVisitedAt: session.lastVisitedAt || session.joinedAt,
    }
    const updated = [withVisited, ...existing].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(updated))
  } catch {
    // best effort
  }
}

export function updateLastVisited(sessionId: string): void {
  if (typeof window === "undefined") return
  try {
    const updated = readRaw().map((s) =>
      s.sessionId === sessionId
        ? { ...s, lastVisitedAt: new Date().toISOString() }
        : s
    )
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
