"use client"

import { ToastMessage } from "./Toast"
import Toast from "./Toast"

type Props = {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export default function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null

  return (
    // Bottom on mobile (near-full-width, thumb-reachable, doesn't cover the
    // header/undo-triggering controls up top); bottom-right on desktop.
    // z-[60] so a toast triggered from inside a modal (e.g. removing a
    // session from the SessionsOverlay, z-50) still renders above it.
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[60] flex flex-col items-center sm:items-end gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="w-full sm:max-w-md pointer-events-auto">
          <Toast toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}