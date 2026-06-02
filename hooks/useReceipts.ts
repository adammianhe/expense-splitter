"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Receipt } from "@/types"

export function useReceipts(sessionId: string) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)

  const loadReceipts = async () => {
    const { data, error } = await supabase
      .from("receipts")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })

    if (!error && data) {
      setReceipts(data as Receipt[])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!sessionId) return

    loadReceipts()

    const channel = supabase
      .channel(`receipts-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "receipts",
          filter: `session_id=eq.${sessionId}`,
        },
        () => loadReceipts()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  // Upload a receipt image
  const uploadReceipt = async (
    file: File,
    uploadedByParticipantId: string | null = null
  ): Promise<Receipt> => {
    // Validate
    if (!file.type.startsWith("image/")) {
      throw new Error("File must be an image")
    }
    // Limit to ~10MB
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Image too large (max 10MB)")
    }

    // Generate filename: receipts/{sessionId}/{timestamp}_{random}.{ext}
    const ext = file.name.split(".").pop() || "jpg"
    const fileName = `receipts/${sessionId}/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("session-uploads")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) throw uploadError

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("session-uploads")
      .getPublicUrl(fileName)

    const publicUrl = urlData.publicUrl

    // Insert DB record
    const { data, error: dbError } = await supabase
      .from("receipts")
      .insert({
        session_id: sessionId,
        image_url: publicUrl,
        uploaded_by_participant_id: uploadedByParticipantId,
      })
      .select()
      .single()

    if (dbError) throw dbError

    return data as Receipt
  }

  // Delete a receipt (DB record + storage file)
  const deleteReceipt = async (receipt: Receipt) => {
    // Try to extract path from URL for storage deletion
    // URL format: https://{project}.supabase.co/storage/v1/object/public/session-uploads/receipts/...
    const urlParts = receipt.image_url.split("/session-uploads/")
    const filePath = urlParts[1]

    if (filePath) {
      // Best-effort storage deletion (ignore errors so DB still deletes)
      await supabase.storage.from("session-uploads").remove([filePath])
    }

    // Delete DB record
    const { error } = await supabase
      .from("receipts")
      .delete()
      .eq("id", receipt.id)

    if (error) throw error
  }

  return {
    receipts,
    loading,
    uploadReceipt,
    deleteReceipt,
  }
}