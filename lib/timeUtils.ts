export function getRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMs / 3600000)
  if (diffHours < 24) return `${diffHours}h ago`

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const daysDiff = Math.floor((today.getTime() - dDate.getTime()) / 86400000)

  if (daysDiff === 1) return "Yesterday"
  if (daysDiff < 7) return `${daysDiff}d ago`
  if (daysDiff < 30) return `${Math.floor(daysDiff / 7)}w ago`
  return "Long ago"
}
