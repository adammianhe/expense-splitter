"use client"

import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-4xl font-bold text-gray-900">
          Split Bill Tanpa Drama
        </h1>
        <p className="text-gray-600">
          Bayar makan dengan kawan tanpa pening kepala. No login, no install, just share link.
        </p>

        <Link
          href="/create"
          className="inline-block w-full bg-black text-white py-4 rounded-xl font-semibold hover:bg-gray-800 transition"
        >
          Create New Session
        </Link>

        <p className="text-sm text-gray-500">
          Buat sesi, share link, kawan tick makanan, semua settle.
        </p>
      </div>
    </main>
  )
}