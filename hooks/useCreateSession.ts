"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { ItemForm, ParticipantForm } from "@/types"

export type TaxConfig = {
  enabled: boolean
  type: "percentage" | "fixed"
  value: string
}

export function useCreateSession() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sessionName, setSessionName] = useState("")
  const [items, setItems] = useState<ItemForm[]>([{ name: "", price: "" }])
  const [participants, setParticipants] = useState<ParticipantForm[]>([{ name: "" }])
  const [qrFile, setQrFile] = useState<File | null>(null)

  const [tax, setTax] = useState<TaxConfig>({
    enabled: false,
    type: "percentage",
    value: "",
  })

  const [service, setService] = useState<TaxConfig>({
    enabled: false,
    type: "percentage",
    value: "",
  })

  const validate = (): string | null => {
    if (!sessionName.trim()) return "Sila taip nama session"
    if (items.some((i) => !i.name.trim() || !i.price)) return "Sila isi semua item"
    if (participants.some((p) => !p.name.trim())) return "Sila isi semua nama peserta"
    if (participants.length < 1) return "Tambah sekurang-kurangnya seorang peserta"
    if (tax.enabled && !tax.value) return "Sila isi nilai tax"
    if (service.enabled && !service.value) return "Sila isi nilai service charge"
    return null
  }

  const uploadQR = async (sessionId: string): Promise<string | null> => {
    if (!qrFile) return null

    const fileExt = qrFile.name.split(".").pop()
    const fileName = `${sessionId}/qr.${fileExt}`

    const { error } = await supabase.storage
      .from("session-uploads")
      .upload(fileName, qrFile, { upsert: true })

    if (error) {
      console.error("QR upload error:", error)
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from("session-uploads")
      .getPublicUrl(fileName)

    return publicUrl
  }

  const createSession = async () => {
    const error = validate()
    if (error) {
      alert(error)
      return
    }

    setLoading(true)

    try {
      // 1. Create session
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          name: sessionName,
          mode: "normal",
          status: "open",
          tax_type: tax.enabled ? tax.type : null,
          tax_value: tax.enabled ? parseFloat(tax.value) : 0,
          service_type: service.enabled ? service.type : null,
          service_value: service.enabled ? parseFloat(service.value) : 0,
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      // 2. Upload QR if provided, update session
      if (qrFile) {
        const qrUrl = await uploadQR(session.id)
        if (qrUrl) {
          await supabase
            .from("sessions")
            .update({ qr_image_url: qrUrl })
            .eq("id", session.id)
        }
      }

    // 3. Create participants
const participantRows = participants.map((p, index) => ({
  session_id: session.id,
  name: p.name.trim(),
  is_owner: index === 0,
}))

const { data: createdParticipants, error: participantsError } = await supabase
  .from("participants")
  .insert(participantRows)
  .select()

if (participantsError) throw participantsError

// Save owner's participant ID to localStorage so they skip name picker
const owner = createdParticipants?.find((p) => p.is_owner)
if (owner) {
  if (typeof window !== "undefined") {
    localStorage.setItem(`session_${session.id}_participant`, owner.id)
  }
}

      // 4. Create items
      const itemRows = items.map((item) => ({
        session_id: session.id,
        name: item.name.trim(),
        price: parseFloat(item.price),
      }))

      const { error: itemsError } = await supabase.from("items").insert(itemRows)

      if (itemsError) throw itemsError

      // 5. Redirect
      router.push(`/session/${session.id}`)
    } catch (error: any) {
      alert("Error: " + error.message)
      setLoading(false)
    }
  }

  return {
    sessionName,
    setSessionName,
    items,
    setItems,
    participants,
    setParticipants,
    tax,
    setTax,
    service,
    setService,
    qrFile,
    setQrFile,
    loading,
    createSession,
  }
}