"use client"

import { useRef } from "react"

type Props = {
  files: File[]
  onChange: (files: File[]) => void
}

export default function ReceiptUploadSection({ files, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || [])
    if (newFiles.length === 0) return
    onChange([...files, ...newFiles])
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleRemove = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Receipt Photos{" "}
        <span className="text-gray-400 font-normal text-xs">(optional)</span>
      </label>

      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {files.map((file, i) => {
            const url = URL.createObjectURL(file)
            return (
              <div
                key={i}
                className="relative aspect-square rounded-lg overflow-hidden bg-gray-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Receipt ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow"
                >
                  ✕
                </button>
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
        <div className="text-sm text-gray-600">
          📷 {files.length === 0 ? "Tap to upload receipt photos" : "Add more receipts"}
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Friends can cross-check the prices
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