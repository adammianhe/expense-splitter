"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Clock, Info, Search, X } from "lucide-react"
import { SessionHistoryItem } from "@/hooks/useSessionHistory"
import { Skeleton } from "@/components/ui/Skeleton"
import { getRelativeTime } from "@/lib/timeUtils"
import { removeStoredSession } from "@/lib/sessionHistory"
import { removeUserSession } from "@/lib/userSessionsApi"
import { useAuth } from "@/contexts/AuthContext"
import { Tooltip } from "@/components/ui/Tooltip"
import {
  filterByStatus,
  filterBySearch,
  filterByTime,
  sortSessions,
  groupByStatus,
  StatusFilter,
  TimeFilter,
  SortOption,
} from "@/lib/sessionUtils"

type Props = {
  sessions: SessionHistoryItem[]
  loading?: boolean
  onClose: () => void
  onRemoved?: (item: SessionHistoryItem) => void
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "settled", label: "Settled" },
]

function SessionCard({
  item,
  onRemove,
}: {
  item: SessionHistoryItem
  onRemove: (e: React.MouseEvent) => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, marginBottom: 12 }}
      animate={{ opacity: 1, y: 0, marginBottom: 12 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <div className="relative">
        <Link href={`/session/${item.sessionId}`} className="block">
          <motion.div
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="border border-gray-200 bg-white hover:border-gray-300 rounded-xl p-4 pr-10 space-y-1.5 shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <span className="font-semibold truncate block leading-tight text-gray-900">
              {item.sessionName}
            </span>

            <p className="text-xs text-gray-400">{getRelativeTime(item.joinedAt)}</p>

            <div>
              <span
                className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                  item.role === "owner"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {item.role === "owner" ? "Owner" : "Friend"}
              </span>
            </div>

            <div>
              {item.status === "settled" ? (
                <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                  <Check size={14} />
                  Settled
                </span>
              ) : item.status === "pending" ? (
                <span className="flex items-center gap-1 text-sm text-orange-600 font-medium">
                  <Clock size={14} />
                  {item.role === "owner"
                    ? `RM ${item.outstandingAmount.toFixed(2)} outstanding`
                    : `Pay RM ${item.outstandingAmount.toFixed(2)}`}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-blue-600 font-medium">
                  <Info size={14} />
                  {item.role === "owner" ? "All paid" : "You're paid up"}
                </span>
              )}
            </div>
          </motion.div>
        </Link>

        <div className="absolute top-3 right-3 z-10">
          <Tooltip content="Remove from list">
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove session"
              className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-100 transition"
            >
              <X size={16} />
            </button>
          </Tooltip>
        </div>
      </div>
    </motion.div>
  )
}

export default function SessionsOverlay({
  sessions,
  loading = false,
  onClose,
  onRemoved,
}: Props) {
  const { user } = useAuth()
  const [rawQuery, setRawQuery] = useState("")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all")
  const [sortBy, setSortBy] = useState<SortOption>("recent")

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery), 300)
    return () => clearTimeout(t)
  }, [rawQuery])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  // Instant remove — no manual collapse choreography. `sessions` is already
  // pre-filtered by the parent's shared removedIds set, so once onRemoved
  // triggers that update, the item drops out of the mapped array and
  // AnimatePresence below plays the exit animation automatically.
  const handleRemove = (item: SessionHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    removeStoredSession(item.sessionId)
    if (user) {
      removeUserSession({ userId: user.id, sessionId: item.sessionId }).catch(() => {
        // best effort — local removal already succeeded
      })
    }

    onRemoved?.(item)
  }

  const filtered = useMemo(() => {
    let result = filterBySearch(sessions, query)
    result = filterByStatus(result, statusFilter)
    result = filterByTime(result, timeFilter)
    result = sortSessions(result, sortBy)
    return result
  }, [sessions, query, statusFilter, timeFilter, sortBy])

  const { active, settled } = groupByStatus(filtered)

  const showGrouped = statusFilter === "all"

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Your Sessions"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white w-full h-[100dvh] sm:h-[90vh] sm:max-w-4xl sm:rounded-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed header */}
        <div className="flex-shrink-0 border-b border-gray-100 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Your Sessions</h2>
            <Tooltip content="Close">
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600 transition -mr-2 p-2.5 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </Tooltip>
          </div>

          {/* Search */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="Search sessions..."
              className="w-full pl-10 pr-9 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black"
            />
            {rawQuery && (
              <button
                onClick={() => setRawQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="space-y-2">
            {/* Row 1: status chips */}
            <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    statusFilter === opt.value
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Row 2: time + sort, equal width */}
            <div className="flex gap-2">
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border-none focus:outline-none focus:ring-1 focus:ring-black"
              >
                <option value="all">All time</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="year">This year</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border-none focus:outline-none focus:ring-1 focus:ring-black"
              >
                <option value="recent">Recent</option>
                <option value="oldest">Oldest</option>
                <option value="alphabetical">A-Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white border border-gray-200 rounded-xl p-4 space-y-2"
                >
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-12">
              No sessions yet. Create your first session to get started.
            </p>
          ) : filtered.length === 0 && query.trim() ? (
            <p className="text-center text-sm text-gray-500 py-12">
              No sessions match &quot;{query.trim()}&quot;. Try a different search.
            </p>
          ) : filtered.length === 0 && statusFilter === "active" ? (
            <p className="text-center text-sm text-gray-500 py-12">
              No active sessions. All your bills are settled!
            </p>
          ) : filtered.length === 0 && statusFilter === "settled" ? (
            <p className="text-center text-sm text-gray-500 py-12">
              No settled sessions yet.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-12">
              No sessions match the current filters.
            </p>
          ) : showGrouped ? (
            <div className="space-y-6">
              {active.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Active ({active.length})
                  </p>
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {active.map((item) => (
                        <SessionCard key={item.sessionId} item={item} onRemove={(e) => handleRemove(item, e)} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
              {settled.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Settled ({settled.length})
                  </p>
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {settled.map((item) => (
                        <SessionCard key={item.sessionId} item={item} onRemove={(e) => handleRemove(item, e)} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((item) => (
                  <SessionCard key={item.sessionId} item={item} onRemove={(e) => handleRemove(item, e)} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
