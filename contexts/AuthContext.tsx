"use client"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import posthog from "posthog-js"

type AuthContextType = {
  user: User | null
  loading: boolean
  isSignedIn: boolean
  signIn: (email: string) => Promise<{ error?: string }>
  signUpWithPassword: (email: string, password: string) => Promise<{ error?: string }>
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>
  signInWithGoogle: () => Promise<{ error?: string }>
  resetPassword: (email: string) => Promise<{ error?: string }>
  updatePassword: (newPassword: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isSignedIn: false,
  signIn: async () => ({}),
  signUpWithPassword: async () => ({}),
  signInWithPassword: async () => ({}),
  signInWithGoogle: async () => ({}),
  resetPassword: async () => ({}),
  updatePassword: async () => ({}),
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const lastAuthMethod = useRef<"magic_link" | "password" | "google">("magic_link")

  useEffect(() => {
    // Check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Keep in sync with Supabase auth state changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)

      try {
        if (typeof window !== "undefined") {
          if (_event === "SIGNED_IN" && session?.user) {
            posthog.identify(session.user.id, { email: session.user.email })
            posthog.capture("user_signed_in", { method: lastAuthMethod.current })
          } else if (_event === "SIGNED_OUT") {
            posthog.capture("user_signed_out")
            posthog.reset()
          }
        }
      } catch {
        // best effort
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string): Promise<{ error?: string }> => {
    lastAuthMethod.current = "magic_link"
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          (typeof window !== "undefined" ? window.location.origin : "") +
          "/auth/callback",
      },
    })
    if (error) return { error: error.message }
    return {}
  }

  const signUpWithPassword = async (
    email: string,
    password: string
  ): Promise<{ error?: string }> => {
    lastAuthMethod.current = "password"
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message }
    return {}
  }

  const signInWithPassword = async (
    email: string,
    password: string
  ): Promise<{ error?: string }> => {
    lastAuthMethod.current = "password"
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return {}
  }

  const signInWithGoogle = async (): Promise<{ error?: string }> => {
    lastAuthMethod.current = "google"
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          (typeof window !== "undefined" ? window.location.origin : "") +
          "/auth/callback",
      },
    })
    if (error) return { error: error.message }
    return {}
  }

  const resetPassword = async (email: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        (typeof window !== "undefined" ? window.location.origin : "") +
        "/auth/reset-password",
    })
    if (error) return { error: error.message }
    return {}
  }

  const updatePassword = async (newPassword: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: error.message }
    return {}
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isSignedIn: !!user,
        signIn,
        signUpWithPassword,
        signInWithPassword,
        signInWithGoogle,
        resetPassword,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
