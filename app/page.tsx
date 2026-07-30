"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import AppHeader from "@/components/AppHeader"
import HowItWorksModal from "@/components/HowItWorksModal"
import SignInModal from "@/components/SignInModal"
import SignInBanner from "@/components/SignInBanner"
import { useSessionHistory, SessionHistoryItem } from "@/hooks/useSessionHistory"
import { addStoredSession } from "@/lib/sessionHistory"
import { addUserSession } from "@/lib/userSessionsApi"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/useToast"
import ToastContainer from "@/components/ui/ToastContainer"
import SessionList from "@/components/SessionList"
import SessionsOverlay from "@/components/SessionsOverlay"

type AuthToast = { type: "success" | "error"; message: string }


export default function HomePage() {
  const { user, isSignedIn } = useAuth()
  const { items, loading, storedCount, refresh } = useSessionHistory()

  // localStorage-backed state (storedCount, items) differs between server
  // and client's first paint, so `hasHistory` must not switch layouts until
  // after mount — otherwise the client's first render (which already sees
  // localStorage) diverges from the server-rendered HTML being hydrated.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const [forceFirstTimer, setForceFirstTimer] = useState(false)
  const [cleaningUp, setCleaningUp] = useState(false)

  // Sessions hidden due to removal. Owned here (not inside SessionList /
  // SessionsOverlay) so Undo can be a pure in-memory toggle — no skeleton,
  // no refetch. The underlying `items` array is never mutated by removal;
  // only this set decides what's visible.
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const visibleItems = items.filter((i) => !removedIds.has(i.sessionId))

  const { toasts, showToast, dismissToast } = useToast()

  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [showSessionsOverlay, setShowSessionsOverlay] = useState(false)

  // Auth feedback toasts (set by /auth/callback via sessionStorage)
  const [authToast, setAuthToast] = useState<AuthToast | null>(null)
  const [authToastVisible, setAuthToastVisible] = useState(false)

  // Reset forceFirstTimer when items come back (after undo + refresh)
  useEffect(() => {
    if (items.some((i) => !i.isStale)) setForceFirstTimer(false)
  }, [items])

  // Check sessionStorage for auth result flags set by /auth/callback
  useEffect(() => {
    const justSignedIn = sessionStorage.getItem("splitto:just_signed_in")
    const authError = sessionStorage.getItem("splitto:auth_error")

    let toast: AuthToast | null = null
    if (justSignedIn) {
      sessionStorage.removeItem("splitto:just_signed_in")
      toast = { type: "success", message: "Signed in successfully" }
    } else if (authError) {
      sessionStorage.removeItem("splitto:auth_error")
      toast = { type: "error", message: "Sign in failed. Please try again." }
    }

    if (toast) {
      setAuthToast(toast)
      setAuthToastVisible(true)
      setTimeout(() => {
        setAuthToastVisible(false)
        setTimeout(() => setAuthToast(null), 300)
      }, 3500)
    }
  }, [])

  const hasHistory =
    mounted &&
    !forceFirstTimer &&
    ((loading && storedCount > 0) || visibleItems.some((i) => !i.isStale))

  // Instant restore — the session's data never left `items`, so Undo just
  // un-hides it. NO refresh()/refetch, so no skeleton, no shake.
  const handleUndoRemove = (item: SessionHistoryItem) => {
    addStoredSession({
      sessionId: item.sessionId,
      participantId: item.participantId,
      role: item.role,
      sessionName: item.sessionName,
      joinedAt: item.joinedAt,
    })

    if (user) {
      addUserSession({
        userId: user.id,
        sessionId: item.sessionId,
        participantId: item.participantId,
        role: item.role,
        joinedAt: item.joinedAt,
      }).catch(() => {
        // best effort — local re-add already succeeded
      })
    }

    setRemovedIds((prev) => {
      const next = new Set(prev)
      next.delete(item.sessionId)
      return next
    })

    setForceFirstTimer(false)
    setCleaningUp(false)
  }

  const handleRemoved = (item: SessionHistoryItem) => {
    setRemovedIds((prev) => {
      const next = new Set(prev).add(item.sessionId)
      const stillVisible = items.filter((i) => !i.isStale && !next.has(i.sessionId))
      if (stillVisible.length === 0) {
        setCleaningUp(true)
        setTimeout(() => {
          setCleaningUp(false)
          setForceFirstTimer(true)
        }, 600)
      }
      return next
    })

    showToast("Removed from your list", "info", {
      action: { label: "Undo", onClick: () => handleUndoRemove(item) },
      duration: 5000,
    })
  }

  return (
    <>
      <AppHeader onReload={refresh} />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Auth toast */}
      {authToast && (
        <div
          className={`fixed top-[60px] left-0 right-0 z-40 flex justify-center px-4 transition-all duration-300 ${
            authToastVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-1 pointer-events-none"
          }`}
        >
          <div className="max-w-md w-full mt-2">
            <div
              className={`text-sm rounded-xl px-4 py-3 shadow-lg text-center font-medium ${
                authToast.type === "success"
                  ? "bg-green-900 text-white"
                  : "bg-red-900 text-white"
              }`}
            >
              {authToast.message}
            </div>
          </div>
        </div>
      )}

      {/* Cleaning up overlay */}
      {cleaningUp && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-gray-700" />
            <span className="text-sm text-gray-600">Cleaning up...</span>
          </div>
        </div>
      )}

      {hasHistory ? (
        /* ── RETURNING USER: compact top layout ── */
        <main className="min-h-[calc(100dvh-60px)] p-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="max-w-md mx-auto space-y-6 pt-2"
          >
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Split Bill, No Drama</h1>
              <p className="text-sm text-gray-500 mt-1">No install, just share a link.</p>
            </div>

            <motion.div
              whileTap={{ scale: 0.94, opacity: 0.85 }}
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Link
                href="/create"
                className="inline-block w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition text-center"
              >
                Create New Session
              </Link>
            </motion.div>

            <SessionList
              items={visibleItems}
              loading={loading}
              storedCount={storedCount}
              onRemoved={handleRemoved}
              onRefresh={refresh}
              onSeeAllClick={() => setShowSessionsOverlay(true)}
            />

            {!isSignedIn && visibleItems.filter((i) => !i.isStale).length >= 1 && (
              <SignInBanner onSignInClick={() => setShowSignInModal(true)} />
            )}
          </motion.div>
        </main>
      ) : (
        /* ── FIRST TIMER: centered layout ── */
        <main className="min-h-[calc(100dvh-60px)] flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="max-w-md w-full text-center space-y-6"
          >
            {isSignedIn ? (
              <div className="space-y-3">
                <h1 className="text-4xl font-bold text-gray-900">No sessions yet</h1>
                <p className="text-gray-600">
                  Create your first bill to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <h1 className="text-4xl font-bold text-gray-900">Split Bill, No Drama</h1>
                <p className="text-gray-600">
                  Split bills with friends without the headache. No signup
                  needed to start — just share a link.
                </p>
              </div>
            )}

            <motion.div
              whileTap={{ scale: 0.94, opacity: 0.85 }}
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Link
                href="/create"
                className="inline-block w-full bg-black text-white py-4 rounded-xl font-semibold hover:bg-gray-800 transition"
              >
                Create New Session
              </Link>
            </motion.div>

            {!isSignedIn && (
              <>
                <p className="text-sm text-gray-500">
                  Create a session, share the link, friends tick items, everyone
                  settles up.
                </p>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.03 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => setShowHowItWorks(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors"
                >
                  How it works
                  <ArrowRight size={14} />
                </motion.button>
              </>
            )}
          </motion.div>
        </main>
      )}

      <AnimatePresence>
        {showHowItWorks && (
          <HowItWorksModal
            key="how-it-works"
            onClose={() => setShowHowItWorks(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSignInModal && (
          <SignInModal
            key="signin-banner"
            onClose={() => setShowSignInModal(false)}
            onSuccess={(msg) => showToast(msg, "success")}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSessionsOverlay && (
          <SessionsOverlay
            key="sessions-overlay"
            sessions={visibleItems.filter((i) => !i.isStale)}
            loading={loading && storedCount > 0 && items.length === 0}
            onClose={() => setShowSessionsOverlay(false)}
            onRemoved={handleRemoved}
          />
        )}
      </AnimatePresence>
    </>
  )
}
