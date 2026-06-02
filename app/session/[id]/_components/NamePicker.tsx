"use client"

import { useState } from "react"
import { Participant } from "@/types"
import { supabase } from "@/lib/supabase"
import { saveParticipantId } from "@/lib/utils"
import Button from "@/components/ui/Button"

type Props = {
  sessionId: string
  participants: Participant[]
  onPicked: (participantId: string) => void
}

export default function NamePicker({ sessionId, participants, onPicked }: Props) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [loading, setLoading] = useState(false)

  const pickName = (participantId: string) => {
    saveParticipantId(sessionId, participantId)
    onPicked(participantId)
  }

  const addAndPickName = async () => {
    if (!newName.trim()) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("participants")
        .insert({
          session_id: sessionId,
          name: newName.trim(),
          is_owner: false,
        })
        .select()
        .single()

      if (error) throw error
      pickName(data.id)
    } catch (err: any) {
      alert("Error: " + err.message)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pick Your Name</h1>
          <p className="text-gray-600 text-sm">Tap your name from the list</p>
        </div>

        <div className="space-y-2">
          {participants.map((p) => (
            <button
              key={p.id}
              onClick={() => pickName(p.id)}
              className="w-full p-4 bg-white border border-gray-200 rounded-xl text-left hover:bg-gray-50 transition"
            >
              <div className="font-medium text-gray-900">{p.name}</div>
              {p.is_owner && <div className="text-xs text-gray-500 mt-1">Owner</div>}
            </button>
          ))}
        </div>

        {!adding ? (
          <Button variant="ghost" onClick={() => setAdding(true)} className="w-full">
            + My name is not listed, add it myself
          </Button>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Type your name"
              autoFocus
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setAdding(false)} className="flex-1">
                Cancel
              </Button>
              <Button variant="primary" onClick={addAndPickName} disabled={loading} className="flex-1">
                {loading ? "Adding..." : "Add & Continue"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}