"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"

type Props = {
  onClose: () => void
}

const steps = [
  {
    number: "1",
    title: "Create",
    description: "Add your bill items, prices, and friends.",
  },
  {
    number: "2",
    title: "Share",
    description: "Send your friends the link via WhatsApp.",
  },
  {
    number: "3",
    title: "Settle",
    description: "Friends tick what they had and pay you back via QR or cash.",
  },
]

export default function HowItWorksModal({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="How Splitto works"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-2xl w-full max-w-md p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">How Splitto Works</h2>
            <p className="text-sm text-gray-500 mt-1">Three simple steps.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition ml-4 text-2xl leading-none flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-semibold flex items-center justify-center flex-shrink-0 text-sm">
                {step.number}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{step.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition"
        >
          Got it
        </button>
      </motion.div>
    </motion.div>
  )
}
