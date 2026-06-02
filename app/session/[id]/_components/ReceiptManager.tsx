"use client"

import { useState, useRef } from "react"
import { Receipt } from "@/types"

type Props = {
  receipts: Receipt[]
  canManage: boolean // owner = true, friends = false
  onUpload: (file: File) => Promise<void>
  onDelete: (receipt: Receipt) => Promise<void>
}

export default function ReceiptManager({
  receipts,
  canManage,
  onUpload,
  onDelete,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      await onUpload(file)
    } catch (err: any) {
      alert("Upload error: " + err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDelete = async (receipt: Receipt) => {
    if (!confirm("Delete this receipt?")) return
    try {
      await onDelete(receipt)
    } catch (err: any) {
      alert("Delete error: " + err.message)
    }
  }

  // Empty state — show nothing for non-owners
  if (receipts.length === 0 && !canManage) {
    return null
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="text-xs text-gray-500 font-medium uppercase">
          📄 Receipts ({receipts.length})
        </div>

        {/* Empty state — dashed upload box */}
        {receipts.length === 0 && canManage && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-gray-400 transition"
          >
            <div className="text-sm text-gray-600">
              📷{" "}
              {uploading ? "Uploading..." : "Tap to upload receipt photos"}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Friends can cross-check the prices
            </div>
          </button>
        )}

        {/* Receipts grid + add more button */}
        {receipts.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group"
                >
                  <button
                    onClick={() => setLightboxUrl(receipt.image_url)}
                    className="w-full h-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={receipt.image_url}
                      alt="Receipt"
                      className="w-full h-full object-cover"
                    />
                  </button>
                  {canManage && (
                    <button
                      onClick={() => handleDelete(receipt)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-md hover:bg-red-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {canManage && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-gray-400 transition text-xs text-gray-600"
              >
                📷 {uploading ? "Uploading..." : "Add more receipts"}
              </button>
            )}
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white text-3xl leading-none"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Receipt full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}