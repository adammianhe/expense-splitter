"use client"

import { useState } from "react"
import { Item, Participant, Session } from "@/types"
import { formatChargeLabel } from "@/lib/utils"
import { ParticipantBill } from "@/hooks/useSessionBills"
import Button from "@/components/ui/Button"
import PaymentModal from "./PaymentModal"
import SharePickerModal from "./SharePickerModal"
import ReceiptManager from "./ReceiptManager"
import { Lock, Clock } from "lucide-react"

type Props = {
  receipts: import("@/types").Receipt[]
  paymentMethods: import("@/types").PaymentMethod[]
  charges: import("@/types").SessionCharge[]
  session: Session
  participant: Participant
  participants: Participant[]
  items: Item[]
  soloQty: Map<string, number>
  allAssignments: any[]
  bill: ParticipantBill | null
  lockedItemIds: Set<string>
  onIncrement: (itemId: string) => void
  onDecrement: (itemId: string) => void
  onCreateShare: (itemId: string, quantity: number, taggedIds: string[]) => Promise<void>
  onConfirmShare: (shareGroupId: string) => Promise<void>
  onRejectShare: (shareGroupId: string) => Promise<void>
  onRemoveShare: (shareGroupId: string) => Promise<void>
  onCancelPayment: (paymentId: string) => Promise<void>
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
  bill,
  lockedItemIds,
  onIncrement,
  onDecrement,
  onCreateShare,
  onConfirmShare,
  onRejectShare,
  onRemoveShare,
  onCancelPayment,
  onSwitchName,
  onClaimPayment,
  receipts,
  paymentMethods,
  charges,
}: Props) {
  const [showPayment, setShowPayment] = useState(false)
  const [shareItem, setShareItem] = useState<Item | null>(null)

  // Paid quantities/shares are aggregated across ALL of this participant's
  // payment rounds (verified + claimed only — unverified/cancelled rounds
  // don't count) by useSessionBills. This IS the lock: the [-] button below
  // is disabled once `mine <= paid`, so an item stays locked for as long as
  // a verified or still-pending (claimed) round covers it. Unverifying a
  // round drops it out of this aggregate, releasing the lock immediately.
  const paidItemQuantities = bill?.paidItemQuantities || {}
  const paidShareGroupIds = bill?.paidShareGroupIds || new Set<string>()
  const unverifiedPayments = bill?.unverifiedPayments || []

  const mySolo = (itemId: string): number => soloQty.get(itemId) || 0
  const myPaidQty = (itemId: string): number => paidItemQuantities[itemId] || 0

  // Once unlocked (round unverified), reducing/removing a claim that round
  // covered means the participant is walking away from that debt — cancel
  // the unverified round so it stops being "history user needs to resolve".
  const cancelUnverifiedForItem = (itemId: string) => {
    console.log("[CANCEL CHECK] Unverified payments:", unverifiedPayments.length)
    const affected = unverifiedPayments.filter(
      (pay) => (pay.paid_item_quantities || {})[itemId] !== undefined
    )
    unverifiedPayments.forEach((pay) => {
      console.log(
        "[CANCEL CHECK] Payment",
        pay.id,
        "has item",
        itemId,
        ":",
        (pay.paid_item_quantities || {})[itemId] !== undefined
      )
    })
    affected.forEach((pay) => {
      onCancelPayment(pay.id).catch((err) => {
        console.error("[CANCEL] Failed:", err)
      })
    })
  }

  const cancelUnverifiedForShareGroup = (groupId: string) => {
    unverifiedPayments
      .filter((pay) => (pay.paid_share_group_ids || []).includes(groupId))
      .forEach((pay) => {
        onCancelPayment(pay.id).catch((err) => {
          console.error("[CANCEL] Failed:", err)
        })
      })
  }

  const handleDecrement = (itemId: string) => {
    cancelUnverifiedForItem(itemId)
    onDecrement(itemId)
  }

  const handleRemoveShareGroup = (groupId: string) => {
    if (!confirm("Remove this share?")) return
    cancelUnverifiedForShareGroup(groupId)
    onRemoveShare(groupId)
  }

  // Is this item's locked quantity coming from a still-pending (claimed,
  // not yet verified) round? Drives the "locked while verifying" label.
  const isItemPendingVerification = (itemId: string): boolean =>
    (bill?.claimedPayments || []).some(
      (pay) => (pay.paid_item_quantities || {})[itemId] !== undefined
    )

  // ============================================
  // SHARE GROUP HELPERS (claim state — unrelated to payment status)
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

  // Total claimed (solo confirmed + reserved shares) for an item
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
      const anyActive = members.some((m) => m.status !== "rejected")
      if (anyActive) shareTotal += Number(members[0].quantity)
    }

    return solo + shareTotal
  }

  // My CURRENT claim value for an item (for display, not payment)
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

  // Items with my pending (unconfirmed) shares - those can't be paid yet
  const itemsWithMyPendingShares = new Set(
    items
      .filter((item) =>
        getItemShareGroups(item.id).some((g) => g.isMine && !g.allConfirmed)
      )
      .map((i) => i.id)
  )

  // ============================================
  // PAYMENT STATUS (aggregated across all payment rounds — see useSessionBills)
  // ============================================

  const verifiedAmount = bill?.verifiedAmount || 0
  const pendingAmount = bill?.pendingAmount || 0
  const unverifiedAmount = bill?.unverifiedAmount || 0
  const overpaidAmount = bill?.overpaidAmount || 0
  const unpaidTotal = bill?.unpaidTotal || 0
  const unpaidSubtotal = bill?.unpaidSubtotal || 0
  const unpaidChargeLines = bill?.unpaidChargeLines || []

  // bill.isUnverified is true only when the MOST RECENT payment round is
  // unverified AND there's still an outstanding balance — see
  // useSessionBills. Older unverified history that's since been paid back,
  // or new debt from items ticked after settling, doesn't count.
  const isUnverified = bill?.isUnverified || false
  const hasPaid = verifiedAmount > 0 || pendingAmount > 0

  const getPaymentBadge = () => {
    if (!bill) return null
    if (isUnverified)
      return {
        text: `❌ Payment of RM ${unpaidTotal.toFixed(2)} unverified, please pay again`,
        color: "bg-red-100 text-red-800",
      }
    if (pendingAmount > 0)
      return {
        text: `⏳ Waiting verification - RM ${pendingAmount.toFixed(2)}`,
        color: "bg-yellow-100 text-yellow-800",
      }
    if (verifiedAmount > 0)
      return {
        text: `✅ Verified - RM ${verifiedAmount.toFixed(2)} paid`,
        color: "bg-green-100 text-green-800",
      }
    return null
  }

  const badge = getPaymentBadge()

  // ============================================
  // PAYMENT HANDLER
  // ============================================

  const handleClaimPayment = async (method: "qr" | "cash") => {
    if (!bill) return
    await onClaimPayment(
      bill.unpaidTotal,
      method,
      bill.unpaidItemIds,
      bill.unpaidItemQuantities,
      bill.unpaidShareGroupIds
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
        <ReceiptManager
  receipts={receipts}
  canManage={false}
  onUpload={async () => {}}
  onDelete={async () => {}}
/>

        {/* Items */}
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-2">
            What did you have?
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
                        onClick={() => handleDecrement(item.id)}
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

                  {/* Paid / locked badge (for solo) */}
                  {paid > 0 && (
                    <div className={`text-xs mt-1 font-medium flex items-center gap-1 ${isTicked ? "text-green-300" : "text-green-600"}`}>
                      {isItemPendingVerification(item.id) ? (
                        <>
                          <Lock size={11} />
                          Locked while verifying ({paid} of {mine})
                        </>
                      ) : (
                        <>✓ Paid for {paid} of {mine}</>
                      )}
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
                                onClick={() => handleRemoveShareGroup(g.groupId)}
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

                  {/* Add share button - only if I can still interact */}
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
        </div>

        {/* Pending shares warning */}
        {itemsWithMyPendingShares.size > 0 && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800 flex items-start gap-2">
    <Clock size={16} className="flex-shrink-0 mt-0.5" />
    <span>Some shares are waiting for confirmation. Payment for those will be available once all confirm.</span>
  </div>
)}

        {/* New unpaid bill */}
        {unpaidSubtotal > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="text-xs text-gray-500 font-medium">
              {hasPaid ? "New items to pay" : "Your bill"}
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">
                RM {unpaidSubtotal.toFixed(2)}
              </span>
            </div>

            {unpaidChargeLines.map((line, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600">{formatChargeLabel(line)}</span>
                <span className="font-medium text-gray-900">
                  RM {line.amount.toFixed(2)}
                </span>
              </div>
            ))}

            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
              <span className="font-semibold text-gray-900">Total to pay</span>
              <span className="text-2xl font-bold text-gray-900">
                RM {unpaidTotal.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* All settled */}
        {hasPaid && !isUnverified && unpaidTotal === 0 && (
  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
    <div className="text-green-800 font-medium">You're all settled</div>
    <div className="text-green-600 text-sm mt-1">
      Total paid: RM {verifiedAmount.toFixed(2)}
    </div>
    {overpaidAmount > 0 && (
      <div className="text-green-600 text-xs mt-1">
        Overpaid by RM {overpaidAmount.toFixed(2)}
      </div>
    )}
  </div>
)}
      </div>

      {unpaidTotal > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="max-w-md mx-auto">
            <Button
              variant="primary"
              onClick={() => setShowPayment(true)}
              className="w-full py-4 text-base"
            >
              {isUnverified ? "Pay Again" : hasPaid ? "Pay More" : "Pay"} - RM{" "}
              {unpaidTotal.toFixed(2)}
            </Button>
          </div>
        </div>
      )}

      {showPayment && (
        <PaymentModal
          session={session}
          amount={unpaidTotal}
          subtotal={unpaidSubtotal}
          chargeLines={unpaidChargeLines}
          paymentMethods={paymentMethods}
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
