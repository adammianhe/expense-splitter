"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { ItemForm, ParticipantForm } from "@/types"
import { PaymentMethodDraft } from "@/app/create/_components/PaymentMethodsSection"
import { ChargeInput } from "@/app/create/_components/ChargesSection"
import { addStoredSession } from "@/lib/sessionHistory"
import { useAuth } from "@/contexts/AuthContext"
import { addUserSession } from "@/lib/userSessionsApi"
import { addToRetryQueue } from "@/lib/syncRetryQueue"
import { useToast } from "@/hooks/useToast"
import { readCreateDraft, writeCreateDraft, clearCreateDraft } from "@/lib/createDraft"
import posthog from "posthog-js"

const EMPTY_ITEM: ItemForm = { name: "", price: "", quantity: "1", priceMode: "each" }

export function useCreateSession() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { toasts, showToast, dismissToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [sessionName, setSessionName] = useState("")
  const [items, setItems] = useState<ItemForm[]>([{ ...EMPTY_ITEM }])
const [receiptFiles, setReceiptFiles] = useState<File[]>([])
  const [participants, setParticipants] = useState<ParticipantForm[]>([{ name: "" }])
  const [qrFile, setQrFile] = useState<File | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodDraft[]>([])
  const [charges, setCharges] = useState<ChargeInput[]>([])
  const restoredRef = useRef(false)

  // Restore draft when navigating back via the undo toast
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true

    if (searchParams.get("restore") !== "true") return

    const draft = readCreateDraft()
    if (draft) {
      setSessionName(draft.sessionName || "")
      setItems(draft.items?.length ? draft.items : [{ ...EMPTY_ITEM }])
      setParticipants(draft.participants?.length ? draft.participants : [{ name: "" }])
      setCharges(draft.charges || [])
      showToast("Draft restored", "success")
    }
    router.replace("/create")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save serializable form fields to sessionStorage on every change,
  // so the logo-nav undo toast can offer a restore without prop drilling.
  useEffect(() => {
    const hasData =
      sessionName.trim() !== "" ||
      items.some((i) => i.name.trim() !== "" || i.price !== "") ||
      participants.some((p) => p.name.trim() !== "")

    if (hasData) {
      writeCreateDraft({ sessionName, items, participants, charges })
    } else {
      clearCreateDraft()
    }
  }, [sessionName, items, participants, charges])

  const validate = (): string | null => {
    if (!sessionName.trim()) return "Please enter a session name"
    if (items.some((i) => !i.name.trim() || !i.price || !i.quantity)) return "Please fill in all items"
if (items.some((i) => parseInt(i.quantity) < 1)) return "Quantity must be at least 1"
    if (participants.some((p) => !p.name.trim())) return "Please fill in all participant names"
    if (participants.length < 1) return "Please add at least one participant"
    if (charges.some((c) => c.charge_value === "" || parseFloat(c.charge_value) < 0))
      return "Please enter a valid value for each charge"
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
    const startTime = Date.now()

    try {
      // 1. Create session
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          name: sessionName,
          mode: "normal",
          status: "open",
          // Unified charges now live in the session_charges table. Legacy
          // tax/service columns are left empty for backward compat; types are
          // null (values 0) so old-session fallback logic treats them as absent.
          tax_type: null,
          tax_value: 0,
          service_type: null,
          service_value: 0,
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
  const joinedAt = new Date().toISOString()
  try {
    addStoredSession({
      sessionId: session.id,
      participantId: ownerParticipant.id,
      role: "owner",
      sessionName: sessionName.trim(),
      joinedAt,
    })
  } catch {
    // best effort
  }

  if (user) {
    addUserSession({
      userId: user.id,
      sessionId: session.id,
      participantId: ownerParticipant.id,
      role: "owner",
      joinedAt,
    }).then((result) => {
      if (result.error) {
        addToRetryQueue({
          sessionId: session.id,
          participantId: ownerParticipant.id,
          role: "owner",
          joinedAt,
          attemptedAt: new Date().toISOString(),
        })
      }
    }).catch(() => {
      addToRetryQueue({
        sessionId: session.id,
        participantId: ownerParticipant.id,
        role: "owner",
        joinedAt,
        attemptedAt: new Date().toISOString(),
      })
    })
  }
}

      // 4. Create items - convert to per-item price if mode is "total"
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
      // Best effort - don't fail session creation
      console.error("Receipt upload error:", e)
    }
  }
}

      // 6. Upload payment methods (multiple QRs). Legacy single qr_image_url
      // above still works for backward compat; these are the new multi-QR rows.
      // Errors here are surfaced (alert + console) instead of swallowed, so a
      // failed upload/insert is visible rather than silently dropping the QR.
      if (paymentMethods.length > 0) {
        const pmErrors: string[] = []
        for (let i = 0; i < paymentMethods.length; i++) {
          const { file, label } = paymentMethods[i]
          const tag = label && label.trim() ? label.trim() : `QR ${i + 1}`
          try {
            const ext = file.name.split(".").pop() || "jpg"
            const fileName = `payment-methods/${session.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

            const { error: uploadError } = await supabase.storage
              .from("session-uploads")
              .upload(fileName, file, { cacheControl: "3600", upsert: false })

            if (uploadError) {
              console.error("Payment method storage upload error:", uploadError)
              pmErrors.push(`${tag}: ${uploadError.message}`)
              continue
            }

            const { data: urlData } = supabase.storage
              .from("session-uploads")
              .getPublicUrl(fileName)

            const { error: insertError } = await supabase
              .from("payment_methods")
              .insert({
                session_id: session.id,
                image_url: urlData.publicUrl,
                label: label && label.trim() ? label.trim() : null,
                display_order: i,
              })

            if (insertError) {
              console.error("Payment method DB insert error:", insertError)
              pmErrors.push(`${tag}: ${insertError.message}`)
            }
          } catch (e: any) {
            console.error("Payment method upload error:", e)
            pmErrors.push(`${tag}: ${e?.message || e}`)
          }
        }
        if (pmErrors.length > 0) {
          alert("Some payment QR codes failed to save:\n" + pmErrors.join("\n"))
        }
      }

      // 7. Insert additional charges (unified tax/service/tip rows)
      if (charges.length > 0) {
        const chargeRows = charges.map((c, i) => ({
          session_id: session.id,
          label: c.label && c.label.trim() ? c.label.trim() : null,
          charge_type: c.charge_type,
          charge_value: parseFloat(c.charge_value) || 0,
          display_order: i,
        }))

        const { error: chargesError } = await supabase
          .from("session_charges")
          .insert(chargeRows)

        if (chargesError) {
          console.error("Session charges insert error:", chargesError)
          alert("Some charges failed to save: " + chargesError.message)
        }
      }

      if (itemsError) throw itemsError

      try {
        if (typeof window !== "undefined") {
          posthog.capture("session_created", {
            session_id: session.id,
            item_count: items.length,
            participant_count: participants.length,
            has_tax: charges?.length > 0,
            has_qr: paymentMethods?.length > 0,
          })
        }
      } catch {
        // best effort
      }

      // 5. Redirect
      // BEFORE redirecting, ensure minimum 500ms loading time
    const elapsed = Date.now() - startTime
    if (elapsed < 500) {
      await new Promise((resolve) => setTimeout(resolve, 500 - elapsed))
    }
      clearCreateDraft()
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
    charges,
    setCharges,
    qrFile,
    setQrFile,
    paymentMethods,
    setPaymentMethods,
    loading,
    createSession,
    receiptFiles,
  setReceiptFiles,
    toasts,
    dismissToast,
  }
}