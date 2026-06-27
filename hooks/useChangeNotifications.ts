"use client"

import { useEffect, useRef } from "react"
import { useToast } from "./useToast"

type Args = {
  participantId: string | null
  participants: any[]
  items: any[]
  allAssignments: any[]
  isInitialLoad: boolean
}

export function useChangeNotifications({
  participantId,
  participants,
  items,
  allAssignments,
  isInitialLoad,
}: Args) {
  const { showToast } = useToast()

  const prevItems = useRef<any[]>([])
  const prevParticipants = useRef<any[]>([])
  const prevAssignments = useRef<any[]>([])

  useEffect(() => {
    // Skip during initial load
    if (isInitialLoad) {
      prevItems.current = items
      prevParticipants.current = participants
      prevAssignments.current = allAssignments
      return
    }

    // ITEMS - added/removed/edited
    const prevItemIds = new Set(prevItems.current.map((i) => i.id))
    const currItemIds = new Set(items.map((i) => i.id))

    items.forEach((item) => {
      if (!prevItemIds.has(item.id)) {
        showToast(`🍔 New item added: ${item.name}`, "info")
      } else {
        const prev = prevItems.current.find((i) => i.id === item.id)
        if (
          prev &&
          (prev.name !== item.name ||
            Number(prev.price) !== Number(item.price) ||
            Number(prev.quantity) !== Number(item.quantity))
        ) {
          showToast(`✏️ Item updated: ${item.name}`, "info")
        }
      }
    })

    prevItems.current.forEach((item) => {
      if (!currItemIds.has(item.id)) {
        showToast(`🗑️ Item removed: ${item.name}`, "info")
      }
    })

    // PARTICIPANTS - added/removed
    const prevPIds = new Set(prevParticipants.current.map((p) => p.id))
    const currPIds = new Set(participants.map((p) => p.id))

    participants.forEach((p) => {
      if (!prevPIds.has(p.id)) {
        showToast(`👋 ${p.name} joined`, "info")
      }
    })

    prevParticipants.current.forEach((p) => {
      if (!currPIds.has(p.id)) {
        showToast(`👋 ${p.name} left`, "info")
      }
    })

    // SHARES - only notify the current participant about shares involving them
    if (participantId) {
      const prevShareRows = prevAssignments.current.filter(
        (a) => a.share_group_id !== null
      )
      const currShareRows = allAssignments.filter((a) => a.share_group_id !== null)

      // Group by share_group_id for both
      const prevGroups = new Map<string, any[]>()
      prevShareRows.forEach((row) => {
        const g = prevGroups.get(row.share_group_id) || []
        g.push(row)
        prevGroups.set(row.share_group_id, g)
      })

      const currGroups = new Map<string, any[]>()
      currShareRows.forEach((row) => {
        const g = currGroups.get(row.share_group_id) || []
        g.push(row)
        currGroups.set(row.share_group_id, g)
      })

      // Check NEW share groups (I was tagged)
      currGroups.forEach((members, groupId) => {
        if (prevGroups.has(groupId)) return

        const myMembership = members.find(
          (m) => m.participant_id === participantId
        )
        if (!myMembership) return

        // I was just tagged - only notify if I'm NOT the initiator
        if (myMembership.assigned_by_participant_id !== participantId) {
          const initiator = participants.find(
            (p) => p.id === myMembership.assigned_by_participant_id
          )
          const item = items.find((i) => i.id === myMembership.item_id)
          const initiatorName = initiator?.name || "Someone"
          const itemName = item?.name || "an item"
          showToast(
            `🔔 ${initiatorName} wants to share ${itemName} with you`,
            "info"
          )
        }
      })

      // Check status changes within existing share groups
      currGroups.forEach((currMembers, groupId) => {
        const prevMembers = prevGroups.get(groupId)
        if (!prevMembers) return

        // Find my share in this group
        const myShare = currMembers.find(
          (m) => m.participant_id === participantId
        )
        if (!myShare) return

        // Only notify me if I initiated this share
        const isInitiator = myShare.assigned_by_participant_id === participantId
        if (!isInitiator) return

        const item = items.find((i) => i.id === myShare.item_id)
        const itemName = item?.name || "an item"

        // Check each other member for status change
        currMembers.forEach((currMember) => {
          if (currMember.participant_id === participantId) return

          const prevMember = prevMembers.find(
            (m) => m.participant_id === currMember.participant_id
          )
          if (!prevMember) return

          if (
            prevMember.status === "pending" &&
            currMember.status === "confirmed"
          ) {
            const memberP = participants.find(
              (p) => p.id === currMember.participant_id
            )
            showToast(
              `✅ ${memberP?.name || "Someone"} accepted your share of ${itemName}`,
              "success"
            )
          }
          if (
            prevMember.status === "pending" &&
            currMember.status === "rejected"
          ) {
            const memberP = participants.find(
              (p) => p.id === currMember.participant_id
            )
            showToast(
              `❌ ${memberP?.name || "Someone"} rejected your share of ${itemName}`,
              "error"
            )
          }
        })
      })
    }

    // Update refs
    prevItems.current = items
    prevParticipants.current = participants
    prevAssignments.current = allAssignments
  }, [items, participants, allAssignments, participantId, isInitialLoad, showToast])
}