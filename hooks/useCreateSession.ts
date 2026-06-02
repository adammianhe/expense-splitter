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
  const [items, setItems] = useState<ItemForm[]>([
  { name: "", price: "", quantity: "1", priceMode: "each" }
])
const [receiptFiles, setReceiptFiles] = useState<File[]>([])
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
    if (!sessionName.trim()) return "Please enter a session name"
    if (items.some((i) => !i.name.trim() || !i.price || !i.quantity)) return "Please fill in all items"
if (items.some((i) => parseInt(i.quantity) < 1)) return "Quantity must be at least 1"
    if (participants.some((p) => !p.name.trim())) return "Please fill in all participant names"
    if (participants.length < 1) return "Please add at least one participant"
    if (tax.enabled && !tax.value) return "Please enter a tax value"
    if (service.enabled && !service.value) return "Please enter a service charge value"
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

const { data: insertedParticipants, error: participantsError } = await supabase
  .from("participants")
  .insert(participantRows)
  .select()

if (participantsError) throw participantsError

// Find the owner participant (first one inserted)
const ownerParticipant = insertedParticipants?.find((p: any) => p.is_owner)

// Save owner's participant ID to localStorage so they skip name picker
if (ownerParticipant && typeof window !== "undefined") {
  localStorage.setItem(`session_${session.id}_participant`, ownerParticipant.id)
}

      // 4. Create items — convert to per-item price if mode is "total"
const itemRows = items.map((item) => {
  const qty = parseInt(item.quantity) || 1
  const inputPrice = parseFloat(item.price)
  const pricePerItem = item.priceMode === "total" ? inputPrice / qty : inputPrice



  return {
    session_id: session.id,
    name: item.name.trim(),
    price: Math.round(pricePerItem * 100) / 100,
    quantity: qty,
  }
})

      const { error: itemsError } = await supabase.from("items").insert(itemRows)

      // 5. Upload receipts (if any)
if (receiptFiles.length > 0) {
  for (const file of receiptFiles) {
    try {
      const ext = file.name.split(".").pop() || "jpg"
      const fileName = `receipts/${session.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from("session-uploads")
        .upload(fileName, file, { cacheControl: "3600", upsert: false })

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("session-uploads")
          .getPublicUrl(fileName)

        await supabase.from("receipts").insert({
          session_id: session.id,
          image_url: urlData.publicUrl,
          uploaded_by_participant_id: ownerParticipant.id,
        })
      }
    } catch (e) {
      // Best effort — don't fail session creation
      console.error("Receipt upload error:", e)
    }
  }
}

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
    receiptFiles,
  setReceiptFiles,
  }
}