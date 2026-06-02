"use client"

import { useRouter, usePathname } from "next/navigation"
import { Wallet } from "lucide-react"

export default function AppHeader() {
  const router = useRouter()
  const pathname = usePathname()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()

    // If already on homepage, do nothing
    if (pathname === "/") return

    // Confirm before navigating away from create or session pages
    const message = pathname.startsWith("/session/")
      ? "Leave this session and go back home?"
      : "Discard this session draft and go back home?"

    if (confirm(message)) {
      router.push("/")
    }
  }

  return (
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
  )
}