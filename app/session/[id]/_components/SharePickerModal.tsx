"use client"

import { useState } from "react"
import { Participant, Item } from "@/types"
import Button from "@/components/ui/Button"

type Props = {
  item: Item
  currentParticipantId: string
  participants: Participant[]
  onConfirm: (quantity: number, taggedIds: string[]) => Promise<void>
  onClose: () => void
}

export default function SharePickerModal({
  item,
  currentParticipantId,
  participants,
  onConfirm,
  onClose,
}: Props) {
  const [quantity, setQuantity] = useState(1)
  const [taggedIds, setTaggedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  // All other participants (exclude self)
  const otherParticipants = participants.filter((p) => p.id !== currentParticipantId)

  const toggleTag = (pid: string) => {
    const newSet = new Set(taggedIds)
    if (newSet.has(pid)) newSet.delete(pid)
    else newSet.add(pid)
    setTaggedIds(newSet)
  }

  const handleConfirm = async () => {
    if (taggedIds.size === 0) {
      alert("Tag at least one person to share with")
      return
    }
    setLoading(true)
    try {
      await onConfirm(quantity, Array.from(taggedIds))
      onClose()
    } catch (err: any) {
      alert("Error: " + err.message)
      setLoading(false)
    }
  }

  // Preview: how much each person pays
  const totalCost = quantity * Number(item.price)
  const sharePerPerson = totalCost / (taggedIds.size + 1) // +1 for self

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Share Item</h2>
            <p className="text-sm text-gray-500 mt-1">
              {item.name}{" "}
              <span className="text-gray-400">
                (RM {Number(item.price).toFixed(2)} each)
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Quantity selector */}
        <div>
          <label className="block text-xs text-gray-500 font-medium mb-2">
            How many units to share?
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 font-bold text-lg disabled:opacity-30"
              disabled={quantity <= 1}
            >
              −
            </button>
            <span className="font-bold text-xl w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(item.quantity, quantity + 1))}
              className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 font-bold text-lg disabled:opacity-30"
              disabled={quantity >= item.quantity}
            >
              +
            </button>
            <span className="text-xs text-gray-500 ml-2">
              (max {item.quantity})
            </span>
          </div>
        </div>

        {/* Participant picker */}
        <div>
          <label className="block text-xs text-gray-500 font-medium mb-2">
            Share with who? ({taggedIds.size} selected)
          </label>
          {otherParticipants.length === 0 ? (
            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
              No other participants to share with.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {otherParticipants.map((p) => {
                const isSelected = taggedIds.has(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleTag(p.id)}
                    className={`w-full p-3 rounded-lg border text-left transition flex items-center justify-between ${
                      isSelected
                        ? "bg-black text-white border-black"
                        : "bg-white border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <span className="font-medium text-sm">{p.name}</span>
                    <span className="text-lg">{isSelected ? "✓" : ""}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Preview */}
        {taggedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <div className="text-blue-900 font-medium">Preview</div>
            <div className="text-blue-700 mt-1">
              {quantity} × RM {Number(item.price).toFixed(2)} = RM{" "}
              {totalCost.toFixed(2)} split among {taggedIds.size + 1} people
            </div>
            <div className="text-blue-900 font-semibold mt-1">
              Each pays: RM {sharePerPerson.toFixed(2)}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={loading || taggedIds.size === 0}
            className="flex-1"
          >
            {loading ? "Creating..." : "Send Share Request"}
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Tagged people will be notified to confirm or reject
        </p>
      </div>
    </div>
  )
}