"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Wallet, Loader2 } from "lucide-react"

export default function AppHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const [navigating, setNavigating] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()

    if (pathname === "/") return

    const message = pathname.startsWith("/session/")
      ? "Leave this session and go back home?"
      : "Discard this session draft and go back home?"

    if (confirm(message)) {
      setNavigating(true)
      router.push("/")
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 w-full">
        <div className="px-6 py-3 flex items-center">
          <button
            onClick={handleClick}
            className="flex items-center gap-2 hover:opacity-80 transition"
          >
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Wallet size={18} className="text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">Splitto</span>
          </button>
        </div>
      </header>

      {/* Full-screen loading overlay during navigation */}
      {navigating && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-gray-700" />
            <span className="text-sm text-gray-600">Going home...</span>
          </div>
        </div>
      )}
    </>
  )
}