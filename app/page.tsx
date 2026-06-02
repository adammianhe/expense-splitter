"use client"

import Link from "next/link"
import AppHeader from "@/components/AppHeader"

export default function HomePage() {
  return (
    <>
    <AppHeader />
    <main className="h-[calc(100dvh-60px)] flex flex-col items-center justify-center p-6 overflow-hidden">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-4xl font-bold text-gray-900">
          Split Bill, No Drama
        </h1>
        <p className="text-gray-600">
          Split bills with friends without the headache. No login, no install, just share a link.
        </p>

        <Link
          href="/create"
          className="inline-block w-full bg-black text-white py-4 rounded-xl font-semibold hover:bg-gray-800 transition"
        >
          Create New Session
        </Link>

        <p className="text-sm text-gray-500">
          Create a session, share the link, friends tick items, everyone settles up.
        </p>
      </div>
    </main>
    </>
  )
}