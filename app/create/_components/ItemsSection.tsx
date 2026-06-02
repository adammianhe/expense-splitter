"use client"

import { ItemForm } from "@/types"
import Button from "@/components/ui/Button"

type Props = {
  items: ItemForm[]
  onChange: (items: ItemForm[]) => void
}

export default function ItemsSection({ items, onChange }: Props) {
  const addItem = () => {
    onChange([...items, { name: "", price: "", quantity: "1", priceMode: "each" }])
  }

  const updateItem = <K extends keyof ItemForm>(
    index: number,
    field: K,
    value: ItemForm[K]
  ) => {
    const updated = [...items]
    updated[index][field] = value
    onChange(updated)
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  // Calculate the auto-derived value (the opposite of what user is editing)
  const getCalculatedLabel = (item: ItemForm): string | null => {
    const qty = parseInt(item.quantity) || 0
    const price = parseFloat(item.price) || 0
    if (qty < 1 || price <= 0) return null

    if (item.priceMode === "each") {
      const total = price * qty
      return `Total: RM ${total.toFixed(2)}`
    } else {
      const each = price / qty
      return `Each: RM ${each.toFixed(2)}`
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Items
      </label>
      <div className="space-y-3">
        {items.map((item, index) => {
          const calculated = getCalculatedLabel(item)

          return (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-3 bg-white space-y-2"
            >
              {/* Item name + remove */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(index, "name", e.target.value)}
                  placeholder="Dish name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black text-gray-900 bg-white placeholder:text-gray-400"
                />
                {items.length > 1 && (
                  <Button
                    variant="danger"
                    onClick={() => removeItem(index)}
                    className="px-3"
                  >
                    ✕
                  </Button>
                )}
              </div>

              {/* Quantity + Price mode + Price */}
              <div className="flex gap-2 items-center">
                {/* Quantity */}
                <div className="flex flex-col flex-shrink-0">
                  <span className="text-xs text-gray-500 mb-1">Qty</span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    placeholder="1"
                    className="w-16 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black text-gray-900 bg-white text-center"
                  />
                </div>

                {/* Price mode toggle */}
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 mb-1">Mode</span>
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => updateItem(index, "priceMode", "each")}
                      className={`px-2 py-1.5 rounded-md text-xs font-medium transition ${
                        item.priceMode === "each"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500"
                      }`}
                    >
                      Each
                    </button>
                    <button
                      type="button"
                      onClick={() => updateItem(index, "priceMode", "total")}
                      className={`px-2 py-1.5 rounded-md text-xs font-medium transition ${
                        item.priceMode === "total"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500"
                      }`}
                    >
                      Total
                    </button>
                  </div>
                </div>

                {/* Price */}
                <div className="flex flex-col flex-1">
                  <span className="text-xs text-gray-500 mb-1">
                    {item.priceMode === "each" ? "Each (RM)" : "Total (RM)"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.price}
                    onChange={(e) => updateItem(index, "price", e.target.value)}
                    placeholder="0.00"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black text-gray-900 bg-white placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Auto-calculated label */}
              {calculated && (
                <div className="text-xs text-gray-500 pl-1">
                  → {calculated}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <Button variant="ghost" onClick={addItem} className="mt-2 text-sm px-0">
        + Add Item
      </Button>
    </div>
  )
}