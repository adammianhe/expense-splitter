"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Loader2, User, Wallet } from "lucide-react"
import { AnimatePresence } from "framer-motion"
import { useAuth } from "@/contexts/AuthContext"
import { Skeleton } from "@/components/ui/Skeleton"
import SignInModal from "@/components/SignInModal"
import ProfileMenu from "@/components/ProfileMenu"

export default function AppHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading: authLoading, isSignedIn } = useAuth()

  const [navigating, setNavigating] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [signOutToast, setSignOutToast] = useState(false)

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (pathname === "/") {
      window.location.reload()
      return
    }

    const message = pathname.startsWith("/session/")
      ? "Leave this session and go back home?"
      : "Discard this session draft and go back home?"

    if (confirm(message)) {
      setNavigating(true)
      router.push("/")
    }
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

      {/* Navigation overlay */}
      {navigating && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-gray-700" />
            <span className="text-sm text-gray-600">Going home...</span>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showSignIn && <SignInModal key="signin" onClose={() => setShowSignIn(false)} />}
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
