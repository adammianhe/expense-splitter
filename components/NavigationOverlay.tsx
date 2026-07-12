"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Loader2 } from "lucide-react"

type Props = {
  visible: boolean
  message?: string
}

export default function NavigationOverlay({ visible, message = "Loading..." }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-3"
          >
            <Loader2 size={32} className="animate-spin text-gray-700" />
            <span className="text-sm text-gray-600 font-medium">{message}</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
