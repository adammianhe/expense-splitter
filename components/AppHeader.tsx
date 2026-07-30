"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { User, Wallet } from "lucide-react"
import { AnimatePresence } from "framer-motion"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/useToast"
import { Skeleton } from "@/components/ui/Skeleton"
import { Tooltip } from "@/components/ui/Tooltip"
import SignInModal from "@/components/SignInModal"
import ProfileMenu from "@/components/ProfileMenu"
import NavigationOverlay from "@/components/NavigationOverlay"
import ToastContainer from "@/components/ui/ToastContainer"
import { hasCreateDraft, clearCreateDraft } from "@/lib/createDraft"

type Props = {
  // Soft, client-side refresh for the home page instead of a full
  // window.location.reload(). A hard reload re-fetches the document, HTML,
  // JS, and web fonts from scratch — the font swap + full React remount
  // (replaying every card's entrance animation at once) is what reads as a
  // "shake". Reusing the same refresh() the pull-to-refresh button already
  // uses avoids all of that.
  onReload?: () => void
}

export default function AppHeader({ onReload }: Props = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading: authLoading, isSignedIn } = useAuth()
  const { toasts, showToast, dismissToast } = useToast()

  const [navigating, setNavigating] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [signOutToast, setSignOutToast] = useState(false)
  const draftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear the "navigating" overlay once the route has actually changed
  useEffect(() => {
    setNavigating(false)
  }, [pathname])

  useEffect(() => {
    return () => {
      if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current)
    }
  }, [])

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (navigating) return // ignore rapid repeat taps

    if (pathname === "/") {
      if (onReload) {
        onReload()
      } else {
        window.location.reload()
      }
      return
    }

    if (pathname === "/create") {
      if (hasCreateDraft()) {
        if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current)
        showToast("Draft discarded.", "info", {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: () => {
              if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current)
              router.push("/create?restore=true")
            },
          },
        })
        draftTimeoutRef.current = setTimeout(() => {
          clearCreateDraft()
        }, 5000)
      }

      setNavigating(true)
      router.push("/")
      return
    }

    // Session pages and everything else: go home, no confirm
    setNavigating(true)
    router.push("/")
  }

  const handleProfileClick = () => {
    if (isSignedIn) {
      setShowProfile(true)
    } else {
      setShowSignIn(true)
    }
  }

  const handleSignedOut = () => {
    setSignOutToast(true)
    setTimeout(() => setSignOutToast(false), 3000)
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 w-full">
        <div className="px-6 py-3 flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-2 hover:opacity-80 transition"
          >
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Wallet size={18} className="text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">Splitto</span>
          </button>

          {/* Profile button */}
          {authLoading ? (
            <Skeleton className="w-8 h-8 rounded-full" />
          ) : (
            <Tooltip content="Account">
              <button
                onClick={handleProfileClick}
                aria-label={isSignedIn ? "Open profile menu" : "Sign in"}
                className="flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
              >
                {isSignedIn ? (
                  <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm select-none">
                      {user?.email?.[0]?.toUpperCase() ?? "?"}
                    </span>
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition">
                    <User size={16} className="text-gray-600" />
                  </div>
                )}
              </button>
            </Tooltip>
          )}
        </div>
      </header>

      {/* Sign-out toast */}
      {signOutToast && (
        <div className="fixed top-[60px] left-0 right-0 z-40 flex justify-center px-4 pt-2 pointer-events-none">
          <div className="max-w-md w-full">
            <div className="bg-gray-900 text-white text-sm rounded-xl px-4 py-3 shadow-lg text-center">
              Signed out. Your local sessions are still here.
            </div>
          </div>
        </div>
      )}

      <NavigationOverlay visible={navigating} message="Going home..." />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <AnimatePresence>
        {showSignIn && (
          <SignInModal
            key="signin"
            onClose={() => setShowSignIn(false)}
            onSuccess={(msg) => showToast(msg, "success")}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showProfile && (
          <ProfileMenu
            key="profile"
            onClose={() => setShowProfile(false)}
            onSignedOut={handleSignedOut}
          />
        )}
      </AnimatePresence>
    </>
  )
}
