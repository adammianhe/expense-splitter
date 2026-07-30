"use client"

import { Suspense, useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/useToast"
import ToastContainer from "@/components/ui/ToastContainer"
import { supabase } from "@/lib/supabase"

function normalizeError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes("password should be at least"))
    return "Password must be at least 6 characters."
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed"))
    return "Couldn't connect. Try again."
  return msg
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { updatePassword } = useAuth()
  const { toasts, showToast, dismissToast } = useToast()

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [ready, setReady] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const code = searchParams.get("code")
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setErrorMsg(normalizeError(error.message))
        setReady(true)
      })
    } else {
      // Implicit flow: supabase-js reads the recovery token from the URL hash automatically
      setReady(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [ready])

  const passwordValid = password.length >= 6
  const passwordsMatch = password === confirmPassword
  const canSubmit = passwordValid && passwordsMatch && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setErrorMsg("")
    const result = await updatePassword(password)
    setSubmitting(false)
    if (result.error) {
      setErrorMsg(normalizeError(result.error))
      return
    }
    showToast("Password updated", "success")
    setTimeout(() => router.replace("/"), 800)
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 size={28} className="animate-spin text-gray-500" />
        <p className="text-sm text-gray-500">Verifying link...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Set new password</h1>
          <p className="text-sm text-gray-500 mt-1">Choose a new password for your account</p>
        </div>

        <div className="space-y-1">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
              placeholder="New password"
              disabled={submitting}
              className="w-full px-4 py-3 pr-11 text-base border border-gray-300 rounded-xl focus:outline-none focus:border-black transition disabled:bg-gray-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 px-1">
            {password.length > 0 && !passwordValid ? "Must be at least 6 characters" : "At least 6 characters"}
          </p>
        </div>

        <div className="space-y-1">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
            placeholder="Confirm password"
            disabled={submitting}
            className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:border-black transition disabled:bg-gray-50"
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-xs text-red-500 px-1">Passwords don't match</p>
          )}
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 text-sm text-red-500 px-1">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" /> Updating...</>
          ) : (
            "Update Password"
          )}
        </button>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
