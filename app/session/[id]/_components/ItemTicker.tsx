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
  onClaimPayment: (amount: number, method: "qr" | "cash", paidItemIds: string[]) => Promise<void>
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
  const [addingMore, setAddingMore] = useState(false)
  const [shareItem, setShareItem] = useState<Item | null>(null)

  const paidItemIds = new Set(myPayment?.paid_item_ids || [])
  const hasPaid = paidItemIds.size > 0

  const mySolo = (itemId: string): number => soloQty.get(itemId) || 0

  // Get all share groups for an item
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

  // Calculate my share of an item (solo + confirmed shares)
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

  // Items still NOT paid for, with my contribution > 0
  const unpaidItems = items.filter((item) => {
    const myContribution = calculateMyItemShare(item)
    return myContribution > 0 && !paidItemIds.has(item.id)
  })

  // Items with my pending shares — exclude from payment
  const itemsWithMyPendingShares = new Set(
    items
      .filter((item) =>
        getItemShareGroups(item.id).some(
          (g) => g.isMine && !g.allConfirmed
        )
      )
      .map((i) => i.id)
  )

  const payableItems = unpaidItems.filter(
    (item) => !itemsWithMyPendingShares.has(item.id)
  )

  const mySubtotal = payableItems.reduce(
    (sum, item) => sum + calculateMyItemShare(item),
    0
  )

  const totalSessionSubtotal = items.reduce((sum, item) => {
    const claimed = getTotalClaimed(item.id)
    const effective = Math.min(claimed, item.quantity)
    return sum + Number(item.price) * effective
  }, 0)

  const bill = calculateBill(mySubtotal, totalSessionSubtotal, session)
  const finalTotal = roundToTwoDecimals(bill.total)

  const hasTax = session.tax_type && Number(session.tax_value) > 0
  const hasService = session.service_type && Number(session.service_value) > 0

  const paymentStatus = myPayment?.status
  const isPaymentClaimed = paymentStatus === "claimed"
  const isVerified = paymentStatus === "verified"
  const isUnverified = paymentStatus === "unverified"

  const getPaymentBadge = () => {
    if (!myPayment || !hasPaid) return null
    if (isVerified)
      return {
        text: `✅ Verified by owner — RM ${Number(myPayment.amount_paid).toFixed(2)} paid`,
        color: "bg-green-100 text-green-800",
      }
    if (isPaymentClaimed)
      return {
        text: `⏳ Waiting verification — RM ${Number(myPayment.amount_paid).toFixed(2)} claimed`,
        color: "bg-yellow-100 text-yellow-800",
      }
    if (isUnverified)
      return {
        text: "❌ Payment unverified by owner — please pay again",
        color: "bg-red-100 text-red-800",
      }
    return null
  }

  const badge = getPaymentBadge()
  const itemsLocked = hasPaid && !addingMore && !isUnverified

  const handleClaimPayment = async (method: "qr" | "cash") => {
    const itemIdsToPay = payableItems.map((i) => i.id)
    await onClaimPayment(finalTotal, method, itemIdsToPay)
    setAddingMore(false)
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
            {itemsLocked ? "Items you paid for" : "How many did you have?"}
          </h2>
          <div className="space-y-2">
            {items.map((item) => {
              const mine = mySolo(item.id)
              const isPaidItem = paidItemIds.has(item.id)
              const totalClaimed = getTotalClaimed(item.id)
              const remaining = item.quantity - totalClaimed
              const myShare = calculateMyItemShare(item)
              const lockedByOthers = lockedItemIds.has(item.id) && !isPaidItem

              const isDisabled = isPaidItem || itemsLocked || lockedByOthers
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
                  } ${isDisabled ? "opacity-60" : ""}`}
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

                    {/* Solo quantity controls */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => onDecrement(item.id)}
                        disabled={isDisabled || mine <= 0}
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
                        disabled={isDisabled}
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

                  {/* Shares display */}
                  {shareGroups.length > 0 && (
                    <div className={`mt-3 pt-3 border-t space-y-2 ${isTicked ? "border-white/20" : "border-gray-200"}`}>
                      {shareGroups.map((g) => {
                        const memberNames = g.members.map((m) => m.name).join(", ")
                        const status = g.allConfirmed
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
                                Share: {g.quantity} × split with {memberNames}
                              </span>
                              <span className="font-medium">{status}</span>
                            </div>

                            {/* If I'm tagged but haven't responded */}
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

                            {/* If I initiated this share */}
                            {g.isInitiator && !g.allConfirmed && !isDisabled && (
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

                  {/* Add share button — hidden by default (Option B) */}
                  {!isDisabled && !isPaidItem && (
                    <button
                      onClick={() => setShareItem(item)}
                      className={`mt-2 text-xs font-medium ${isTicked ? "text-blue-300" : "text-blue-600"} hover:underline`}
                    >
                      + Add share
                    </button>
                  )}

                  {isPaidItem && (
                    <div className={`text-xs mt-1 font-medium ${isTicked ? "text-green-300" : "text-green-600"}`}>
                      ✓ Already paid
                    </div>
                  )}

                  {lockedByOthers && (
                    <div className="text-xs mt-1 text-gray-400 font-medium">
                      🔒 Paid by someone else
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {hasPaid && !addingMore && (
            <Button
              variant="ghost"
              onClick={() => setAddingMore(true)}
              className="mt-3 w-full text-sm"
            >
              + Add more items
            </Button>
          )}

          {addingMore && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
              💡 Add more items below. Items you've paid for can't be changed.
              <button
                onClick={() => setAddingMore(false)}
                className="block mt-1 text-xs underline text-blue-600"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Pending shares warning */}
        {itemsWithMyPendingShares.size > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
            ⏳ Some shares are waiting for confirmation. You can pay other items now and pay those after all confirm.
          </div>
        )}

        {/* Bill Breakdown */}
        {mySubtotal > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="text-xs text-gray-500 font-medium">
              {hasPaid ? "New items to pay" : "Your bill"}
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">
                RM {bill.subtotal.toFixed(2)}
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
                <span className="font-medium text-gray-900">RM {bill.tax.toFixed(2)}</span>
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
                <span className="font-medium text-gray-900">RM {bill.service.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="text-2xl font-bold text-gray-900">
                RM {finalTotal.toFixed(2)}
              </span>
            </div>

            <p className="text-xs text-gray-500">Confirmed shares included</p>
          </div>
        )}

        {hasPaid && mySubtotal === 0 && !addingMore && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="text-green-800 font-medium">🎉 You're all settled!</div>
            <div className="text-green-600 text-sm mt-1">
              Total paid: RM {Number(myPayment?.amount_paid || 0).toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {finalTotal > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="max-w-md mx-auto">
            <Button
              variant="primary"
              onClick={() => setShowPayment(true)}
              className="w-full py-4 text-base"
            >
              {hasPaid ? "Pay More" : isUnverified ? "Pay Again" : "Pay"} — RM{" "}
              {finalTotal.toFixed(2)}
            </Button>
          </div>
        </div>
      )}

      {showPayment && (
        <PaymentModal
          session={session}
          amount={finalTotal}
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