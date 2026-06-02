"use client"

import { useState } from "react"
import { Item, Participant } from "@/types"
import Button from "@/components/ui/Button"

type Props = {
  items: Item[]
  participants: Participant[]
  allAssignments: any[]
  payerNames: Record<string, string[]> // item_id → array of payer names
  isItemLocked: (itemId: string) => boolean
  onAddItem: (name: string, price: number) => Promise<void>
  onUpdateItem: (itemId: string, name: string, price: number) => Promise<void>
  onDeleteItem: (itemId: string) => Promise<void>
}

export default function ItemsEditor({
  items,
  participants,
  allAssignments,
  payerNames,
  isItemLocked,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editPrice, setEditPrice] = useState("")
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPrice, setNewPrice] = useState("")
  const [processing, setProcessing] = useState(false)

  const getItemPayers = (itemId: string): string[] => {
  // Find all payments that include this item in paid_item_ids
  // We get this from the payments prop (passed from parent)
  return payerNames[itemId] || []
}

  const handleAdd = async () => {
    if (!newName.trim() || !newPrice) {
      alert("Fill in name and price")
      return
    }
    setProcessing(true)
    try {
      await onAddItem(newName, parseFloat(newPrice))
      setNewName("")
      setNewPrice("")
      setAdding(false)
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleStartEdit = (item: Item) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditPrice(String(item.price))
  }

  const handleSaveEdit = async (itemId: string) => {
    if (!editName.trim() || !editPrice) {
      alert("Isi nama dan harga")
      return
    }
    setProcessing(true)
    try {
      await onUpdateItem(itemId, editName, parseFloat(editPrice))
      setEditingId(null)
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async (item: Item) => {
  const allTickers = allAssignments
    .filter((a) => a.item_id === item.id && a.status !== "rejected")
    .map((a) => {
      const p = participants.find((pp) => pp.id === a.participant_id)
      return p?.name
    })
    .filter(Boolean) as string[]

  if (allTickers.length > 0) {
    const confirmed = confirm(
      `${allTickers.length} people ticked "${item.name}" (${allTickers.join(", ")}). Delete anyway?`
    )
    if (!confirmed) return
  }

    setProcessing(true)
    try {
      await onDeleteItem(item.id)
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 font-medium uppercase">
          Items in Bill ({items.length})
        </div>
        {!adding && (
          <Button
            variant="ghost"
            onClick={() => setAdding(true)}
            className="text-xs px-2"
          >
            + Add Item
          </Button>
        )}
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {items.map((item) => {
          const locked = isItemLocked(item.id)
          const isEditing = editingId === item.id

          return (
            <div
              key={item.id}
              className="bg-gray-50 border border-gray-200 rounded-lg p-3"
            >
              {isEditing ? (
                /* Edit mode */
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Item name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-black"
                  />
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="Price"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-black"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setEditingId(null)}
                      className="flex-1 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => handleSaveEdit(item.id)}
                      disabled={processing}
                      className="flex-1 text-xs"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        {item.name}
                      </span>
                      {locked && <span className="text-xs">🔒</span>}
                    </div>
                    {payerNames[item.id] && payerNames[item.id].length > 0 && (
  <div className="text-xs text-gray-500 mt-0.5">
    Paid by {payerNames[item.id].join(", ")}
  </div>
)}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-sm text-gray-900">
                      RM {Number(item.price).toFixed(2)}
                    </div>
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={() => handleStartEdit(item)}
                        disabled={locked || processing}
                        className="text-xs text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        Edit
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={locked || processing}
                        className="text-xs text-red-600 hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add new item */}
      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Item name (e.g. Sotong Goreng)"
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-black"
          />
          <input
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="Price"
            step="0.01"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-black"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setAdding(false)
                setNewName("")
                setNewPrice("")
              }}
              className="flex-1 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAdd}
              disabled={processing}
              className="flex-1 text-xs"
            >
              {processing ? "Adding..." : "Add Item"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}