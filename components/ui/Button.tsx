"use client"

import { ButtonHTMLAttributes } from "react"
import { motion, HTMLMotionProps } from "framer-motion"

type ButtonProps = Omit<HTMLMotionProps<"button">, "ref"> & {
  variant?: "primary" | "secondary" | "danger" | "ghost"
}

export default function Button({
  variant = "primary",
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    "px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"

  const variants = {
    primary: "bg-black text-white hover:bg-gray-800",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    danger: "bg-red-500 text-white hover:bg-red-600",
    ghost: "text-blue-600 hover:underline",
  }

  const shouldAnimate = variant !== "ghost" && !disabled

  return (
    <motion.button
      whileTap={shouldAnimate ? { scale: 0.92, opacity: 0.85 } : undefined}
      whileHover={shouldAnimate ? { scale: 1.02 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  )
}
