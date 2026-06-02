"use client"

import { useState } from "react"
import { Item, Participant } from "@/types"
import Button from "@/components/ui/Button"

type Props = {
  items: Item[]
  participants: Participant[]
  allAssignments: any[]
  payerNames: Record<string, string[]>
  isItemLocked: (itemId: string) => boolean
  onAddItem: (name: string, price: number, quantity: number) => Promise<void>
  onUpdateItem: (itemId: string, name: string, price: number, quantity: number) => Promise<void>
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
  const [editQty, setEditQty] = useState("")
  const [editMode, setEditMode] = useState<"each" | "total">("each")

  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPrice, setNewPrice] = useState("")
  const [newQty, setNewQty] = useState("1")
  const [newMode, setNewMode] = useState<"each" | "total">("each")

  const [processing, setProcessing] = useState(false)

  // Resolve final price-per-item from user input
  const resolvePricePerItem = (priceInput: string, qtyInput: string, mode: "each" | "total"): number => {
    const price = parseFloat(priceInput) || 0
    const qty = parseInt(qtyInput) || 1
    if (mode === "total" && qty > 0) return Math.round((price / qty) * 100) / 100
    return Math.round(price * 100) / 100
  }

  const getCalculatedLabel = (priceInput: string, qtyInput: string, mode: "each" | "total"): string | null => {
    const price = parseFloat(priceInput) || 0
    const qty = parseInt(qtyInput) || 0
    if (qty < 1 || price <= 0) return null
    if (mode === "each") return `Total: RM ${(price * qty).toFixed(2)}`
    return `Each: RM ${(price / qty).toFixed(2)}`
  }

  const handleAdd = async () => {
    if (!newName.trim() || !newPrice || !newQty) {
      alert("Fill in name, qty, and price")
      return
    }
    const qty = parseInt(newQty)
    if (qty < 1) {
      alert("Quantity must be at least 1")
      return
    }
    setProcessing(true)
    try {
      const pricePerItem = resolvePricePerItem(newPrice, newQty, newMode)
      await onAddItem(newName, pricePerItem, qty)
      setNewName("")
      setNewPrice("")
      setNewQty("1")
      setNewMode("each")
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
    setEditQty(String(item.quantity))
    setEditMode("each")
  }

  const handleSaveEdit = async (itemId: string) => {
    if (!editName.trim() || !editPrice || !editQty) {
      alert("Fill in name, qty, and price")
      return
    }
    const qty = parseInt(editQty)
    if (qty < 1) {
      alert("Quantity must be at least 1")
      return
    }
    setProcessing(true)
    try {
      const pricePerItem = resolvePricePerItem(editPrice, editQty, editMode)
      await onUpdateItem(itemId, editName, pricePerItem, qty)
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
          <Button variant="ghost" onClick={() => setAdding(true)} className="text-xs px-2">
            + Add Item
          </Button>
        )}
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {items.map((item) => {
          const locked = isItemLocked(item.id)
          const isEditing = editingId === item.id
          const editCalculated = isEditing
            ? getCalculatedLabel(editPrice, editQty, editMode)
            : null

          return (
            <div
              key={item.id}
              className="bg-gray-50 border border-gray-200 rounded-lg p-3"
            >
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Item name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-black text-gray-900 bg-white"
                  />

                  <div className="flex gap-2 items-center">
                    <div className="flex flex-col flex-shrink-0">
                      <span className="text-xs text-gray-500 mb-1">Qty</span>
                      <input
                        type="number"
                        min="1"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-black text-gray-900 bg-white text-center"
                      />
                    </div>

                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 mb-1">Mode</span>
                      <div className="flex bg-gray-200 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => setEditMode("each")}
                          className={`px-2 py-1.5 rounded-md text-xs font-medium transition ${
                            editMode === "each"
                              ? "bg-white text-gray-900 shadow-sm"
                              : "text-gray-500"
                          }`}
                        >
                          Each
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditMode("total")}
                          className={`px-2 py-1.5 rounded-md text-xs font-medium transition ${
                            editMode === "total"
                              ? "bg-white text-gray-900 shadow-sm"
                              : "text-gray-500"
                          }`}
                        >
                          Total
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col flex-1">
                      <span className="text-xs text-gray-500 mb-1">
                        {editMode === "each" ? "Each (RM)" : "Total (RM)"}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-black text-gray-900 bg-white"
                      />
                    </div>
                  </div>

                  {editCalculated && (
                    <div className="text-xs text-gray-500 pl-1">→ {editCalculated}</div>
                  )}

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
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        {item.name}
                        {item.quantity > 1 && (
                          <span className="ml-1 text-xs text-gray-500 font-normal">
                            (qty: {item.quantity})
                          </span>
                        )}
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
                      {item.quantity > 1 && (
                        <span className="text-xs text-gray-500 font-normal ml-1">
                          each
                        </span>
                      )}
                    </div>
                    {item.quantity > 1 && (
                      <div className="text-xs text-gray-500">
                        Total: RM {(Number(item.price) * item.quantity).toFixed(2)}
                      </div>
                    )}
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
            placeholder="Item name (e.g. Burger)"
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-black text-gray-900 bg-white"
          />

          <div className="flex gap-2 items-center">
            <div className="flex flex-col flex-shrink-0">
              <span className="text-xs text-gray-500 mb-1">Qty</span>
              <input
                type="number"
                min="1"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-black text-gray-900 bg-white text-center"
              />
            </div>

            <div className="flex flex-col">
              <span className="text-xs text-gray-500 mb-1">Mode</span>
              <div className="flex bg-gray-200 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setNewMode("each")}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition ${
                    newMode === "each"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  Each
                </button>
                <button
                  type="button"
                  onClick={() => setNewMode("total")}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition ${
                    newMode === "total"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  Total
                </button>
              </div>
            </div>

            <div className="flex flex-col flex-1">
              <span className="text-xs text-gray-500 mb-1">
                {newMode === "each" ? "Each (RM)" : "Total (RM)"}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-black text-gray-900 bg-white"
              />
            </div>
          </div>

          {getCalculatedLabel(newPrice, newQty, newMode) && (
            <div className="text-xs text-gray-500 pl-1">
              → {getCalculatedLabel(newPrice, newQty, newMode)}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setAdding(false)
                setNewName("")
                setNewPrice("")
                setNewQty("1")
                setNewMode("each")
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