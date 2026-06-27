"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { PaymentMethod } from "@/types"

export function usePaymentMethods(sessionId: string) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)

  const loadPaymentMethods = async () => {
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("session_id", sessionId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })

    if (!error && data) {
      setPaymentMethods(data as PaymentMethod[])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!sessionId) return

    loadPaymentMethods()

    const channel = supabase
      .channel(`payment-methods-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payment_methods",
          filter: `session_id=eq.${sessionId}`,
        },
        () => loadPaymentMethods()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  // Upload a payment method QR image (with optional label)
  const uploadPaymentMethod = async (
    file: File,
    label: string | null = null
  ): Promise<PaymentMethod> => {
    // Validate
    if (!file.type.startsWith("image/")) {
      throw new Error("File must be an image")
    }
    // Limit to ~10MB
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Image too large (max 10MB)")
    }

    // Generate filename: payment-methods/{sessionId}/{timestamp}_{random}.{ext}
    const ext = file.name.split(".").pop() || "jpg"
    const fileName = `payment-methods/${sessionId}/${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`

    // Upload to storage (same session-uploads bucket as receipts)
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

    // Insert DB record, appended after existing methods
    const { data, error: dbError } = await supabase
      .from("payment_methods")
      .insert({
        session_id: sessionId,
        image_url: publicUrl,
        label: label && label.trim() ? label.trim() : null,
        display_order: paymentMethods.length,
      })
      .select()
      .single()

    if (dbError) throw dbError

    return data as PaymentMethod
  }

  // Update a payment method's label
  const updatePaymentMethodLabel = async (id: string, label: string) => {
    const { error } = await supabase
      .from("payment_methods")
      .update({ label: label.trim() ? label.trim() : null })
      .eq("id", id)

    if (error) throw error
  }

  // Delete a payment method (DB record + storage file)
  const deletePaymentMethod = async (method: PaymentMethod) => {
    // Try to extract path from URL for storage deletion
    // URL format: https://{project}.supabase.co/storage/v1/object/public/session-uploads/payment-methods/...
    const urlParts = method.image_url.split("/session-uploads/")
    const filePath = urlParts[1]

    if (filePath) {
      // Best-effort storage deletion (ignore errors so DB still deletes)
      await supabase.storage.from("session-uploads").remove([filePath])
    }

    // Delete DB record
    const { error } = await supabase
      .from("payment_methods")
      .delete()
      .eq("id", method.id)

    if (error) throw error
  }

  return {
    paymentMethods,
    loading,
    uploadPaymentMethod,
    updatePaymentMethodLabel,
    deletePaymentMethod,
  }
}
