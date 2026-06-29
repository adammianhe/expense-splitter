"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import AppHeader from "@/components/AppHeader"
import HowItWorksModal from "@/components/HowItWorksModal"
import { useSessionHistory, SessionHistoryItem } from "@/hooks/useSessionHistory"
import { addStoredSession } from "@/lib/sessionHistory"
import SessionList from "@/components/SessionList"

type AuthToast = { type: "success" | "error"; message: string }


export default function HomePage() {
  const { items, loading, storedCount, refresh } = useSessionHistory()

  const [forceFirstTimer, setForceFirstTimer] = useState(false)
  const [cleaningUp, setCleaningUp] = useState(false)

  const [undoItem, setUndoItem] = useState<SessionHistoryItem | null>(null)
  const [undoVisible, setUndoVisible] = useState(false)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [showHowItWorks, setShowHowItWorks] = useState(false)

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
    !forceFirstTimer &&
    ((loading && storedCount > 0) || items.some((i) => !i.isStale))

  const handleBecameEmpty = () => {
    setCleaningUp(true)
    setTimeout(() => {
      setCleaningUp(false)
      setForceFirstTimer(true)
    }, 600)
  }

  const handleRemoved = (item: SessionHistoryItem) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)

    setUndoItem(item)
    setUndoVisible(true)

    undoTimerRef.current = setTimeout(() => {
      setUndoVisible(false)
      setTimeout(() => setUndoItem(null), 300)
    }, 5000)
  }

  const handleUndo = () => {
    if (!undoItem) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)

    addStoredSession({
      sessionId: undoItem.sessionId,
      participantId: undoItem.participantId,
      role: undoItem.role,
      sessionName: undoItem.sessionName,
      joinedAt: undoItem.joinedAt,
    })

    setUndoVisible(false)
    setTimeout(() => setUndoItem(null), 300)
    setForceFirstTimer(false)
    setCleaningUp(false)
    refresh()
  }

  return (
    <>
      <AppHeader />

      {/* Undo bar */}
      {undoItem && (
        <div
          className={`fixed top-[60px] left-0 right-0 z-40 flex justify-center px-4 transition-all duration-300 ${
            undoVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-1 pointer-events-none"
          }`}
        >
          <div className="max-w-md w-full mt-2">
            <div className="bg-gray-900 text-white text-sm rounded-xl px-4 py-3 flex items-center justify-between shadow-lg">
              <span>Removed from your list.</span>
              <button
                onClick={handleUndo}
                className="ml-4 font-semibold text-yellow-300 hover:text-yellow-200 transition flex-shrink-0"
              >
                Undo
              </button>
            </div>
          </div>
        </div>
      )}

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
              <p className="text-sm text-gray-500 mt-1">No login, no install, just share a link.</p>
            </div>

            <motion.div
              whileTap={{ scale: 0.92, opacity: 0.85 }}
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
              items={items}
              loading={loading}
              storedCount={storedCount}
              onRemoved={handleRemoved}
              onBecameEmpty={handleBecameEmpty}
              onRefresh={refresh}
            />
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
            <div className="space-y-3">
              <h1 className="text-4xl font-bold text-gray-900">Split Bill, No Drama</h1>
              <p className="text-gray-600">
                Split bills with friends without the headache. No login, no
                install, just share a link.
              </p>
            </div>

            <motion.div
              whileTap={{ scale: 0.92, opacity: 0.85 }}
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
    </>
  )
}
