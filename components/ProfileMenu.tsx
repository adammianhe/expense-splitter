"use client"

import { useEffect, useState } from "react"
import { Loader2, LogOut } from "lucide-react"
import { motion } from "framer-motion"
import { useAuth } from "@/contexts/AuthContext"

type Props = {
  onClose: () => void
  onSignedOut: () => void
}

export default function ProfileMenu({ onClose, onSignedOut }: Props) {
  const { user, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
    onClose()
    onSignedOut()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Profile menu"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* User info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">
                {user?.email?.[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 text-sm truncate">
                {user?.email}
              </p>
              <p className="text-xs text-gray-400">Signed in</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition text-2xl leading-none ml-4 flex-shrink-0"
          >
            ×
          </button>
        </div>

        <div className="border-t border-gray-100" />

        <motion.button
          whileTap={!signingOut ? { scale: 0.92, opacity: 0.85 } : undefined}
          whileHover={!signingOut ? { scale: 1.02 } : undefined}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {signingOut ? (
            <Loader2 size={16} className="animate-spin text-gray-500" />
          ) : (
            <LogOut size={16} className="text-gray-500" />
          )}
          <span className="font-medium text-sm text-gray-700">
            {signingOut ? "Signing out..." : "Sign Out"}
          </span>
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
