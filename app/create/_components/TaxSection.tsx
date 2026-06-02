"use client"

import Button from "@/components/ui/Button"

type TaxConfig = {
  enabled: boolean
  type: "percentage" | "fixed"
  value: string
}

type Props = {
  label: string
  config: TaxConfig
  onChange: (config: TaxConfig) => void
}

export default function TaxSection({ label, config, onChange }: Props) {
  if (!config.enabled) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
        <Button
          variant="secondary"
          onClick={() => onChange({ ...config, enabled: true })}
          className="w-full text-sm"
        >
          + Add {label}
        </Button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <button
          onClick={() => onChange({ ...config, enabled: false, value: "" })}
          className="text-xs text-red-500 hover:underline"
        >
          Remove
        </button>
      </div>

      <div className="flex gap-2">
        {/* Type selector */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onChange({ ...config, type: "percentage" })}
            className={`px-3 py-1 rounded-md text-sm font-medium transition ${
              config.type === "percentage"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            }`}
          >
            %
          </button>
          <button
            onClick={() => onChange({ ...config, type: "fixed" })}
            className={`px-3 py-1 rounded-md text-sm font-medium transition ${
              config.type === "fixed"
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
          value={config.value}
          onChange={(e) => onChange({ ...config, value: e.target.value })}
          placeholder={config.type === "percentage" ? "e.g. 6" : "e.g. 5.00"}
          step="0.01"
          min="0"
          max={config.type === "percentage" ? "100" : undefined}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
        />
      </div>
    </div>
  )
}