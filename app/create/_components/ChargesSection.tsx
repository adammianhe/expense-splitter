"use client"

import Button from "@/components/ui/Button"
import { Plus } from "lucide-react"

export type ChargeInput = {
  label: string
  charge_type: "percentage" | "fixed"
  charge_value: string
}

type Props = {
  charges: ChargeInput[]
  onChange: (charges: ChargeInput[]) => void
}

const emptyCharge: ChargeInput = {
  label: "",
  charge_type: "percentage",
  charge_value: "",
}

export default function ChargesSection({ charges, onChange }: Props) {
  const addCharge = () => onChange([...charges, { ...emptyCharge }])

  const removeCharge = (index: number) =>
    onChange(charges.filter((_, i) => i !== index))

  const updateCharge = (index: number, patch: Partial<ChargeInput>) =>
    onChange(charges.map((c, i) => (i === index ? { ...c, ...patch } : c)))

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Additional Charges{" "}
        <span className="text-gray-400 font-normal text-xs">
          (SST, service charge, tip, rounding)
        </span>
      </label>

      {charges.length === 0 ? (
        <Button
          variant="secondary"
          onClick={addCharge}
          className="w-full text-sm"
        >
          + Add charge
        </Button>
      ) : (
        <div className="space-y-3">
          {charges.map((c, i) => (
            <div
              key={i}
              className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={c.label}
                  onChange={(e) => updateCharge(i, { label: e.target.value })}
                  placeholder="e.g. SST (optional)"
                  className="flex-1 mr-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-black text-gray-900 bg-white placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => removeCharge(i)}
                  className="text-xs text-red-500 hover:underline flex-shrink-0"
                >
                  Remove
                </button>
              </div>

              <div className="flex gap-2">
                {/* Type selector */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => updateCharge(i, { charge_type: "percentage" })}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                      c.charge_type === "percentage"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500"
                    }`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => updateCharge(i, { charge_type: "fixed" })}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                      c.charge_type === "fixed"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500"
                    }`}
                  >
                    RM
                  </button>
                </div>

                {/* Value input */}
                <input
                  type="number"
                  value={c.charge_value}
                  onChange={(e) =>
                    updateCharge(i, { charge_value: e.target.value })
                  }
                  placeholder={c.charge_type === "percentage" ? "e.g. 6" : "e.g. 5.00"}
                  step="0.01"
                  min="0"
                  max={c.charge_type === "percentage" ? "100" : undefined}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black text-gray-900 bg-white placeholder:text-gray-400"
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addCharge}
            className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-gray-400 transition text-sm text-gray-600 flex items-center justify-center gap-1.5"
          >
            <Plus size={14} />
            Add another charge
          </button>
        </div>
      )}
    </div>
  )
}
