"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle, Eye, EyeOff, Lightbulb, Loader2, Mail } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/contexts/AuthContext"

type Props = {
  onClose: () => void
  onSuccess?: (message: string) => void
}

type View = "signin" | "signup" | "forgot" | "magiclink" | "sent"
type SentFrom = "magiclink" | "forgot"

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function normalizeError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes("invalid login credentials"))
    return "Wrong email or password."
  if (lower.includes("user already registered"))
    return "This email already has an account. Sign in instead."
  if (lower.includes("password should be at least"))
    return "Password must be at least 6 characters."
  if (lower.includes("rate") || lower.includes("limit") || lower.includes("429"))
    return "Too many requests. Please wait a few minutes."
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed"))
    return "Couldn't connect. Try again."
  return msg
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="Close"
      className="text-gray-400 hover:text-gray-600 transition ml-4 text-2xl leading-none flex-shrink-0"
    >
      ×
    </button>
  )
}

function EmailInput({
  email,
  setEmail,
  emailError,
  submitting,
  inputRef,
  autoFocus,
}: {
  email: string
  setEmail: (v: string) => void
  emailError: string
  submitting: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  autoFocus?: boolean
}) {
  return (
    <div className="space-y-1">
      <input
        ref={autoFocus ? inputRef : undefined}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        disabled={submitting}
        className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:outline-none focus:border-black transition disabled:bg-gray-50"
      />
      {emailError && <p className="text-xs text-red-500 px-1">{emailError}</p>}
    </div>
  )
}

function PasswordInput({
  password,
  setPassword,
  showPassword,
  setShowPassword,
  submitting,
  onEnter,
  autoComplete,
  showHint,
  passwordError,
}: {
  password: string
  setPassword: (v: string) => void
  showPassword: boolean
  setShowPassword: (fn: (v: boolean) => boolean) => void
  submitting: boolean
  onEnter: () => void
  autoComplete: "current-password" | "new-password"
  showHint: boolean
  passwordError: string
}) {
  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onEnter() }}
          placeholder="Password"
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
      {showHint && (
        <p className="text-xs text-gray-400 px-1">
          {passwordError || "At least 6 characters"}
        </p>
      )}
    </div>
  )
}

function ErrorText({ errorMsg }: { errorMsg: string }) {
  return errorMsg ? (
    <div className="flex items-start gap-2 text-sm text-red-500 px-1">
      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
      <span>{errorMsg}</span>
    </div>
  ) : null
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A8.62 8.62 0 0 0 9 0 9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  )
}

function GoogleButton({
  onClick,
  loading,
}: {
  onClick: () => void
  loading: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-xl py-3 px-4 hover:bg-gray-50 transition font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
      {loading ? "Redirecting..." : "Continue with Google"}
    </button>
  )
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400">or</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

export default function SignInModal({ onClose, onSuccess }: Props) {
  const isIOS =
    typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent)
  const { signIn, signUpWithPassword, signInWithPassword, signInWithGoogle, resetPassword } = useAuth()
  const [view, setView] = useState<View>("signin")
  const [sentFrom, setSentFrom] = useState<SentFrom>("magiclink")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [countdown, setCountdown] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [view])

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

  const emailValid = isValidEmail(email)
  const passwordValid = password.length >= 6
  const emailTouched = email.length > 0
  const passwordTouched = password.length > 0
  const emailError = emailTouched && !emailValid ? "Enter a valid email address" : ""
  const passwordError =
    passwordTouched && !passwordValid && (view === "signup")
      ? "Must be at least 6 characters"
      : ""

  const goTo = (v: View) => {
    setErrorMsg("")
    setPassword("")
    setView(v)
  }

  const handleSignIn = async () => {
    if (!emailValid || password.length === 0) return
    setSubmitting(true)
    setErrorMsg("")
    const result = await signInWithPassword(email.trim(), password)
    setSubmitting(false)
    if (result.error) {
      setErrorMsg(normalizeError(result.error))
    } else {
      onSuccess?.("Signed in successfully")
      onClose()
    }
  }

  const handleSignUp = async () => {
    if (!emailValid || !passwordValid) return
    setSubmitting(true)
    setErrorMsg("")
    const result = await signUpWithPassword(email.trim(), password)
    setSubmitting(false)
    if (result.error) {
      setErrorMsg(normalizeError(result.error))
    } else {
      onSuccess?.("Account created")
      onClose()
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setErrorMsg("")
    const result = await signInWithGoogle()
    if (result.error) {
      setGoogleLoading(false)
      setErrorMsg(normalizeError(result.error))
    }
    // On success, browser redirects to Google — stay in loading state.
  }

  const handleMagicLink = async () => {
    if (!emailValid) return
    setSubmitting(true)
    setErrorMsg("")
    const result = await signIn(email.trim())
    setSubmitting(false)
    if (result.error) {
      setErrorMsg(normalizeError(result.error))
    } else {
      setSentFrom("magiclink")
      setView("sent")
      setCountdown(30)
    }
  }

  const handleForgot = async () => {
    if (!emailValid) return
    setSubmitting(true)
    setErrorMsg("")
    const result = await resetPassword(email.trim())
    setSubmitting(false)
    if (result.error) {
      setErrorMsg(normalizeError(result.error))
    } else {
      onSuccess?.("Reset link sent to your email")
      setSentFrom("forgot")
      setView("sent")
      setCountdown(30)
    }
  }

  const handleResend = () => {
    if (sentFrom === "magiclink") handleMagicLink()
    else handleForgot()
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
        <AnimatePresence mode="wait">
          {/* ── SIGN IN ── */}
          {view === "signin" && (
            <motion.div
              key="signin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Sign in to Splitto</h2>
                  <p className="text-sm text-gray-500 mt-1">Sync your sessions across devices</p>
                </div>
                <CloseButton onClose={onClose} />
              </div>

              <GoogleButton onClick={handleGoogleSignIn} loading={googleLoading} />
              <OrDivider />

              <EmailInput email={email} setEmail={setEmail} emailError={emailError} submitting={submitting} inputRef={inputRef} autoFocus />
              <PasswordInput password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword} submitting={submitting} onEnter={handleSignIn} autoComplete="current-password" showHint={false} passwordError={passwordError} />
              <ErrorText errorMsg={errorMsg} />

              <motion.button
                whileTap={emailValid && password.length > 0 && !submitting ? { scale: 0.94, opacity: 0.85 } : undefined}
                whileHover={emailValid && password.length > 0 && !submitting ? { scale: 1.02 } : undefined}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                onClick={handleSignIn}
                disabled={!emailValid || password.length === 0 || submitting}
                className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Signing in...</>
                ) : (
                  "Sign In"
                )}
              </motion.button>

              <button
                onClick={() => goTo("forgot")}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition text-center"
              >
                Forgot password?
              </button>

              <OrDivider />

              <button
                onClick={() => goTo("magiclink")}
                className="w-full text-sm text-gray-600 hover:text-gray-900 transition text-center font-medium"
              >
                Email me a link instead
              </button>

              <p className="text-sm text-gray-400 text-center">
                New here?{" "}
                <button onClick={() => goTo("signup")} className="text-gray-900 font-medium hover:underline">
                  Create account
                </button>
              </p>
            </motion.div>
          )}

          {/* ── SIGN UP ── */}
          {view === "signup" && (
            <motion.div
              key="signup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Create your account</h2>
                  <p className="text-sm text-gray-500 mt-1">Start syncing across devices</p>
                </div>
                <CloseButton onClose={onClose} />
              </div>

              <GoogleButton onClick={handleGoogleSignIn} loading={googleLoading} />
              <OrDivider />

              <EmailInput email={email} setEmail={setEmail} emailError={emailError} submitting={submitting} inputRef={inputRef} autoFocus />
              <PasswordInput password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword} submitting={submitting} onEnter={handleSignUp} autoComplete="new-password" showHint={true} passwordError={passwordError} />
              <ErrorText errorMsg={errorMsg} />

              <motion.button
                whileTap={emailValid && passwordValid && !submitting ? { scale: 0.94, opacity: 0.85 } : undefined}
                whileHover={emailValid && passwordValid && !submitting ? { scale: 1.02 } : undefined}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                onClick={handleSignUp}
                disabled={!emailValid || !passwordValid || submitting}
                className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Creating account...</>
                ) : (
                  "Create Account"
                )}
              </motion.button>

              <p className="text-sm text-gray-400 text-center">
                Already have an account?{" "}
                <button onClick={() => goTo("signin")} className="text-gray-900 font-medium hover:underline">
                  Sign in
                </button>
              </p>
            </motion.div>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {view === "forgot" && (
            <motion.div
              key="forgot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Reset your password</h2>
                  <p className="text-sm text-gray-500 mt-1">We'll email you a reset link</p>
                </div>
                <CloseButton onClose={onClose} />
              </div>

              <EmailInput email={email} setEmail={setEmail} emailError={emailError} submitting={submitting} inputRef={inputRef} autoFocus />
              <ErrorText errorMsg={errorMsg} />

              <motion.button
                whileTap={emailValid && !submitting ? { scale: 0.94, opacity: 0.85 } : undefined}
                whileHover={emailValid && !submitting ? { scale: 1.02 } : undefined}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                onClick={handleForgot}
                disabled={!emailValid || submitting}
                className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Sending...</>
                ) : (
                  "Send Reset Link"
                )}
              </motion.button>

              <button
                onClick={() => goTo("signin")}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition text-center"
              >
                Back to sign in
              </button>
            </motion.div>
          )}

          {/* ── MAGIC LINK ── */}
          {view === "magiclink" && (
            <motion.div
              key="magiclink"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Sign in with a link</h2>
                  <p className="text-sm text-gray-500 mt-1">No password needed</p>
                </div>
                <CloseButton onClose={onClose} />
              </div>

              <EmailInput email={email} setEmail={setEmail} emailError={emailError} submitting={submitting} inputRef={inputRef} autoFocus />
              <ErrorText errorMsg={errorMsg} />

              <motion.button
                whileTap={emailValid && !submitting ? { scale: 0.94, opacity: 0.85 } : undefined}
                whileHover={emailValid && !submitting ? { scale: 1.02 } : undefined}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                onClick={handleMagicLink}
                disabled={!emailValid || submitting}
                className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Sending...</>
                ) : (
                  "Send Magic Link"
                )}
              </motion.button>

              <button
                onClick={() => goTo("signin")}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition text-center"
              >
                Back to password sign in
              </button>
            </motion.div>
          )}

          {/* ── SENT ── */}
          {view === "sent" && (
            <motion.div
              key="sent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              <div className="flex justify-end">
                <CloseButton onClose={onClose} />
              </div>

              <div className="text-center space-y-3 py-2">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Mail size={24} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Check your email</h2>
                <p className="text-sm text-gray-600">
                  We sent a link to{" "}
                  <span className="font-medium text-gray-900">{email}</span>
                </p>
              </div>

              <button
                onClick={handleResend}
                disabled={countdown > 0 || submitting}
                className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 size={14} className="animate-spin" /> Sending...</>
                ) : countdown > 0 ? (
                  `Resend in ${countdown}s`
                ) : (
                  "Resend"
                )}
              </button>

              <button
                onClick={() => { setCountdown(0); goTo(sentFrom === "magiclink" ? "magiclink" : "forgot") }}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition py-1"
              >
                Use a different email
              </button>

              <motion.button
                whileTap={{ scale: 0.94, opacity: 0.85 }}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                onClick={onClose}
                className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition"
              >
                Close
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {isIOS && view !== "sent" && (
          <div className="flex items-start gap-2 bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
            <Lightbulb size={14} className="flex-shrink-0 mt-0.5 text-gray-400" />
            <span>iPhone tip: sign in from Safari before adding Splitto to your home screen.</span>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
