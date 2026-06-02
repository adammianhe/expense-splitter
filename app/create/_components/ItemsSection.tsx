"use client"

import { ItemForm } from "@/types"
import Button from "@/components/ui/Button"

type Props = {
  items: ItemForm[]
  onChange: (items: ItemForm[]) => void
}

export default function ItemsSection({ items, onChange }: Props) {
  const addItem = () => {
    onChange([...items, { name: "", price: "" }])
  }

  const updateItem = (index: number, field: "name" | "price", value: string) => {
    const updated = [...items]
    updated[index][field] = value
    onChange(updated)
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Items
      </label>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
  type="text"
  value={item.name}
  onChange={(e) => updateItem(index, "name", e.target.value)}
  placeholder="Dish name"
  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black text-gray-900 bg-white placeholder:text-gray-400"
/>
            <input
              type="number"
              value={item.price}
              onChange={(e) => updateItem(index, "price", e.target.value)}
              placeholder="Price"
              step="0.01"
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
            />
            {items.length > 1 && (
              <Button variant="danger" onClick={() => removeItem(index)} className="px-3">
                ✕
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button variant="ghost" onClick={addItem} className="mt-2 text-sm px-0">
        + Add Item
      </Button>
    </div>
  )
}