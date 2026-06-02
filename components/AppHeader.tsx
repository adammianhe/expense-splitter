"use client"

import Link from "next/link"
import { Wallet } from "lucide-react"

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 w-full">
      <div className="px-6 py-3 flex items-center">
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-80 transition"
        >
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <Wallet size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900">Splitto</span>
        </Link>
      </div>
    </header>
  )
}