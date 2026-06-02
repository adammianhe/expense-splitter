"use client"

import { useState } from "react"
import { Session, Participant, Item } from "@/types"
import { ParticipantBill } from "@/hooks/useSessionBills"
import { calculateBill, roundToTwoDecimals, formatRelativeDate } from "@/lib/utils"
import Button from "@/components/ui/Button"
import ItemsEditor from "./ItemsEditor"

type Props = {
  session: Session
  participant: Participant
  bills: ParticipantBill[]
  items: Item[]
  ticked: Set<string>
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
  onAddItem: (name: string, price: number) => Promise<void>
  onUpdateItem: (itemId: string, name: string, price: number) => Promise<void>
  onDeleteItem: (itemId: string) => Promise<void>
  onAddParticipant: (name: string) => Promise<void>
  onDeleteParticipant: (participantId: string) => Promise<void>
  // Existing functions
  onToggleItem: (itemId: string) => void
  onSwitchName: () => void
  onVerify: (paymentId: string) => Promise<void>
  onUnverify: (paymentId: string) => Promise<void>
  onMarkAsCash: (participantId: string, amount: number, paidItemIds: string[]) => Promise<void>
  onOwnerConfirm: (participantId: string, amount: number, paidItemIds: string[]) => Promise<void>
}

export default function OwnerDashboard({
  session,
  participant,
  bills,
  items,
  ticked,
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
  onToggleItem,
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
  const [editSnapshot, setEditSnapshot] = useState<Set<string> | null>(null)
  const [editMode, setEditMode] = useState(false)

  // Owner's bill calculation
  const myBill = bills.find((b) => b.participant.id === participant.id)
  const myPayment = myBill?.payment
  const confirmedItemIds = new Set(myPayment?.paid_item_ids || [])
  const previewItemIds = Array.from(ticked).filter(
    (id) => !confirmedItemIds.has(id)
  )
  const removedConfirmedIds = Array.from(confirmedItemIds).filter(
    (id) => !ticked.has(id)
  )
  const hasUnconfirmedChanges =
    previewItemIds.length > 0 || removedConfirmedIds.length > 0

  const getItemSharers = (itemId: string): string[] => {
    return allAssignments
      .filter((a) => a.item_id === itemId && a.status !== "rejected")
      .map((a) => a.participant_id)
  }

  const getItemSharerNames = (itemId: string): string[] => {
  const sharerIds = getItemSharers(itemId)
  return bills
    .filter((b) => sharerIds.includes(b.participant.id))
    .map((b) => b.participant.name)
}

  const getMyShare = (item: Item): number => {
    const sharers = getItemSharers(item.id)
    if (!sharers.includes(participant.id)) return 0
    return Number(item.price) / sharers.length
  }

const totalSessionSubtotal = items.reduce((sum, item) => {
    const sharers = getItemSharers(item.id)
    if (sharers.length === 0) return sum
    return sum + Number(item.price)
  }, 0)

  // Map each item ID to names of people who paid for it
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

  const previewSubtotal = items
    .filter((item) => ticked.has(item.id))
    .reduce((sum, item) => sum + getMyShare(item), 0)

  const previewBillCalc = calculateBill(
    previewSubtotal,
    totalSessionSubtotal,
    session
  )
  
  const previewTotal = roundToTwoDecimals(previewBillCalc.total)

  const hasTax = session.tax_type && Number(session.tax_value) > 0
  const hasService = session.service_type && Number(session.service_value) > 0

  // Owner confirm handler
  const handleConfirm = async () => {
  // Special case: if confirming results in empty items
  if (ticked.size === 0 && myPayment) {
    const confirmed = confirm(
      "Untick everything? Your confirmation will be removed."
    )
    if (!confirmed) return
  }

  setConfirming(true)
  try {
    const tickedIds = Array.from(ticked)
    await onOwnerConfirm(participant.id, previewTotal, tickedIds)
    setEditMode(false)
    setEditSnapshot(null)
  } catch (err: any) {
    alert("Error: " + err.message)
  } finally {
    setConfirming(false)
  }
}

const handleEnterEditMode = () => {
  // Save snapshot of current ticked state
  setEditSnapshot(new Set(ticked))
  setEditMode(true)
}

const handleCancelEdit = () => {
  if (!editSnapshot) {
    setEditMode(false)
    return
  }

  // Revert ticks to snapshot
  const currentlyTicked = new Set(ticked)
  const snapshotTicked = editSnapshot

  // Items in current but not in snapshot → untick
  currentlyTicked.forEach((id) => {
    if (!snapshotTicked.has(id)) onToggleItem(id)
  })

  // Items in snapshot but not in current → re-tick
  snapshotTicked.forEach((id) => {
    if (!currentlyTicked.has(id)) onToggleItem(id)
  })

  setEditMode(false)
  setEditSnapshot(null)
}

const handleItemClick = (itemId: string) => {
  // Determine if this click is allowed
  const isCurrentlyTicked = ticked.has(itemId)
  const isLockedByNonOwner = lockedItemIds.has(itemId)
  const isInOwnerConfirmed = confirmedItemIds.has(itemId)

  // Trying to tick something locked by non-owner → block
  if (!isCurrentlyTicked && isLockedByNonOwner) return

  // Trying to untick something locked by non-owner (even if owner confirmed it first) → block
  if (isCurrentlyTicked && isLockedByNonOwner && !isInOwnerConfirmed) return
  if (isCurrentlyTicked && isLockedByNonOwner && isInOwnerConfirmed) return

  // In State 2 (locked, no edit mode) → block all interaction
  if (myPayment && !editMode) return

  onToggleItem(itemId)
}

  // Action handlers
  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNudge = (participantName: string, amount: number) => {
    const url = window.location.href
    const message = `Eh ${participantName}, bayar makan tadi ye 👀 RM ${amount.toFixed(2)} — ${url}`
    navigator.clipboard.writeText(message)
    alert("Message copied! Paste kat WhatsApp ya.")
  }

  const handleMarkAsCash = async (bill: ParticipantBill) => {
    if (!confirm(`Mark ${bill.participant.name} as paid cash RM ${bill.total.toFixed(2)}?`)) return

    setProcessingId(bill.participant.id)
    try {
      const paidItemIds = items
        .filter((item) => getItemSharers(item.id).includes(bill.participant.id))
        .map((item) => item.id)

      await onMarkAsCash(bill.participant.id, bill.total, paidItemIds)
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
    if (!confirm("Mark this payment as unverified? Person akan dapat notification.")) return
    setProcessingId(paymentId)
    try {
      await onUnverify(paymentId)
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setProcessingId(null)
    }
  }

  // Participant handlers
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

  // Status badge
  const getStatusBadge = (bill: ParticipantBill) => {
  // OWNER
  if (bill.participant.is_owner) {
    if (!bill.hasTicked) {
      return { text: "Owner — no items ticked", color: "bg-purple-100 text-purple-800" }
    }
    if (bill.isVerified) {
      return { text: "✅ Owner — confirmed", color: "bg-purple-100 text-purple-800" }
    }
    return { text: "🤔 Owner — not confirmed yet", color: "bg-orange-100 text-orange-800" }
  }

  // FRIEND
  // Not ticked anything (could be either not joined OR joined but no ticks)
  if (!bill.hasTicked) {
    return { text: "🤔 Hasn't ticked yet", color: "bg-gray-100 text-gray-600" }
  }

  // Has ticks but no payment record at all
  if (!bill.payment) {
    return { text: "💸 Ticked, not paid yet", color: "bg-orange-100 text-orange-800" }
  }

  // Payment exists — check its status
  if (bill.isVerified && bill.amountOwed === 0) {
    return { text: "✅ Paid in full", color: "bg-green-100 text-green-800" }
  }
  if (bill.isVerified && bill.amountOwed > 0) {
    return { text: "💰 Partially paid", color: "bg-blue-100 text-blue-800" }
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

        {/* SHARE LINK */}
        <Button
          variant="secondary"
          onClick={handleShare}
          className="w-full text-sm"
        >
          {copied ? "✓ Link copied!" : "📋 Share Link to Friends"}
        </Button>

        {/* YOUR BILL SECTION */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div>
  <div className="text-xs text-gray-500 font-medium uppercase">
    Your Bill ({participant.name})
  </div>
  <div className="text-xs text-gray-400 mt-1">
    {!myPayment
      ? "Tick what you ate, then confirm"
      : editMode
      ? "Make changes — Save or Cancel below"
      : "Click 'Edit' below to make changes"}
  </div>
</div>

          <div className="space-y-2">
  {items.map((item) => {
    const isTicked = ticked.has(item.id)
    const isConfirmed = confirmedItemIds.has(item.id)
    const sharers = getItemSharers(item.id)
    const isShared = sharers.length > 1
    const myShare = isTicked ? getMyShare(item) : 0

    // Locked if non-owner paid for this item (and owner didn't tick it yet)
    const lockedByOthers = lockedItemIds.has(item.id) && !isConfirmed

    // Determine disabled state based on current mode
    const inLockedMode = myPayment && !editMode
    const interactionDisabled = lockedByOthers || inLockedMode

    return (
      <button
        key={item.id}
        onClick={() => handleItemClick(item.id)}
        disabled={!!interactionDisabled}
        className={`w-full p-3 rounded-lg border text-left transition ${
          isTicked
            ? "bg-black text-white border-black"
            : "bg-gray-50 border-gray-200 hover:bg-gray-100"
        } ${interactionDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{item.name}</span>
          <span className="font-semibold text-sm">
            RM {Number(item.price).toFixed(2)}
          </span>
        </div>

        {sharers.length > 0 && (
          <div className={`text-xs mt-1 ${isTicked ? "text-gray-300" : "text-gray-500"}`}>
            {isShared ? (
              <>
                Shared by {getItemSharerNames(item.id).join(", ")}
                {isTicked && ` — your share: RM ${myShare.toFixed(2)}`}
              </>
            ) : sharers.includes(participant.id) ? (
              "Just you"
            ) : (
              `Only ${getItemSharerNames(item.id)[0]}`
            )}
          </div>
        )}

        {isConfirmed && (
          <div className={`text-xs mt-1 font-medium ${isTicked ? "text-green-300" : "text-green-600"}`}>
            ✓ Confirmed
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

          {previewSubtotal > 0 && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">
                  RM {previewBillCalc.subtotal.toFixed(2)}
                </span>
              </div>
              {hasTax && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium text-gray-900">
                    RM {previewBillCalc.tax.toFixed(2)}
                  </span>
                </div>
              )}
              {hasService && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Service</span>
                  <span className="font-medium text-gray-900">
                    RM {previewBillCalc.service.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-xl font-bold text-gray-900">
                  RM {previewTotal.toFixed(2)}
                </span>
              </div>

              {/* State 1: Fresh — Confirm button */}
{!myPayment && hasUnconfirmedChanges && (
  <Button
    variant="primary"
    onClick={handleConfirm}
    disabled={confirming}
    className="w-full mt-3 py-3"
  >
    {confirming ? "Saving..." : `Confirm My Items — RM ${previewTotal.toFixed(2)}`}
  </Button>
)}

{/* State 2: Locked — Edit button */}
{myPayment && !editMode && (
  <div className="space-y-2 mt-3">
    <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-800 text-center">
      ✓ Confirmed — RM {Number(myPayment.amount_paid).toFixed(2)}
    </div>
    <Button
      variant="secondary"
      onClick={handleEnterEditMode}
      className="w-full text-sm"
    >
      📝 Edit My Items
    </Button>
  </div>
)}

{/* State 3: Editing — Save + Cancel */}
{myPayment && editMode && (
  <div className="space-y-2 mt-3">
    {hasUnconfirmedChanges ? (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-800 text-center">
        ⚠️ Unsaved changes
      </div>
    ) : (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-800 text-center">
        Edit mode — make changes or cancel
      </div>
    )}
    <div className="flex gap-2">
      <Button
        variant="secondary"
        onClick={handleCancelEdit}
        disabled={confirming}
        className="flex-1 text-sm"
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        onClick={handleConfirm}
        disabled={confirming || !hasUnconfirmedChanges}
        className="flex-1 text-sm"
      >
        {confirming ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  </div>
)}
            </div>
          )}

          {previewSubtotal === 0 && myPayment && (
            <Button
              variant="danger"
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full text-sm"
            >
              {confirming ? "Updating..." : "Confirm: Remove all my items"}
            </Button>
          )}
        </div>

        {/* ITEMS EDITOR */}
        <ItemsEditor
  items={items}
  participants={bills.map((b) => b.participant)}
  allAssignments={allAssignments}
  payerNames={payerNames}
  isItemLocked={isItemLocked}
  onAddItem={onAddItem}
  onUpdateItem={onUpdateItem}
  onDeleteItem={onDeleteItem}
/>

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

        {/* PARTICIPANTS LIST */}
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

          {/* Add participant inline */}
          {addingParticipant && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 space-y-2">
              <input
                type="text"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                placeholder="Nama peserta baru"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-black"
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
                            title="Delete participant"
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
                            💵 Mark Cash
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              handleNudge(bill.participant.name, bill.amountOwed)
                            }
                            className="flex-1 text-xs py-2"
                          >
                            🔔 Nudge
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
    </main>
  )
}