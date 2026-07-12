"use client"

import { useState, useCallback } from "react"
import { ToastMessage, ToastAction } from "@/components/ui/Toast"

type ShowToastOptions = {
  action?: ToastAction
  duration?: number
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback(
    (
      text: string,
      type: ToastMessage["type"] = "info",
      options?: ShowToastOptions
    ) => {
      const id = `toast-${Date.now()}-${Math.random()}`
      setToasts((prev) => [
        ...prev,
        { id, text, type, action: options?.action, duration: options?.duration },
      ])
    },
    []
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, showToast, dismissToast }
}