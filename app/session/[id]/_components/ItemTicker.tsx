"use client"

import { useState } from "react"
import { Item, Participant, Session, Payment } from "@/types"
import { calculateBill, roundToTwoDecimals } from "@/lib/utils"
import Button from "@/components/ui/Button"
import PaymentModal from "./PaymentModal"

type Props = {
  session: Session
  participant: Participant
  participants: Participant[]
  items: Item[]
  tickedQty: Map<string, number>
  allAssignments: any[]
  myPayment: Payment | null
  lockedItemIds: Set<string>
  onIncrement: (itemId: string) => void
  onDecrement: (itemId: string) => void
  onSwitchName: () => void
  onClaimPayment: (amount: number, method: "qr" | "cash", paidItemIds: string[]) => Promise<void>
}

export default function ItemTicker({
  session,
  participant,
  participants,
  items,
  tickedQty,
  allAssignments,
  myPayment,
  lockedItemIds,
  onIncrement,
  onDecrement,
  onSwitchName,
  onClaimPayment,
}: Props) {
  const [showPayment, setShowPayment] = useState(false)
  const [addingMore, setAddingMore] = useState(false)

  const paidItemIds = new Set(myPayment?.paid_item_ids || [])
  const hasPaid = paidItemIds.size > 0

  const myQty = (itemId: string): number => tickedQty.get(itemId) || 0

  // How many of an item have been claimed in total
  const getTotalClaimed = (itemId: string): number => {
    return allAssignments
      .filter((a) => a.item_id === itemId && a.status !== "rejected")
      .reduce((sum, a) => sum + (Number(a.quantity) || 1), 0)
  }

  // How many of this item this participant claimed
  const getParticipantQty = (itemId: string, pid: string): number => {
    const a = allAssignments.find(
      (a) =>
        a.item_id === itemId &&
        a.participant_id === pid &&
        a.status !== "rejected"
    )
    return a ? Number(a.quantity) || 1 : 0
  }

  // Other participants who claimed this item (excluding self)
  const getOtherSharers = (itemId: string): Participant[] => {
    const ids = allAssignments
      .filter(
        (a) =>
          a.item_id === itemId &&
          a.status !== "rejected" &&
          a.participant_id !== participant.id
      )
      .map((a) => a.participant_id)
    return participants.filter((p) => ids.includes(p.id))
  }

  // Calculate this person's share for one item (not including tax)
  const calculateMyItemShare = (item: Item): number => {
    const mine = myQty(item.id)
    if (mine === 0) return 0
    const totalClaimed = getTotalClaimed(item.id)
    const effective = Math.min(totalClaimed, item.quantity)
    return totalClaimed > 0
      ? (mine / totalClaimed) * (Number(item.price) * effective)
      : 0
  }

  // Items still NOT paid for
  const unpaidItems = items.filter(
    (item) => myQty(item.id) > 0 && !paidItemIds.has(item.id)
  )

  const mySubtotal = unpaidItems.reduce(
    (sum, item) => sum + calculateMyItemShare(item),
    0
  )

  // Total session subtotal
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
    const itemIdsToPay = unpaidItems.map((i) => i.id)
    await onClaimPayment(finalTotal, method, itemIdsToPay)
    setAddingMore(false)
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
              const mine = myQty(item.id)
              const isPaidItem = paidItemIds.has(item.id)
              const totalClaimed = getTotalClaimed(item.id)
              const remaining = Math.max(0, item.quantity - totalClaimed)
              const myShare = calculateMyItemShare(item)
              const otherSharers = getOtherSharers(item.id)
              const lockedByOthers = lockedItemIds.has(item.id) && !isPaidItem

              const isDisabled = isPaidItem || itemsLocked || lockedByOthers
              const canIncrement = !isDisabled && (mine + 1) + (totalClaimed - mine) <= item.quantity
              const canDecrement = !isDisabled && mine > 0

              const isTicked = mine > 0

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition ${
                    isTicked
                      ? "bg-black text-white border-black"
                      : "bg-white border-gray-200"
                  } ${isDisabled ? "opacity-60" : ""}`}
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

                  {/* Status info */}
                  <div className={`text-xs mt-2 ${isTicked ? "text-gray-300" : "text-gray-500"}`}>
                    {mine > 0 && (
                      <span>Your share: RM {myShare.toFixed(2)}</span>
                    )}
                    {otherSharers.length > 0 && (
                      <span>
                        {mine > 0 ? " • " : ""}
                        Shared with {otherSharers.map((s) => s.name).join(", ")}
                      </span>
                    )}
                    {item.quantity > 1 && remaining > 0 && (
                      <span className={mine > 0 || otherSharers.length > 0 ? " • " : ""}>
                        {remaining} left
                      </span>
                    )}
                  </div>

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

            <p className="text-xs text-gray-500">Shared items auto-split</p>
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
    </main>
  )
}