"use client"

import { ParticipantForm } from "@/types"
import Button from "@/components/ui/Button"

type Props = {
  participants: ParticipantForm[]
  onChange: (participants: ParticipantForm[]) => void
}

export default function ParticipantsSection({ participants, onChange }: Props) {
  const addParticipant = () => {
    onChange([...participants, { name: "" }])
  }

  const updateParticipant = (index: number, value: string) => {
    const updated = [...participants]
    updated[index].name = value
    onChange(updated)
  }

  const removeParticipant = (index: number) => {
    onChange(participants.filter((_, i) => i !== index))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Participants (first one is owner)
      </label>
      <div className="space-y-2">
        {participants.map((participant, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={participant.name}
              onChange={(e) => updateParticipant(index, e.target.value)}
              placeholder={index === 0 ? "Your name (owner)" : "Friend name"}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
            />
            {participants.length > 1 && (
              <Button variant="danger" onClick={() => removeParticipant(index)} className="px-3">
                ✕
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button variant="ghost" onClick={addParticipant} className="mt-2 text-sm px-0">
        + Add Participant
      </Button>
    </div>
  )
}