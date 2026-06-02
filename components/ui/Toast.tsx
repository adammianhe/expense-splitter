"use client"

import { useEffect, useState } from "react"

export type ToastMessage = {
  id: string
  text: string
  type?: "info" | "success" | "warning" | "error"
}

type Props = {
  toast: ToastMessage
  onDismiss: (id: string) => void
}

export default function Toast({ toast, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Slide in
    setTimeout(() => setVisible(true), 10)

    // Auto dismiss after 3.5s
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(toast.id), 300)
    }, 3500)

    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const colors = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    success: "bg-green-50 border-green-200 text-green-900",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
    error: "bg-red-50 border-red-200 text-red-900",
  }

  return (
    <div
      className={`transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      }`}
    >
      <div
        className={`px-4 py-3 rounded-lg border shadow-sm text-sm font-medium ${
          colors[toast.type || "info"]
        }`}
      >
        {toast.text}
      </div>
    </div>
  )
}