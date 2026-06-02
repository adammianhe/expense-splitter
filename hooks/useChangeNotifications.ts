"use client"

import { useEffect, useRef } from "react"
import { Item, Participant } from "@/types"

type ShowToastFn = (text: string, type?: "info" | "success" | "warning" | "error") => void

export function useChangeNotifications(
  items: Item[],
  participants: Participant[],
  showToast: ShowToastFn,
  isReady: boolean
) {
  const prevItemsRef = useRef<Item[]>([])
  const prevParticipantsRef = useRef<Participant[]>([])
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!isReady) return

    // Skip first render (when data first loads)
    if (!initializedRef.current) {
      prevItemsRef.current = items
      prevParticipantsRef.current = participants
      initializedRef.current = true
      return
    }

    const prevItems = prevItemsRef.current
    const prevParticipants = prevParticipantsRef.current

    // Detect added items
    const addedItems = items.filter(
      (i) => !prevItems.some((pi) => pi.id === i.id)
    )
    addedItems.forEach((item) => {
      showToast(`+ ${item.name} added (RM ${Number(item.price).toFixed(2)})`, "info")
    })

    // Detect deleted items
    const deletedItems = prevItems.filter(
      (pi) => !items.some((i) => i.id === pi.id)
    )
    deletedItems.forEach((item) => {
      showToast(`${item.name} removed — bill updated`, "warning")
    })

    // Detect edited items
    items.forEach((item) => {
      const prev = prevItems.find((pi) => pi.id === item.id)
      if (prev && (prev.name !== item.name || Number(prev.price) !== Number(item.price))) {
        showToast(`${item.name} updated`, "info")
      }
    })

    // Detect added participants
    const addedParticipants = participants.filter(
      (p) => !prevParticipants.some((pp) => pp.id === p.id)
    )
    addedParticipants.forEach((p) => {
      showToast(`${p.name} joined the session`, "info")
    })

    // Detect removed participants
    const removedParticipants = prevParticipants.filter(
      (pp) => !participants.some((p) => p.id === pp.id)
    )
    removedParticipants.forEach((p) => {
      showToast(`${p.name} removed from session`, "warning")
    })

    prevItemsRef.current = items
    prevParticipantsRef.current = participants
  }, [items, participants, showToast, isReady])
}