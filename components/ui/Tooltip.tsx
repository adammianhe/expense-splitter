"use client"

import { useRef, useState, ReactNode } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"

type Props = {
  content: string
  children: ReactNode
  position?: "top" | "bottom" | "left" | "right"
}

type Coords = { top: number; left: number }

// Session cards sit inside `overflow-hidden` wrappers (needed for the
// remove/collapse animation), which clips any absolutely-positioned popup
// regardless of z-index — overflow:hidden clips before stacking order is
// even considered. Portal to document.body with `position: fixed` computed
// from the trigger's bounding rect, so it always escapes any ancestor's
// overflow/z-index. Hover-only — no touch handlers, so it never fires (or
// gets in the way) on mobile.
export function Tooltip({ content, children, position = "top" }: Props) {
  const [show, setShow] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const handleEnter = () => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const GAP = 8

    let top = rect.top
    let left = rect.left + rect.width / 2
    if (position === "top") top = rect.top - GAP
    if (position === "bottom") top = rect.bottom + GAP
    if (position === "left") {
      left = rect.left - GAP
      top = rect.top + rect.height / 2
    }
    if (position === "right") {
      left = rect.right + GAP
      top = rect.top + rect.height / 2
    }

    setCoords({ top, left })
    setShow(true)
  }

  const translate = {
    top: "translate(-50%, -100%)",
    bottom: "translate(-50%, 0)",
    left: "translate(-100%, -50%)",
    right: "translate(0, -50%)",
  }[position]

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {show && coords && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "fixed",
                  top: coords.top,
                  left: coords.left,
                  transform: translate,
                }}
                className="z-[100] pointer-events-none"
              >
                <div className="bg-gray-900 text-white text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap">
                  {content}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}
