"use client"

import { useRef } from "react"
import { Camera, Plus } from "lucide-react"

export type PaymentMethodDraft = {
  file: File
  label: string
}

type Props = {
  methods: PaymentMethodDraft[]
  onChange: (methods: PaymentMethodDraft[]) => void
}

export default function PaymentMethodsSection({ methods, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || [])
    if (newFiles.length === 0) return
    onChange([
      ...methods,
      ...newFiles.map((file) => ({ file, label: "" })),
    ])
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleRemove = (index: number) => {
    onChange(methods.filter((_, i) => i !== index))
  }

  const handleLabelChange = (index: number, label: string) => {
    onChange(methods.map((m, i) => (i === index ? { ...m, label } : m)))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Payment Methods{" "}
        <span className="text-gray-400 font-normal text-xs">
          (DuitNow, TNG, Bank QR)
        </span>
      </label>

      {methods.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {methods.map((m, i) => {
            const url = URL.createObjectURL(m.file)
            return (
              <div
                key={i}
                className="space-y-1.5 bg-gray-50 border border-gray-200 rounded-lg p-2"
              >
                <div className="relative aspect-square rounded-lg overflow-hidden bg-white border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Payment QR ${i + 1}`}
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(i)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  value={m.label}
                  onChange={(e) => handleLabelChange(i, e.target.value)}
                  placeholder="Label (e.g. TNG)"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:border-black text-gray-900 bg-white"
                />
              </div>
            )
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-gray-400 transition"
      >
        <div className="text-sm text-gray-600 flex items-center justify-center gap-2">
          {methods.length === 0 ? <Camera size={16} /> : <Plus size={16} />}
          {methods.length === 0 ? "Add Payment QR" : "Add another QR"}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Friends will pick which one to pay with
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleAdd}
        className="hidden"
      />
    </div>
  )
}
