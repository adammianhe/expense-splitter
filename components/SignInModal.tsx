"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle, Loader2, Mail } from "lucide-react"
import { motion } from "framer-motion"
import { useAuth } from "@/contexts/AuthContext"

type Props = {
  onClose: () => void
}

type ModalState = "idle" | "sent" | "error"

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function normalizeError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes("rate") || lower.includes("limit") || lower.includes("429"))
    return "Too many requests. Please wait a few minutes."
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed"))
    return "Couldn't reach the server. Check your connection."
  return msg
}

export default function SignInModal({ onClose }: Props) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState("")
  const [state, setState] = useState<ModalState>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [sending, setSending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const sendLink = async () => {
    if (!isValidEmail(email)) return
    setSending(true)
    const result = await signIn(email.trim())
    setSending(false)
    if (result.error) {
      setErrorMsg(normalizeError(result.error))
      setState("error")
    } else {
      setState("sent")
      setCountdown(30)
    }
  }

  const emailTouched = email.length > 0
  const emailValid = isValidEmail(email)
  const emailError = emailTouched && !emailValid ? "Enter a valid email address" : ""

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-2xl w-full max-w-md p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── IDLE STATE ── */}
        {state === "idle" && (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Sign In to Splitto</h2>
                <p className="text-sm text-gray-500 mt-1">
                  We'll email you a magic link. No password needed.
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600 transition ml-4 text-2xl leading-none flex-shrink-0"
              >
                ×
              </button>
            </div>

            <div className="space-y-1">
              <input
                ref={inputRef}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && emailValid && !sending) sendLink() }}
                placeholder="your@email.com"
                disabled={sending}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:border-black transition disabled:bg-gray-50"
              />
              {emailError && (
                <p className="text-xs text-red-500 px-1">{emailError}</p>
              )}
            </div>

            <motion.button
              whileTap={emailValid && !sending ? { scale: 0.96 } : undefined}
              whileHover={emailValid && !sending ? { scale: 1.02 } : undefined}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              onClick={sendLink}
              disabled={!emailValid || sending}
              className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Magic Link"
              )}
            </motion.button>
          </>
        )}

        {/* ── SENT STATE ── */}
        {state === "sent" && (
          <>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600 transition text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="text-center space-y-3 py-2">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Mail size={24} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Check Your Email</h2>
              <p className="text-sm text-gray-600">
                We sent a link to{" "}
                <span className="font-medium text-gray-900">{email}</span>
              </p>
              <p className="text-sm text-gray-400">
                Click the link to sign in. You can close this page.
              </p>
            </div>

            <button
              onClick={sendLink}
              disabled={countdown > 0 || sending}
              className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <><Loader2 size={14} className="animate-spin" /> Sending...</>
              ) : countdown > 0 ? (
                `Resend in ${countdown}s`
              ) : (
                "Resend Link"
              )}
            </button>

            <button
              onClick={() => { setState("idle"); setCountdown(0) }}
              className="w-full text-sm text-gray-400 hover:text-gray-600 transition py-1"
            >
              Use different email
            </button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              onClick={onClose}
              className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition"
            >
              Close
            </motion.button>
          </>
        )}

        {/* ── ERROR STATE ── */}
        {state === "error" && (
          <>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600 transition text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="text-center space-y-3 py-2">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle size={24} className="text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Something Went Wrong</h2>
              <p className="text-sm text-red-500">{errorMsg}</p>
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              onClick={() => setState("idle")}
              className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition"
            >
              Try Again
            </motion.button>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
