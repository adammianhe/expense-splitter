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
  ticked: Set<string>
  allAssignments: any[]
  myPayment: Payment | null
  lockedItemIds: Set<string>
  onToggle: (itemId: string) => void
  onSwitchName: () => void
  onClaimPayment: (amount: number, method: "qr" | "cash", paidItemIds: string[]) => Promise<void>
}

export default function ItemTicker({
  session,
  participant,
  participants,
  items,
  ticked,
  allAssignments,
  myPayment,
  lockedItemIds,
  onToggle,
  onSwitchName,
  onClaimPayment,
}: Props) {
  const [showPayment, setShowPayment] = useState(false)
  const [addingMore, setAddingMore] = useState(false)

  // Already-paid items
  const paidItemIds = new Set(myPayment?.paid_item_ids || [])
  const hasPaid = paidItemIds.size > 0

  // Items still NOT paid for (these are billable)
  const unpaidTickedItems = items.filter(
    (item) => ticked.has(item.id) && !paidItemIds.has(item.id)
  )

  const getItemSharers = (itemId: string): Participant[] => {
    const sharerIds = allAssignments
      .filter((a) => a.item_id === itemId && a.status !== "rejected")
      .map((a) => a.participant_id)
    return participants.filter((p) => sharerIds.includes(p.id))
  }

  const calculateMyShare = (item: Item): number => {
    const sharers = getItemSharers(item.id)
    if (sharers.length === 0) return 0
    return Number(item.price) / sharers.length
  }

  // Subtotal for UNPAID items only (this is what they'll pay next)
  const mySubtotal = unpaidTickedItems.reduce(
    (sum, item) => sum + calculateMyShare(item),
    0
  )

  // Total session subtotal across all ticked items by anyone
  const totalSessionSubtotal = items.reduce((sum, item) => {
    const sharers = getItemSharers(item.id)
    if (sharers.length === 0) return sum
    return sum + Number(item.price)
  }, 0)

  // Calculate bill for unpaid portion
  const bill = calculateBill(mySubtotal, totalSessionSubtotal, session)
  const finalTotal = roundToTwoDecimals(bill.total)

  const hasTax = session.tax_type && Number(session.tax_value) > 0
  const hasService = session.service_type && Number(session.service_value) > 0

  // Payment status helpers
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

  // Whether items should be locked
  // Locked when: paid items exist AND user hasn't clicked "add more"
  const itemsLocked = hasPaid && !addingMore && !isUnverified

  const handleClaimPayment = async (method: "qr" | "cash") => {
    const itemIdsToPay = unpaidTickedItems.map((i) => i.id)
    await onClaimPayment(finalTotal, method, itemIdsToPay)
    setAddingMore(false) // reset adding more after payment
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

        {/* Payment Status Badge */}
        {badge && (
          <div className={`rounded-xl p-3 text-sm font-medium ${badge.color}`}>
            {badge.text}
          </div>
        )}

        {/* Items */}
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-2">
            {itemsLocked ? "Items you paid for" : "Tick what you ate"}
          </h2>
          <div className="space-y-2">
            {items.map((item) => {
  const isTicked = ticked.has(item.id)
  const isPaidItem = paidItemIds.has(item.id)
  const sharers = getItemSharers(item.id)
  const isShared = sharers.length > 1
  const myShare = isTicked ? calculateMyShare(item) : 0

  // Locked by someone else's payment (not yours)
  const lockedByOthers = lockedItemIds.has(item.id) && !isPaidItem

  // Decide if this specific item is disabled
  const isDisabled = isPaidItem || itemsLocked || lockedByOthers

              return (
                <button
                  key={item.id}
                  onClick={() => !isDisabled && onToggle(item.id)}
                  disabled={isDisabled}
                  className={`w-full p-4 rounded-xl border text-left transition relative ${
                    isTicked
                      ? "bg-black text-white border-black"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  } ${isDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.name}</span>
                    <span className="font-semibold">
                      RM {Number(item.price).toFixed(2)}
                    </span>
                  </div>

                  {sharers.length > 0 && (
                    <div
                      className={`text-xs mt-1 ${
                        isTicked ? "text-gray-300" : "text-gray-500"
                      }`}
                    >
                      {isShared ? (
                        <>
                          Shared by {sharers.map((s) => s.name).join(", ")}
                          {isTicked && ` — your share: RM ${myShare.toFixed(2)}`}
                        </>
                      ) : sharers[0]?.id === participant.id ? (
                        "Just you"
                      ) : (
                        `Only ${sharers[0]?.name}`
                      )}
                    </div>
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
                </button>
              )
            })}
          </div>

          {/* Add More Items Button (only shows if user has paid but wants more) */}
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
              💡 Tick more items below. Items you've paid for can't be changed.
              <button
                onClick={() => setAddingMore(false)}
                className="block mt-1 text-xs underline text-blue-600"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Bill Breakdown — only shows if there's unpaid amount */}
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
                    <span className="text-xs text-gray-400">
                      ({session.tax_value}%)
                    </span>
                  )}
                </span>
                <span className="font-medium text-gray-900">
                  RM {bill.tax.toFixed(2)}
                </span>
              </div>
            )}

            {hasService && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Service{" "}
                  {session.service_type === "percentage" && (
                    <span className="text-xs text-gray-400">
                      ({session.service_value}%)
                    </span>
                  )}
                </span>
                <span className="font-medium text-gray-900">
                  RM {bill.service.toFixed(2)}
                </span>
              </div>
            )}

            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="text-2xl font-bold text-gray-900">
                RM {finalTotal.toFixed(2)}
              </span>
            </div>

            <p className="text-xs text-gray-500">
  Shared items auto-split
</p>
          </div>
        )}

        {/* All settled message */}
        {hasPaid && mySubtotal === 0 && !addingMore && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="text-green-800 font-medium">🎉 You're all settled!</div>
            <div className="text-green-600 text-sm mt-1">
              Total paid: RM {Number(myPayment?.amount_paid || 0).toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Pay Button */}
      {finalTotal > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="max-w-md mx-auto">
            <Button
              variant="primary"
              onClick={() => setShowPayment(true)}
              className="w-full py-4 text-base"
            >
              {hasPaid ? "Pay Additional" : isUnverified ? "Pay Again" : "Pay"} — RM{" "}
              {finalTotal.toFixed(2)}
            </Button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
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