import { SessionHistoryItem } from "@/hooks/useSessionHistory"

export type StatusFilter = "all" | "active" | "settled"
export type TimeFilter = "all" | "week" | "month" | "year"
export type SortOption = "recent" | "oldest" | "alphabetical"

export function isSettled(item: SessionHistoryItem): boolean {
  return item.status === "settled"
}

export function filterByStatus(
  items: SessionHistoryItem[],
  filter: StatusFilter
): SessionHistoryItem[] {
  if (filter === "all") return items
  return items.filter((i) => (filter === "settled" ? isSettled(i) : !isSettled(i)))
}

export function filterByTime(
  items: SessionHistoryItem[],
  timeFilter: TimeFilter
): SessionHistoryItem[] {
  if (timeFilter === "all") return items
  const now = Date.now()
  const ranges: Record<Exclude<TimeFilter, "all">, number> = {
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  }
  const window = ranges[timeFilter]
  return items.filter((i) => now - new Date(i.createdAt).getTime() <= window)
}

export function filterBySearch(
  items: SessionHistoryItem[],
  query: string
): SessionHistoryItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((i) => i.sessionName.toLowerCase().includes(q))
}

export function sortSessions(
  items: SessionHistoryItem[],
  sortBy: SortOption
): SessionHistoryItem[] {
  const sorted = [...items]
  switch (sortBy) {
    case "recent":
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    case "oldest":
      return sorted.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    case "alphabetical":
      return sorted.sort((a, b) => a.sessionName.localeCompare(b.sessionName))
    default:
      return sorted
  }
}

export function groupByStatus(items: SessionHistoryItem[]): {
  active: SessionHistoryItem[]
  settled: SessionHistoryItem[]
} {
  return {
    active: items.filter((i) => !isSettled(i)),
    settled: items.filter(isSettled),
  }
}
