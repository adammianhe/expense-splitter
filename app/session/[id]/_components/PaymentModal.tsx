"use client"

import { useState } from "react"
import { Session } from "@/types"
import Button from "@/components/ui/Button"

type Props = {
  session: Session
  amount: number
  onConfirm: (method: "qr" | "cash") => Promise<void>
  onClose: () => void
}

export default function PaymentModal({ session, amount, onConfirm, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [method, setMethod] = useState<"qr" | "cash">("qr")

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm(method)
      onClose()
    } catch (err: any) {
      alert("Error: " + err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Bayar Sekarang</h2>
            <p className="text-sm text-gray-500 mt-1">
              Total: <span className="font-semibold text-gray-900">RM {amount.toFixed(2)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Method selector */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setMethod("qr")}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              method === "qr" ? "bg-white shadow-sm" : "text-gray-500"
            }`}
          >
            📱 QR Code
          </button>
          <button
            onClick={() => setMethod("cash")}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              method === "cash" ? "bg-white shadow-sm" : "text-gray-500"
            }`}
          >
            💵 Cash
          </button>
        </div>

        {/* QR or Cash content */}
        {method === "qr" ? (
          session.qr_image_url ? (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={session.qr_image_url}
                  alt="Payment QR"
                  className="w-full max-w-xs mx-auto"
                />
              </div>
              <p className="text-sm text-gray-600 text-center">
                Scan QR ni, bayar <strong>RM {amount.toFixed(2)}</strong>, then click confirm
              </p>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
              ⚠️ Owner belum upload QR code. Tanya owner untuk payment details.
            </div>
          )
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            💵 Bagi cash <strong>RM {amount.toFixed(2)}</strong> kat owner, then click confirm di bawah.
          </div>
        )}

        {/* Confirm button */}
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={loading}
          className="w-full py-3"
        >
          {loading ? "Saving..." : "Saya Dah Bayar ✓"}
        </Button>

        <p className="text-xs text-gray-500 text-center">
          Owner akan verify payment awak. Pastikan dah betul-betul bayar.
        </p>
      </div>
    </div>
  )
}