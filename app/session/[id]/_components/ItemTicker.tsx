"use client"

import { useState } from "react"
import { Item, Participant, Session, Payment } from "@/types"
import { calculateBill, roundToTwoDecimals } from "@/lib/utils"
import Button from "@/components/ui/Button"
import PaymentModal from "./PaymentModal"
import SharePickerModal from "./SharePickerModal"

type Props = {
  session: Session
  participant: Participant
  participants: Participant[]
  items: Item[]
  soloQty: Map<string, number>
  allAssignments: any[]
  myPayment: Payment | null
  lockedItemIds: Set<string>
  onIncrement: (itemId: string) => void
  onDecrement: (itemId: string) => void
  onCreateShare: (itemId: string, quantity: number, taggedIds: string[]) => Promise<void>
  onConfirmShare: (shareGroupId: string) => Promise<void>
  onRejectShare: (shareGroupId: string) => Promise<void>
  onRemoveShare: (shareGroupId: string) => Promise<void>
  onSwitchName: () => void
  onClaimPayment: (
    amount: number,
    method: "qr" | "cash",
    paidItemIds: string[],
    paidItemQuantities: Record<string, number>,
    paidShareGroupIds: string[]
  ) => Promise<void>
}

export default function ItemTicker({
  session,
  participant,
  participants,
  items,
  soloQty,
  allAssignments,
  myPayment,
  lockedItemIds,
  onIncrement,
  onDecrement,
  onCreateShare,
  onConfirmShare,
  onRejectShare,
  onRemoveShare,
  onSwitchName,
  onClaimPayment,
}: Props) {
  const [showPayment, setShowPayment] = useState(false)
  const [shareItem, setShareItem] = useState<Item | null>(null)

  // Paid quantities per item (e.g. paid for 2 ayam)
  const paidItemQuantities: Record<string, number> =
    (myPayment as any)?.paid_item_quantities || {}
  // Paid share group IDs
  const paidShareGroupIds = new Set<string>(
    (myPayment as any)?.paid_share_group_ids || []
  )

  const mySolo = (itemId: string): number => soloQty.get(itemId) || 0
  const myPaidQty = (itemId: string): number => paidItemQuantities[itemId] || 0

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
      const item = items.find((i) => i.id === itemId)
      const quantity = Number(members[0]?.quantity || 0)
      const initiatorId = members[0]?.assigned_by_participant_id
      const allConfirmed = members.every((m) => m.status === "confirmed")
      const myMembership = members.find((m) => m.participant_id === participant.id)

      return {
        groupId: groupId as string,
        quantity,
        initiatorId,
        members: members.map((m) => {
          const p = participants.find((pp) => pp.id === m.participant_id)
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
        item,
        isPaid: paidShareGroupIds.has(groupId as string),
      }
    })
  }

  // Total confirmed claims (solo + share) for an item
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

  // ============================================
  // PAYMENT CALCULATION (the new model!)
  // ============================================

  // My CURRENT total bill (everything I owe right now)
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

  // The UNPAID portion of an item (mine - paid)
  // For solo claims only — shares are atomic (either paid or not)
  const calculateUnpaidSoloShare = (item: Item): number => {
    const totalSolo = mySolo(item.id)
    const paidSolo = myPaidQty(item.id)
    const unpaidSolo = Math.max(0, totalSolo - paidSolo)
    return unpaidSolo * Number(item.price)
  }

  // Unpaid share contributions
  const calculateUnpaidShareTotal = (): {
    total: number
    paidGroupIds: string[]
  } => {
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
  }

  // Items with my pending shares — those can't be paid
  const itemsWithMyPendingShares = new Set(
    items
      .filter((item) =>
        getItemShareGroups(item.id).some(
          (g) => g.isMine && !g.allConfirmed
        )
      )
      .map((i) => i.id)
  )

  // PAYABLE: unpaid solo qty + unpaid confirmed shares
  // Build the payment delta
  const unpaidSoloItems: { item: Item; deltaQty: number; deltaAmount: number }[] = []
  items.forEach((item) => {
    if (itemsWithMyPendingShares.has(item.id)) return // skip if pending
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

  const unpaidShareInfo = calculateUnpaidShareTotal()

  // Subtotal of NEW unpaid stuff
  const newUnpaidSubtotal =
    unpaidSoloItems.reduce((sum, x) => sum + x.deltaAmount, 0) +
    unpaidShareInfo.total

  const totalSessionSubtotal = items.reduce((sum, item) => {
    const claimed = getTotalClaimed(item.id)
    const effective = Math.min(claimed, item.quantity)
    return sum + Number(item.price) * effective
  }, 0)

  // Bill for the NEW unpaid portion (with proportional tax)
  const newBill = calculateBill(newUnpaidSubtotal, totalSessionSubtotal, session)
  const newTotalToPay = roundToTwoDecimals(newBill.total)

  const hasTax = session.tax_type && Number(session.tax_value) > 0
  const hasService = session.service_type && Number(session.service_value) > 0

  // Payment status display
  const paymentStatus = myPayment?.status
  const isPaymentClaimed = paymentStatus === "claimed"
  const isVerified = paymentStatus === "verified"
  const isUnverified = paymentStatus === "unverified"
  const hasPaid = (myPayment?.amount_paid || 0) > 0

  const getPaymentBadge = () => {
    if (!myPayment || !hasPaid) return null
    if (isVerified)
      return {
        text: `✅ Verified — RM ${Number(myPayment.amount_paid).toFixed(2)} paid`,
        color: "bg-green-100 text-green-800",
      }
    if (isPaymentClaimed)
      return {
        text: `⏳ Waiting verification — RM ${Number(myPayment.amount_paid).toFixed(2)}`,
        color: "bg-yellow-100 text-yellow-800",
      }
    if (isUnverified)
      return {
        text: "❌ Payment unverified — please pay again",
        color: "bg-red-100 text-red-800",
      }
    return null
  }

  const badge = getPaymentBadge()

  // ============================================
  // PAYMENT HANDLER
  // ============================================

  const handleClaimPayment = async (method: "qr" | "cash") => {
    // Build the new quantities map: paid + new deltas
    const newQuantities: Record<string, number> = { ...paidItemQuantities }
    const newItemIds: string[] = [...((myPayment as any)?.paid_item_ids || [])]

    unpaidSoloItems.forEach(({ item, deltaQty }) => {
      newQuantities[item.id] = (newQuantities[item.id] || 0) + deltaQty
      if (!newItemIds.includes(item.id)) newItemIds.push(item.id)
    })

    // For shares, also add the items to paid_item_ids
    unpaidShareInfo.paidGroupIds.forEach((groupId) => {
      const member = allAssignments.find(
        (a) =>
          a.share_group_id === groupId && a.participant_id === participant.id
      )
      if (member && !newItemIds.includes(member.item_id)) {
        newItemIds.push(member.item_id)
      }
    })

    await onClaimPayment(
      newTotalToPay,
      method,
      newItemIds,
      newQuantities,
      unpaidShareInfo.paidGroupIds
    )
  }

  const handleCreateShare = async (quantity: number, taggedIds: string[]) => {
    if (!shareItem) return
    await onCreateShare(shareItem.id, quantity, taggedIds)
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 pb-32">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Logged in as</p>
            <h1 className="text-2xl font-bold text-gray-900">{participant.name}</h1>
          </div>
          <Button variant="ghost" onClick={onSwitchName} className="text-sm">
            Switch
          </Button>
        </div>

        {badge && (
          <div className={`rounded-xl p-3 text-sm font-medium ${badge.color}`}>
            {badge.text}
          </div>
        )}

        {/* Items */}
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-2">
            How many did you have?
          </h2>
          <div className="space-y-2">
            {items.map((item) => {
              const mine = mySolo(item.id)
              const paid = myPaidQty(item.id)
              const totalClaimed = getTotalClaimed(item.id)
              const remaining = item.quantity - totalClaimed
              const myShare = calculateMyItemShare(item)
              const lockedByOthers =
                lockedItemIds.has(item.id) && mine === 0
              const isFullyClaimed = totalClaimed >= item.quantity

              // Button logic
              const canDecrement = mine > paid && !lockedByOthers
              const canIncrement = !lockedByOthers && !isFullyClaimed
              const isTicked = mine > 0 || myShare > 0

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
                  const p = participants.find((pp) => pp.id === a.participant_id)
                  return p?.name
                })
                .filter(Boolean) as string[]

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition ${
                    isTicked
                      ? "bg-black text-white border-black"
                      : "bg-white border-gray-200"
                  }`}
                >
                  {/* Item header */}
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

                    {/* Quantity controls */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => onDecrement(item.id)}
                        disabled={!canDecrement}
                        className={`w-8 h-8 rounded-full font-bold text-lg flex items-center justify-center transition ${
                          isTicked
                            ? "bg-white/20 text-white disabled:opacity-30"
                            : "bg-gray-100 text-gray-700 disabled:opacity-30"
                        }`}
                      >
                        −
                      </button>
                      <span className="font-bold text-lg w-6 text-center">
                        {mine}
                      </span>
                      <button
                        onClick={() => onIncrement(item.id)}
                        disabled={!canIncrement}
                        className={`w-8 h-8 rounded-full font-bold text-lg flex items-center justify-center transition ${
                          isTicked
                            ? "bg-white/20 text-white disabled:opacity-30"
                            : "bg-gray-100 text-gray-700 disabled:opacity-30"
                        }`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Info row */}
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

                  {/* Paid badge (for solo) */}
                  {paid > 0 && (
                    <div className={`text-xs mt-1 font-medium ${isTicked ? "text-green-300" : "text-green-600"}`}>
                      ✓ Paid for {paid} of {mine}
                    </div>
                  )}

                  {/* Shares display */}
                  {shareGroups.length > 0 && (
                    <div className={`mt-3 pt-3 border-t space-y-2 ${isTicked ? "border-white/20" : "border-gray-200"}`}>
                      {shareGroups.map((g) => {
                        const memberNames = g.members.map((m) => m.name).join(", ")
                        const status = g.isPaid
                          ? "✓ Paid"
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

                            {/* If I'm tagged and pending */}
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

                            {/* If I initiated this share and not yet paid */}
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

                  {/* Add share button — only if I can still interact */}
                  {!lockedByOthers && (
                    <button
                      onClick={() => setShareItem(item)}
                      className={`mt-2 text-xs font-medium ${isTicked ? "text-blue-300" : "text-blue-600"} hover:underline`}
                    >
                      + Add share
                    </button>
                  )}

                  {lockedByOthers && (
                    <div className="text-xs mt-1 text-gray-400 font-medium">
                      🔒 Fully claimed by others
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Pending shares warning */}
        {itemsWithMyPendingShares.size > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
            ⏳ Some shares are waiting for confirmation. Payment for those will be available once all confirm.
          </div>
        )}

        {/* New unpaid bill */}
        {newUnpaidSubtotal > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="text-xs text-gray-500 font-medium">
              {hasPaid ? "New items to pay" : "Your bill"}
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">
                RM {newBill.subtotal.toFixed(2)}
              </span>
            </div>

            {hasTax && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Tax{" "}
                  {session.tax_type === "percentage" && (
                    <span className="text-xs text-gray-400">({session.tax_value}%)</span>
                  )}
                </span>
                <span className="font-medium text-gray-900">RM {newBill.tax.toFixed(2)}</span>
              </div>
            )}

            {hasService && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Service{" "}
                  {session.service_type === "percentage" && (
                    <span className="text-xs text-gray-400">({session.service_value}%)</span>
                  )}
                </span>
                <span className="font-medium text-gray-900">RM {newBill.service.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
              <span className="font-semibold text-gray-900">Total to pay</span>
              <span className="text-2xl font-bold text-gray-900">
                RM {newTotalToPay.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* All settled */}
        {hasPaid && newUnpaidSubtotal === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="text-green-800 font-medium">🎉 You're all settled!</div>
            <div className="text-green-600 text-sm mt-1">
              Total paid: RM {Number(myPayment?.amount_paid || 0).toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {newTotalToPay > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="max-w-md mx-auto">
            <Button
              variant="primary"
              onClick={() => setShowPayment(true)}
              className="w-full py-4 text-base"
            >
              {hasPaid ? "Pay More" : isUnverified ? "Pay Again" : "Pay"} — RM{" "}
              {newTotalToPay.toFixed(2)}
            </Button>
          </div>
        </div>
      )}

      {showPayment && (
        <PaymentModal
          session={session}
          amount={newTotalToPay}
          onConfirm={handleClaimPayment}
          onClose={() => setShowPayment(false)}
        />
      )}

      {shareItem && (
        <SharePickerModal
          item={shareItem}
          currentParticipantId={participant.id}
          participants={participants}
          onConfirm={handleCreateShare}
          onClose={() => setShareItem(null)}
        />
      )}
    </main>
  )
}