"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ToastMessage } from "./Toast"
import Toast from "./Toast"

type Props = {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export default function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null

  return (
    // Fixed, bottom-anchored on mobile (near-full-width, thumb-reachable,
    // doesn't cover the header/undo-triggering controls up top); bottom-right
    // on desktop. z-[200] so a toast triggered from inside a modal (e.g.
    // removing a session from the SessionsOverlay, z-50) still renders above
    // it, and above tooltips (z-[100]).
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-[200] flex flex-col items-center sm:items-end gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="w-full pointer-events-auto"
          >
            <Toast toast={toast} onDismiss={onDismiss} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
