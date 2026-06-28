"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get("code")

    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            sessionStorage.setItem("splitto:auth_error", error.message)
          } else {
            sessionStorage.setItem("splitto:just_signed_in", "true")
          }
          router.replace("/")
        })
    } else {
      // No PKCE code — supabase-js handles implicit token from hash automatically
      router.replace("/")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <Loader2 size={28} className="animate-spin text-gray-500" />
      <p className="text-sm text-gray-500">Signing you in...</p>
      <Suspense>
        <CallbackHandler />
      </Suspense>
    </div>
  )
}
