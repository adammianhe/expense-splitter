"use client"

import Input from "@/components/ui/Input"

type Props = {
  value: string
  onChange: (value: string) => void
}

export default function SessionNameInput({ value, onChange }: Props) {
  return (
    <Input
      label="Session Name"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="e.g. Dinner TTDI 29 May"
    />
  )
}