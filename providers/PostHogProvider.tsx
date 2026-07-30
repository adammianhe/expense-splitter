"use client"

import { Suspense, useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"

function PostHogPageview(): null {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return
    try {
      let url = window.origin + pathname
      const search = searchParams.toString()
      if (search) url += `?${search}`
      posthog.capture("$pageview", { $current_url: url })
    } catch {
      // best effort
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  return null
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
    if (!key || !host) return

    try {
      posthog.init(key, {
        api_host: host,
        person_profiles: "identified_only",
        capture_pageview: false,
      })
    } catch {
      // best effort
    }
  }, [])

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      {children}
    </PHProvider>
  )
}
