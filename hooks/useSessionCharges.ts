"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { SessionCharge } from "@/types"

export function useSessionCharges(sessionId: string) {
  const [charges, setCharges] = useState<SessionCharge[]>([])
  const [loading, setLoading] = useState(true)

  const loadCharges = async () => {
    const { data, error } = await supabase
      .from("session_charges")
      .select("*")
      .eq("session_id", sessionId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })

    if (!error && data) {
      setCharges(data as SessionCharge[])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!sessionId) return

    loadCharges()

    const channel = supabase
      .channel(`session-charges-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_charges",
          filter: `session_id=eq.${sessionId}`,
        },
        () => loadCharges()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  // Add a charge (appended after existing ones)
  const addCharge = async (
    label: string | null,
    chargeType: "percentage" | "fixed",
    chargeValue: number
  ): Promise<SessionCharge> => {
    const { data, error } = await supabase
      .from("session_charges")
      .insert({
        session_id: sessionId,
        label: label && label.trim() ? label.trim() : null,
        charge_type: chargeType,
        charge_value: chargeValue,
        display_order: charges.length,
      })
      .select()
      .single()

    if (error) throw error
    return data as SessionCharge
  }

  // Update an existing charge
  const updateCharge = async (
    id: string,
    fields: Partial<Pick<SessionCharge, "label" | "charge_type" | "charge_value">>
  ) => {
    const patch: Record<string, unknown> = {}
    if ("label" in fields) {
      patch.label = fields.label && fields.label.trim() ? fields.label.trim() : null
    }
    if ("charge_type" in fields) patch.charge_type = fields.charge_type
    if ("charge_value" in fields) patch.charge_value = fields.charge_value

    const { error } = await supabase
      .from("session_charges")
      .update(patch)
      .eq("id", id)

    if (error) throw error
  }

  // Delete a charge
  const deleteCharge = async (id: string) => {
    const { error } = await supabase
      .from("session_charges")
      .delete()
      .eq("id", id)

    if (error) throw error
  }

  return {
    charges,
    loading,
    addCharge,
    updateCharge,
    deleteCharge,
  }
}
