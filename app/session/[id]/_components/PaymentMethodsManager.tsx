"use client"

import { useState, useRef } from "react"
import { PaymentMethod } from "@/types"
import { QrCode, Camera, Pencil, Check } from "lucide-react"

type Props = {
  paymentMethods: PaymentMethod[]
  canManage: boolean // owner = true, friends = false
  onUpload: (file: File, label?: string) => Promise<void>
  onUpdateLabel: (id: string, label: string) => Promise<void>
  onDelete: (method: PaymentMethod) => Promise<void>
}

export default function PaymentMethodsManager({
  paymentMethods,
  canManage,
  onUpload,
  onUpdateLabel,
  onDelete,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")
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

  const handleDelete = async (method: PaymentMethod) => {
    if (!confirm("Delete this payment method?")) return
    try {
      await onDelete(method)
    } catch (err: any) {
      alert("Delete error: " + err.message)
    }
  }

  const startEdit = (method: PaymentMethod) => {
    setEditingId(method.id)
    setEditLabel(method.label || "")
  }

  const saveEdit = async (id: string) => {
    try {
      await onUpdateLabel(id, editLabel)
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setEditingId(null)
      setEditLabel("")
    }
  }

  // Empty state: show nothing for non-owners
  if (paymentMethods.length === 0 && !canManage) {
    return null
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="text-xs text-gray-500 font-medium uppercase flex items-center gap-1.5">
          <QrCode size={14} />
          Payment Methods ({paymentMethods.length})
        </div>

        {/* Empty state: dashed upload box */}
        {paymentMethods.length === 0 && canManage && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-gray-400 transition"
          >
            <div className="text-sm text-gray-600 flex items-center justify-center gap-2">
              <Camera size={16} />
              {uploading ? "Uploading..." : "Add Payment QR (DuitNow, TNG, Bank)"}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Friends will pick which one to pay with
            </div>
          </button>
        )}

        {/* Methods grid + add more button */}
        {paymentMethods.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="space-y-1.5 bg-gray-50 border border-gray-200 rounded-lg p-2"
                >
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-white border border-gray-200">
                    <button
                      onClick={() => setLightboxUrl(method.image_url)}
                      className="w-full h-full"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={method.image_url}
                        alt={method.label || "Payment QR"}
                        className="w-full h-full object-contain"
                      />
                    </button>
                    {canManage && (
                      <button
                        onClick={() => handleDelete(method)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-md hover:bg-red-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Label row */}
                  {canManage ? (
                    editingId === method.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          placeholder="Label (e.g. TNG)"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(method.id)
                          }}
                          className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:border-black text-gray-900 bg-white"
                        />
                        <button
                          onClick={() => saveEdit(method.id)}
                          className="w-6 h-6 flex-shrink-0 bg-black text-white rounded-md flex items-center justify-center"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(method)}
                        className="w-full flex items-center justify-between gap-1 text-xs text-gray-700 hover:text-black px-1"
                      >
                        <span className="truncate">
                          {method.label || "Add label"}
                        </span>
                        <Pencil size={11} className="flex-shrink-0 text-gray-400" />
                      </button>
                    )
                  ) : (
                    method.label && (
                      <div className="text-xs text-center font-medium text-gray-700 truncate px-1">
                        {method.label}
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>

            {canManage && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-gray-400 transition text-xs text-gray-600 flex items-center justify-center gap-1.5"
              >
                <Camera size={14} />
                {uploading ? "Uploading..." : "Add another QR"}
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
            alt="Payment QR full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
