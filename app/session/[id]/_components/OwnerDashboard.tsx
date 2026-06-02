"use client"

import { useState } from "react"
import { Session, Participant, Item } from "@/types"
import { ParticipantBill } from "@/hooks/useSessionBills"
import { calculateBill, roundToTwoDecimals, formatRelativeDate } from "@/lib/utils"
import Button from "@/components/ui/Button"
import ItemsEditor from "./ItemsEditor"
import SharePickerModal from "./SharePickerModal"
import ReceiptManager from "./ReceiptManager"
import { Link2, Pencil, Banknote, Bell, Lock, AlertTriangle, Camera, Share2, Plus, X, Check } from "lucide-react"

type Props = {
  receipts: import("@/types").Receipt[]
onUploadReceipt: (file: File) => Promise<void>
onDeleteReceipt: (receipt: import("@/types").Receipt) => Promise<void>
  session: Session
  participant: Participant
  bills: ParticipantBill[]
  items: Item[]
  soloQty: Map<string, number>
  allAssignments: any[]
  summary: {
    totalBill: number
    totalCollected: number
    totalPending: number
    totalOutstanding: number
  }
  lockedItemIds: Set<string>
  isItemLocked: (itemId: string) => boolean
  canDeleteParticipant: (participantId: string, allAssignments: any[]) => boolean
  onAddItem: (name: string, price: number, quantity: number) => Promise<void>
  onUpdateItem: (itemId: string, name: string, price: number, quantity: number) => Promise<void>
  onDeleteItem: (itemId: string) => Promise<void>
  onAddParticipant: (name: string) => Promise<void>
  onDeleteParticipant: (participantId: string) => Promise<void>
  onIncrementItem: (itemId: string) => void
  onDecrementItem: (itemId: string) => void
  onCreateShare: (itemId: string, quantity: number, taggedIds: string[]) => Promise<void>
  onConfirmShare: (shareGroupId: string) => Promise<void>
  onRejectShare: (shareGroupId: string) => Promise<void>
  onRemoveShare: (shareGroupId: string) => Promise<void>
  onSwitchName: () => void
  onVerify: (paymentId: string) => Promise<void>
  onUnverify: (paymentId: string) => Promise<void>
  onMarkAsCash: (
    participantId: string,
    amount: number,
    paidItemIds: string[],
    paidItemQuantities: Record<string, number>,
    paidShareGroupIds: string[]
  ) => Promise<void>
  onOwnerConfirm: (
    participantId: string,
    amount: number,
    paidItemIds: string[],
    paidItemQuantities: Record<string, number>,
    paidShareGroupIds: string[]
  ) => Promise<void>
}

export default function OwnerDashboard({
  receipts,
  onUploadReceipt,
  onDeleteReceipt,
  session,
  participant,
  bills,
  items,
  soloQty,
  allAssignments,
  summary,
  lockedItemIds,
  isItemLocked,
  canDeleteParticipant,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onAddParticipant,
  onDeleteParticipant,
  onIncrementItem,
  onDecrementItem,
  onCreateShare,
  onConfirmShare,
  onRejectShare,
  onRemoveShare,
  onSwitchName,
  onVerify,
  onUnverify,
  onMarkAsCash,
  onOwnerConfirm,
}: Props) {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [addingParticipant, setAddingParticipant] = useState(false)
  const [newParticipantName, setNewParticipantName] = useState("")
  const [processingParticipant, setProcessingParticipant] = useState(false)
  const [shareItem, setShareItem] = useState<Item | null>(null)

  // Owner's bill data
  const myBill = bills.find((b) => b.participant.id === participant.id)
  const myPayment = myBill?.payment
  const paidItemQuantities: Record<string, number> =
    (myPayment as any)?.paid_item_quantities || {}
  const paidShareGroupIds = new Set<string>(
    (myPayment as any)?.paid_share_group_ids || []
  )

  const mySolo = (itemId: string): number => soloQty.get(itemId) || 0
  const myPaidQty = (itemId: string): number => paidItemQuantities[itemId] || 0

  const allParticipants = bills.map((b) => b.participant)

  // ============================================
  // SHARE GROUP HELPERS
  // ============================================

  const getItemShareGroups = (itemId: string) => {
    const groupIds = new Set(
      allAssignments
        .filter((a) => a.item_id === itemId && a.share_group_id !== null)
        .map((a) => a.share_group_id)
    )

    return Array.from(groupIds).map((groupId) => {
      const members = allAssignments.filter((a) => a.share_group_id === groupId)
      const quantity = Number(members[0]?.quantity || 0)
      const initiatorId = members[0]?.assigned_by_participant_id
      const allConfirmed = members.every((m) => m.status === "confirmed")
      const myMembership = members.find((m) => m.participant_id === participant.id)

      return {
        groupId: groupId as string,
        quantity,
        initiatorId,
        members: members.map((m) => {
          const p = allParticipants.find((pp) => pp.id === m.participant_id)
          return {
            id: m.participant_id,
            name: p?.name || "Unknown",
            status: m.status as "pending" | "confirmed" | "rejected",
            isInitiator: m.participant_id === initiatorId,
          }
        }),
        allConfirmed,
        myStatus: myMembership?.status,
        isMine: !!myMembership,
        isInitiator: initiatorId === participant.id,
        isPaid: paidShareGroupIds.has(groupId as string),
      }
    })
  }

  const getTotalClaimed = (itemId: string): number => {
    const solo = allAssignments
      .filter(
        (a) =>
          a.item_id === itemId &&
          a.share_group_id === null &&
          a.status === "confirmed"
      )
      .reduce((s, a) => s + Number(a.quantity), 0)

    const shareGroupIds = new Set(
      allAssignments
        .filter((a) => a.item_id === itemId && a.share_group_id !== null)
        .map((a) => a.share_group_id)
    )

    let shareTotal = 0
    for (const groupId of shareGroupIds) {
      const members = allAssignments.filter((a) => a.share_group_id === groupId)
      const allConfirmed = members.every((m) => m.status === "confirmed")
      if (allConfirmed) shareTotal += Number(members[0].quantity)
    }

    return solo + shareTotal
  }

  // Calculate owner's share of an item (solo + confirmed shares)
  const calculateMyItemShare = (item: Item): number => {
    let total = 0
    const solo = mySolo(item.id)
    if (solo > 0) total += solo * Number(item.price)

    const shares = getItemShareGroups(item.id).filter(
      (g) => g.isMine && g.allConfirmed
    )
    for (const g of shares) {
      total += (g.quantity * Number(item.price)) / g.members.length
    }
    return total
  }

  // ============================================
  // PAYMENT CALCULATION (delta model)
  // ============================================

  const itemsWithMyPendingShares = new Set(
    items
      .filter((item) =>
        getItemShareGroups(item.id).some(
          (g) => g.isMine && !g.allConfirmed
        )
      )
      .map((i) => i.id)
  )

  // New unpaid stuff to confirm
  const unpaidSoloItems: { item: Item; deltaQty: number; deltaAmount: number }[] = []
  items.forEach((item) => {
    if (itemsWithMyPendingShares.has(item.id)) return
    const totalSolo = mySolo(item.id)
    const paidSolo = myPaidQty(item.id)
    const deltaQty = totalSolo - paidSolo
    if (deltaQty > 0) {
      unpaidSoloItems.push({
        item,
        deltaQty,
        deltaAmount: deltaQty * Number(item.price),
      })
    }
  })

  // Unpaid confirmed shares
  const unpaidShareInfo: { total: number; paidGroupIds: string[] } = (() => {
    let total = 0
    const newlyPaidGroupIds: string[] = []
    items.forEach((item) => {
      const shares = getItemShareGroups(item.id).filter(
        (g) => g.isMine && g.allConfirmed && !g.isPaid
      )
      for (const g of shares) {
        total += (g.quantity * Number(item.price)) / g.members.length
        newlyPaidGroupIds.push(g.groupId)
      }
    })
    return { total, paidGroupIds: newlyPaidGroupIds }
  })()

  const newUnpaidSubtotal =
    unpaidSoloItems.reduce((sum, x) => sum + x.deltaAmount, 0) +
    unpaidShareInfo.total

  const totalSessionSubtotal = items.reduce((sum, item) => {
    const claimed = getTotalClaimed(item.id)
    const effective = Math.min(claimed, item.quantity)
    return sum + Number(item.price) * effective
  }, 0)

  const newBill = calculateBill(newUnpaidSubtotal, totalSessionSubtotal, session)
  const newTotalToConfirm = roundToTwoDecimals(newBill.total)

  const hasTax = session.tax_type && Number(session.tax_value) > 0
  const hasService = session.service_type && Number(session.service_value) > 0

  const payerNames: Record<string, string[]> = {}
  items.forEach((item) => {
    const payers = bills
      .filter((b) => {
        const paidIds = b.payment?.paid_item_ids || []
        return paidIds.includes(item.id) && (b.isVerified || b.isClaimed)
      })
      .map((b) => b.participant.name)
    payerNames[item.id] = payers
  })

  // ============================================
  // CONFIRM HANDLER
  // ============================================

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      // Build new quantities map (paid + new deltas)
      const newQuantities: Record<string, number> = { ...paidItemQuantities }
      const newItemIds: string[] = [
        ...((myPayment as any)?.paid_item_ids || []),
      ]

      unpaidSoloItems.forEach(({ item, deltaQty }) => {
        newQuantities[item.id] = (newQuantities[item.id] || 0) + deltaQty
        if (!newItemIds.includes(item.id)) newItemIds.push(item.id)
      })

      unpaidShareInfo.paidGroupIds.forEach((groupId) => {
        const member = allAssignments.find(
          (a) =>
            a.share_group_id === groupId && a.participant_id === participant.id
        )
        if (member && !newItemIds.includes(member.item_id)) {
          newItemIds.push(member.item_id)
        }
      })

      const newShareGroupIds = [
        ...Array.from(paidShareGroupIds),
        ...unpaidShareInfo.paidGroupIds,
      ]

      // Build total amount (previously paid + new delta)
      const newAmount = Number(myPayment?.amount_paid || 0) + newTotalToConfirm

      await onOwnerConfirm(
        participant.id,
        newAmount,
        newItemIds,
        newQuantities,
        newShareGroupIds
      )
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setConfirming(false)
    }
  }

  const handleCreateShare = async (quantity: number, taggedIds: string[]) => {
    if (!shareItem) return
    await onCreateShare(shareItem.id, quantity, taggedIds)
  }

  const handleShare = async () => {
    const url = window.location.href
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      }
    } catch (e) {}
    const textarea = document.createElement("textarea")
    textarea.value = url
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand("copy")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      alert(`Copy this link:\n\n${url}`)
    } finally {
      document.body.removeChild(textarea)
    }
  }

  const handleNudge = async (participantName: string, amount: number) => {
    const url = window.location.href
    const message = `Hey ${participantName}, please pay for the meal 👀 RM ${amount.toFixed(2)} — ${url}`
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(message)
        alert("Message copied! Paste it in WhatsApp.")
        return
      }
    } catch (e) {}
    const textarea = document.createElement("textarea")
    textarea.value = message
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand("copy")
      alert("Message copied! Paste it in WhatsApp.")
    } catch (e) {
      alert(`Copy this message:\n\n${message}`)
    } finally {
      document.body.removeChild(textarea)
    }
  }

  const handleMarkAsCash = async (bill: ParticipantBill) => {
    if (!confirm(`Mark ${bill.participant.name} as paid cash RM ${bill.total.toFixed(2)}?`)) return
    setProcessingId(bill.participant.id)
    try {
      // For "mark as cash", treat their full claim as paid
      const fullQuantities: Record<string, number> = {}
      const fullItemIds: string[] = []
      const fullShareGroupIds: string[] = []

      items.forEach((item) => {
        const solo = allAssignments.find(
          (a) =>
            a.item_id === item.id &&
            a.participant_id === bill.participant.id &&
            a.share_group_id === null &&
            a.status !== "rejected"
        )
        if (solo) {
          fullQuantities[item.id] = Number(solo.quantity)
          fullItemIds.push(item.id)
        }
      })

      const myShareRows = allAssignments.filter(
        (a) =>
          a.participant_id === bill.participant.id &&
          a.share_group_id !== null &&
          a.status === "confirmed"
      )
      myShareRows.forEach((row) => {
        // Check if group is fully confirmed
        const members = allAssignments.filter(
          (a) => a.share_group_id === row.share_group_id
        )
        const allConfirmed = members.every((m) => m.status === "confirmed")
        if (allConfirmed) {
          if (!fullShareGroupIds.includes(row.share_group_id)) {
            fullShareGroupIds.push(row.share_group_id)
          }
          if (!fullItemIds.includes(row.item_id)) {
            fullItemIds.push(row.item_id)
          }
        }
      })

      await onMarkAsCash(
        bill.participant.id,
        bill.total,
        fullItemIds,
        fullQuantities,
        fullShareGroupIds
      )
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleVerify = async (paymentId: string) => {
    setProcessingId(paymentId)
    try {
      await onVerify(paymentId)
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleUnverify = async (paymentId: string) => {
    if (!confirm("Mark this payment as unverified? The person will be notified.")) return
    setProcessingId(paymentId)
    try {
      await onUnverify(paymentId)
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleAddParticipant = async () => {
    if (!newParticipantName.trim()) return
    setProcessingParticipant(true)
    try {
      await onAddParticipant(newParticipantName)
      setNewParticipantName("")
      setAddingParticipant(false)
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setProcessingParticipant(false)
    }
  }

  const handleDeleteParticipant = async (p: Participant) => {
    if (!confirm(`Delete ${p.name} from session?`)) return
    setProcessingId(p.id)
    try {
      await onDeleteParticipant(p.id)
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusBadge = (bill: ParticipantBill) => {
    if (bill.participant.is_owner) {
      if (!bill.hasTicked) {
        return { text: "Owner — no items ticked", color: "bg-purple-100 text-purple-800" }
      }
      if (bill.isVerified && bill.amountOwed === 0) {
        return { text: "✅ Owner — confirmed all", color: "bg-purple-100 text-purple-800" }
      }
      return { text: "Owner — has unconfirmed items", color: "bg-orange-100 text-orange-800" }
    }
    if (!bill.hasTicked) {
  return { text: "Hasn't ticked yet", color: "bg-gray-100 text-gray-600" }
}
    if (bill.hasPendingShares && !bill.payment) {
      return { text: "⏳ Has pending shares", color: "bg-yellow-100 text-yellow-800" }
    }
    if (!bill.payment) {
      return { text: "Ticked, not paid yet", color: "bg-orange-100 text-orange-800" }
    }
    if (bill.isVerified && bill.amountOwed === 0) {
      return { text: "✅ Paid in full", color: "bg-green-100 text-green-800" }
    }
    if (bill.isVerified && bill.amountOwed > 0) {
      return { text: "Partially paid", color: "bg-blue-100 text-blue-800" }
    }
    if (bill.isClaimed) {
      return { text: "⏳ Pending verification", color: "bg-yellow-100 text-yellow-800" }
    }
    if (bill.isUnverified) {
      return { text: "❌ Payment unverified", color: "bg-red-100 text-red-800" }
    }
    return { text: "👻 Not paid yet", color: "bg-gray-100 text-gray-600" }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 pb-32">
      <div className="max-w-md mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase">Owner Dashboard</p>
            <h1 className="text-2xl font-bold text-gray-900">{session.name}</h1>
            <p className="text-xs text-gray-500 mt-1">
              Created {formatRelativeDate(session.created_at)}
            </p>
          </div>
          <Button variant="ghost" onClick={onSwitchName} className="text-sm">
            Switch
          </Button>
        </div>

        <Button variant="secondary" onClick={handleShare} className="w-full text-sm">
  {copied ? (
    <span className="flex items-center justify-center gap-2">
      <Check size={16} />
      Link copied
    </span>
  ) : (
    <span className="flex items-center justify-center gap-2">
      <Link2 size={16} />
      Share Link to Friends
    </span>
  )}
</Button>

        {/* COLLECTION SUMMARY */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="text-xs text-gray-500 font-medium uppercase">
            Collection Summary
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total bill</span>
              <span className="font-medium text-gray-900">
                RM {summary.totalBill.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-green-700">✅ Collected</span>
              <span className="font-medium text-green-700">
                RM {summary.totalCollected.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-yellow-700">⏳ Pending verification</span>
              <span className="font-medium text-yellow-700">
                RM {summary.totalPending.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
              <span className="text-red-700">❌ Outstanding</span>
              <span className="font-bold text-red-700">
                RM {summary.totalOutstanding.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <ReceiptManager
  receipts={receipts}
  canManage={true}
  onUpload={onUploadReceipt}
  onDelete={onDeleteReceipt}
/>

        {/* YOUR BILL */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div>
            <div className="text-xs text-gray-500 font-medium uppercase">
              Your Bill ({participant.name})
            </div>
            <div className="text-xs text-gray-400 mt-1">
              What did you have?
            </div>
          </div>

          <div className="space-y-2">
            {items.map((item) => {
              const mine = mySolo(item.id)
              const paid = myPaidQty(item.id)
              const totalClaimed = getTotalClaimed(item.id)
              const remaining = item.quantity - totalClaimed
              const lockedByOthers =
                lockedItemIds.has(item.id) && mine === 0
              const isFullyClaimed = totalClaimed >= item.quantity

              const canDecrement = mine > paid && !lockedByOthers
              const canIncrement = !lockedByOthers && !isFullyClaimed

              const myShare = calculateMyItemShare(item)
              const shareGroups = getItemShareGroups(item.id)

              const otherSolosNames = allAssignments
                .filter(
                  (a) =>
                    a.item_id === item.id &&
                    a.share_group_id === null &&
                    a.status !== "rejected" &&
                    a.participant_id !== participant.id
                )
                .map((a) => {
                  const p = allParticipants.find((pp) => pp.id === a.participant_id)
                  return p?.name
                })
                .filter(Boolean) as string[]

              const isTicked = mine > 0 || myShare > 0

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border transition ${
                    isTicked
                      ? "bg-black text-white border-black"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {item.name}
                        {item.quantity > 1 && (
                          <span className={`ml-1 text-xs ${isTicked ? "text-gray-300" : "text-gray-500"}`}>
                            (qty: {item.quantity})
                          </span>
                        )}
                      </div>
                      <div className={`text-xs mt-0.5 ${isTicked ? "text-gray-300" : "text-gray-500"}`}>
                        RM {Number(item.price).toFixed(2)} each
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => onDecrementItem(item.id)}
                        disabled={!canDecrement}
                        className={`w-7 h-7 rounded-full font-bold text-base flex items-center justify-center transition ${
                          isTicked
                            ? "bg-white/20 text-white disabled:opacity-30"
                            : "bg-gray-200 text-gray-700 disabled:opacity-30"
                        }`}
                      >
                        −
                      </button>
                      <span className="font-bold text-base w-5 text-center">{mine}</span>
                      <button
                        onClick={() => onIncrementItem(item.id)}
                        disabled={!canIncrement}
                        className={`w-7 h-7 rounded-full font-bold text-base flex items-center justify-center transition ${
                          isTicked
                            ? "bg-white/20 text-white disabled:opacity-30"
                            : "bg-gray-200 text-gray-700 disabled:opacity-30"
                        }`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className={`text-xs mt-2 ${isTicked ? "text-gray-300" : "text-gray-500"}`}>
                    {myShare > 0 && <span>Your share: RM {myShare.toFixed(2)}</span>}
                    {otherSolosNames.length > 0 && (
                      <span>
                        {myShare > 0 ? " • " : ""}
                        {otherSolosNames.join(", ")} claimed
                      </span>
                    )}
                    {item.quantity > 1 && (
                      <>
                        {remaining > 0 && (
                          <>
                            {(myShare > 0 || otherSolosNames.length > 0) && <span> • </span>}
                            <span>{remaining} left</span>
                          </>
                        )}
                        {remaining < 0 && (
                          <>
                            {(myShare > 0 || otherSolosNames.length > 0) && <span> • </span>}
                            <span className="text-yellow-400">over by {Math.abs(remaining)}</span>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {paid > 0 && (
                    <div className={`text-xs mt-1 font-medium ${isTicked ? "text-green-300" : "text-green-600"}`}>
                      ✓ Confirmed for {paid} of {mine}
                    </div>
                  )}

                  {/* Shares display */}
                  {shareGroups.length > 0 && (
                    <div className={`mt-3 pt-3 border-t space-y-2 ${isTicked ? "border-white/20" : "border-gray-200"}`}>
                      {shareGroups.map((g) => {
                        const memberNames = g.members.map((m) => m.name).join(", ")
                        const status = g.isPaid
                          ? "✓ Confirmed/Paid"
                          : g.allConfirmed
                          ? "✓ Confirmed"
                          : g.members.some((m) => m.status === "rejected")
                          ? "❌ Rejected"
                          : "⏳ Pending"

                        return (
                          <div
                            key={g.groupId}
                            className={`text-xs p-2 rounded ${
                              isTicked ? "bg-white/10" : "bg-gray-50"
                            }`}
                          >
                            <div className={`flex items-center justify-between gap-2 ${isTicked ? "text-gray-200" : "text-gray-700"}`}>
                              <span>
                                Share: {g.quantity} × with {memberNames}
                              </span>
                              <span className="font-medium">{status}</span>
                            </div>

                            {g.isMine && g.myStatus === "pending" && !g.isInitiator && (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => onConfirmShare(g.groupId)}
                                  className="flex-1 bg-green-600 text-white text-xs py-1.5 rounded hover:bg-green-700"
                                >
                                  ✓ Accept
                                </button>
                                <button
                                  onClick={() => onRejectShare(g.groupId)}
                                  className="flex-1 bg-red-600 text-white text-xs py-1.5 rounded hover:bg-red-700"
                                >
                                  ✗ Reject
                                </button>
                              </div>
                            )}

                            {g.isInitiator && !g.allConfirmed && !g.isPaid && (
                              <button
                                onClick={() => {
                                  if (confirm("Remove this share?")) onRemoveShare(g.groupId)
                                }}
                                className={`text-xs mt-1 underline ${isTicked ? "text-red-300" : "text-red-600"}`}
                              >
                                Cancel share
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {!lockedByOthers && (
                    <button
                      onClick={() => setShareItem(item)}
                      className={`mt-2 text-xs font-medium ${isTicked ? "text-blue-300" : "text-blue-600"} hover:underline`}
                    >
                      + Add share
                    </button>
                  )}

                  {lockedByOthers && (
  <div className="text-xs mt-1 text-gray-400 font-medium flex items-center gap-1">
    <Lock size={12} />
    Fully claimed by others
  </div>
)}
                </div>
              )
            })}
          </div>

          {/* Pending shares warning */}
          {itemsWithMyPendingShares.size > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800">
              ⏳ Some shares waiting for confirmation
            </div>
          )}

          {/* New unconfirmed bill */}
          {newUnpaidSubtotal > 0 && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="text-xs text-gray-500 font-medium">
                NEW TO CONFIRM
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">
                  RM {newBill.subtotal.toFixed(2)}
                </span>
              </div>
              {hasTax && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium text-gray-900">
                    RM {newBill.tax.toFixed(2)}
                  </span>
                </div>
              )}
              {hasService && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Service</span>
                  <span className="font-medium text-gray-900">
                    RM {newBill.service.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                <span className="font-semibold text-gray-900">Total to confirm</span>
                <span className="text-xl font-bold text-gray-900">
                  RM {newTotalToConfirm.toFixed(2)}
                </span>
              </div>

              <Button
                variant="primary"
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full mt-3 py-3"
              >
                {confirming
                  ? "Saving..."
                  : `Confirm — RM ${newTotalToConfirm.toFixed(2)}`}
              </Button>
            </div>
          )}

          {/* Already confirmed summary */}
          {myPayment && Number(myPayment.amount_paid) > 0 && newUnpaidSubtotal === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-800 text-center">
              ✓ All confirmed — RM {Number(myPayment.amount_paid).toFixed(2)}
            </div>
          )}
        </div>

        <ItemsEditor
          items={items}
          participants={allParticipants}
          allAssignments={allAssignments}
          payerNames={payerNames}
          isItemLocked={isItemLocked}
          onAddItem={onAddItem}
          onUpdateItem={onUpdateItem}
          onDeleteItem={onDeleteItem}
        />

        

        {/* PARTICIPANTS */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-700">
              Participants ({bills.length})
            </h2>
            {!addingParticipant && (
              <Button
                variant="ghost"
                onClick={() => setAddingParticipant(true)}
                className="text-xs px-2"
              >
                + Add
              </Button>
            )}
          </div>

          {addingParticipant && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 space-y-2">
              <input
                type="text"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                placeholder="New participant name"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-black text-gray-900 bg-white"
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAddingParticipant(false)
                    setNewParticipantName("")
                  }}
                  className="flex-1 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleAddParticipant}
                  disabled={processingParticipant}
                  className="flex-1 text-xs"
                >
                  {processingParticipant ? "Adding..." : "Add"}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {bills.map((bill) => {
              const badge = getStatusBadge(bill)
              const isOwner = bill.participant.is_owner
              const isProcessing =
                processingId === bill.participant.id ||
                processingId === bill.payment?.id
              const canDelete =
                !isOwner && canDeleteParticipant(bill.participant.id, allAssignments)

              return (
                <div
                  key={bill.participant.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {bill.participant.name}
                          {isOwner && (
                            <span className="ml-2 text-xs text-gray-500 font-normal">(You)</span>
                          )}
                        </span>
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteParticipant(bill.participant)}
                            disabled={isProcessing}
                            className="text-xs text-red-500 hover:text-red-700 disabled:text-gray-300"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
                        {badge.text}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-gray-900">
                        RM {bill.total.toFixed(2)}
                      </div>
                      {bill.amountPaid > 0 && bill.amountPaid !== bill.total && (
                        <div className="text-xs text-gray-500">
                          Paid: RM {bill.amountPaid.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  {!isOwner && bill.total > 0 && (
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      {bill.isClaimed && bill.payment && (
                        <>
                          <Button
                            variant="primary"
                            onClick={() => handleVerify(bill.payment!.id)}
                            disabled={isProcessing}
                            className="flex-1 text-xs py-2"
                          >
                            ✓ Verify
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => handleUnverify(bill.payment!.id)}
                            disabled={isProcessing}
                            className="flex-1 text-xs py-2"
                          >
                            ✗ Unverify
                          </Button>
                        </>
                      )}

                      {bill.isVerified && bill.amountOwed === 0 && bill.payment && (
                        <Button
                          variant="ghost"
                          onClick={() => handleUnverify(bill.payment!.id)}
                          disabled={isProcessing}
                          className="flex-1 text-xs py-2"
                        >
                          Undo Verify
                        </Button>
                      )}

                      {bill.amountOwed > 0 && !bill.isClaimed && (
                        <>
                          <Button
  variant="secondary"
  onClick={() => handleMarkAsCash(bill)}
  disabled={isProcessing}
  className="flex-1 text-xs py-2"
>
  <span className="flex items-center justify-center gap-1.5">
    <Banknote size={14} />
    Mark Cash
  </span>
</Button>
                          <Button
  variant="ghost"
  onClick={() =>
    handleNudge(bill.participant.name, bill.amountOwed)
  }
  className="flex-1 text-xs py-2"
>
  <span className="flex items-center justify-center gap-1.5">
    <Bell size={14} />
    Nudge
  </span>
</Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {shareItem && (
        <SharePickerModal
          item={shareItem}
          currentParticipantId={participant.id}
          participants={allParticipants}
          onConfirm={handleCreateShare}
          onClose={() => setShareItem(null)}
        />
      )}
    </main>
  )
}