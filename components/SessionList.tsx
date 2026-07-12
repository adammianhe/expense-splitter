"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, Clock, Info, RefreshCw, X } from "lucide-react"
import { motion } from "framer-motion"
import { SessionHistoryItem } from "@/hooks/useSessionHistory"
import { removeStoredSession } from "@/lib/sessionHistory"
import { removeUserSession } from "@/lib/userSessionsApi"
import { useAuth } from "@/contexts/AuthContext"
import { Skeleton } from "@/components/ui/Skeleton"
import { getRelativeTime } from "@/lib/timeUtils"

type Props = {
  items: SessionHistoryItem[]
  loading: boolean
  storedCount: number
  onRemoved?: (item: SessionHistoryItem) => void
  onBecameEmpty?: () => void
  onRefresh?: () => void
}

export default function SessionList({
  items,
  loading,
  storedCount,
  onRemoved,
  onBecameEmpty,
  onRefresh,
}: Props) {
  const { user } = useAuth()
  const [showStale, setShowStale] = useState(false)
  const [removedIds, setRemovedIds] = useState(new Set<string>())
  const [dismissingIds, setDismissingIds] = useState(new Set<string>())
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const removedIdsRef = useRef(new Set<string>())

  // Reset local removal state when parent refreshes items
  useEffect(() => {
    removedIdsRef.current = new Set()
    setRemovedIds(new Set())
    setDismissingIds(new Set())
    setBannerDismissed(false)
  }, [items])

  const handleRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    onRefresh?.()
    setTimeout(() => setRefreshing(false), 800)
  }

  const handleRemove = (e: React.MouseEvent, item: SessionHistoryItem, skipConfirm = false) => {
    e.preventDefault()

    if (
      !skipConfirm &&
      !window.confirm(
        "Remove from your list? The session itself isn't deleted. You can still access it via the link."
      )
    )
      return

    setDismissingIds((prev) => new Set(prev).add(item.sessionId))

    setTimeout(() => {
      removeStoredSession(item.sessionId)
      if (user) {
        removeUserSession({ userId: user.id, sessionId: item.sessionId }).catch(
          () => {
            // best effort — local removal already succeeded
          }
        )
      }

      const next = new Set(removedIdsRef.current).add(item.sessionId)
      removedIdsRef.current = next
      setRemovedIds(new Set(next))
      setDismissingIds((prev) => {
        const n = new Set(prev)
        n.delete(item.sessionId)
        return n
      })

      onRemoved?.(item)

      const active = items.filter((i) => !i.isStale)
      const stillVisible = active.filter((i) => !next.has(i.sessionId))
      if (stillVisible.length === 0) onBecameEmpty?.()
    }, 300)
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    if (storedCount === 0) return null

    const skeletonCount = Math.min(storedCount, 3)
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 mb-3"
          >
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    )
  }

  const active = items.filter((i) => !i.isStale)
  const stale = items.filter((i) => i.isStale)
  const visibleActive = active.filter((i) => !removedIds.has(i.sessionId))
  const hasErrors = visibleActive.some((i) => i.fetchError)

  if (visibleActive.length === 0 && stale.length === 0) return null

  return (
    <div>
      {/* Error banner */}
      {hasErrors && !bannerDismissed && (
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-3 text-sm text-yellow-800">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <span className="flex-1">
            Couldn't load latest status. Showing saved info.
          </span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="text-yellow-600 hover:text-yellow-800 transition flex-shrink-0"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {visibleActive.length > 0 && (
        <>
          {/* Header + refresh button */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Your Sessions
            </p>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh"
              className="p-1 text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
          </div>

          {active
            .filter((i) => !removedIds.has(i.sessionId))
            .map((item, index) => {
              const dismissing = dismissingIds.has(item.sessionId)
              return (
                <motion.div
                  key={item.sessionId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className={`transition-all duration-300 ease-out overflow-hidden ${
                    dismissing
                      ? "opacity-0 scale-95 max-h-0 pb-0"
                      : "opacity-100 max-h-[300px] pb-3"
                  }`}
                >
                  <div className="relative">
                    <Link
                      href={`/session/${item.sessionId}`}
                      className="block"
                    >
                    <motion.div
                      whileTap={{ scale: 0.97 }}
                      whileHover={{ scale: 1.01 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className={`border rounded-xl p-4 space-y-1.5 pr-10 cursor-pointer
                        shadow-sm hover:shadow-md transition-shadow duration-200
                        ${item.fetchError
                          ? "bg-gray-50 border-gray-200"
                          : "bg-white border-gray-200 hover:border-gray-300"
                        }`}
                    >
                      <span
                        className={`font-semibold truncate block leading-tight ${
                          item.fetchError ? "text-gray-500" : "text-gray-900"
                        }`}
                      >
                        {item.sessionName}
                      </span>

                      <p className="text-xs text-gray-400">
                        {getRelativeTime(item.joinedAt)}
                      </p>

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
                        {item.fetchError ? (
                          <span className="flex items-center gap-1 text-sm text-gray-400">
                            <AlertTriangle size={14} />
                            Status unavailable
                          </span>
                        ) : item.status === "settled" ? (
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
                            {item.role === "owner"
                              ? "All paid"
                              : "You're paid up"}
                          </span>
                        )}
                      </div>
                    </motion.div>
                    </Link>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => handleRemove(e, item)}
                      aria-label="Remove session"
                      className="absolute top-0 right-0 p-2 text-gray-400 hover:text-red-500 transition z-10"
                    >
                      <X size={16} />
                    </motion.button>
                  </div>
                </motion.div>
              )
            })}
        </>
      )}

      {/* Stale sessions */}
      {stale.filter((i) => !removedIds.has(i.sessionId)).length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowStale(!showStale)}
            className="text-xs text-gray-500 hover:text-gray-700 transition"
          >
            {showStale ? "Hide" : "Show"}{" "}
            {stale.filter((i) => !removedIds.has(i.sessionId)).length} unavailable{" "}
            {stale.filter((i) => !removedIds.has(i.sessionId)).length === 1
              ? "session"
              : "sessions"}
          </button>

          {showStale && (
            <div className="mt-2 space-y-2">
              {stale
                .filter((i) => !removedIds.has(i.sessionId))
                .map((item) => (
                  <div
                    key={item.sessionId}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm text-gray-500 line-through">
                        {item.sessionName}
                      </p>
                      <p className="text-xs text-gray-400">
                        Session no longer available
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleRemove(e, item, true)}
                      aria-label="Remove session"
                      className="text-gray-400 hover:text-red-500 p-2"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
