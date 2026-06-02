"use client"

import { useState } from "react"
import Button from "@/components/ui/Button"

type Props = {
  file: File | null
  onChange: (file: File | null) => void
}

export default function QRUploadSection({ file, onChange }: Props) {
  const [preview, setPreview] = useState<string | null>(null)

  const handleFile = (selected: File | null) => {
    onChange(selected)
    if (selected) {
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(selected)
    } else {
      setPreview(null)
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Payment QR Code{" "}
        <span className="text-gray-400 font-normal">(DuitNow / TNG)</span>
      </label>

      {!preview ? (
        <label className="block w-full p-6 border-2 border-dashed border-gray-300 rounded-xl text-center cursor-pointer hover:border-gray-400 transition">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          <div className="text-gray-500 text-sm">
            📷 Tap to upload QR code
          </div>
          <div className="text-gray-400 text-xs mt-1">
            Friends will scan this to pay you
          </div>
        </label>
      ) : (
        <div className="space-y-2">
          <div className="relative w-full aspect-square max-w-xs mx-auto rounded-xl overflow-hidden border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="QR preview" className="w-full h-full object-contain" />
          </div>
          <Button
            variant="secondary"
            onClick={() => handleFile(null)}
            className="w-full text-sm"
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  )
}