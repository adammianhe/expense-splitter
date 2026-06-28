"use client"

import { useEffect, useState, use } from "react"
import { useSession } from "@/hooks/useSession"
import { useItemAssignments } from "@/hooks/useItemAssignments"
import { usePayments } from "@/hooks/usePayments"
import { useSessionBills } from "@/hooks/useSessionBills"
import { useSessionEditor } from "@/hooks/useSessionEditor"
import { useToast } from "@/hooks/useToast"
import { useChangeNotifications } from "@/hooks/useChangeNotifications"
import { getParticipantId, clearParticipantId } from "@/lib/utils"
import NamePicker from "./_components/NamePicker"
import ItemTicker from "./_components/ItemTicker"
import OwnerDashboard from "./_components/OwnerDashboard"
import ToastContainer from "@/components/ui/ToastContainer"
import { useReceipts } from "@/hooks/useReceipts"
import { usePaymentMethods } from "@/hooks/usePaymentMethods"
import { useSessionCharges } from "@/hooks/useSessionCharges"
import ReceiptManager from "./_components/ReceiptManager"
import AppHeader from "@/components/AppHeader"
import { Skeleton, SkeletonCard, SkeletonItemRow } from "@/components/ui/Skeleton"


export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params)
  const { data, loading, error, reload } = useSession(sessionId)
  const { receipts, uploadReceipt, deleteReceipt } = useReceipts(sessionId)
  const {
    paymentMethods,
    uploadPaymentMethod,
    updatePaymentMethodLabel,
    deletePaymentMethod,
  } = usePaymentMethods(sessionId)
  const { charges } = useSessionCharges(sessionId)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [checkedStorage, setCheckedStorage] = useState(false)

  // Scroll to top when navigating to this page
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Toast system
  const { toasts, showToast, dismissToast } = useToast()

  useEffect(() => {
    const stored = getParticipantId(sessionId)
    if (stored) setParticipantId(stored)
    setCheckedStorage(true)
  }, [sessionId])
const {
  soloQty,
  allAssignments,
  incrementSolo,
  decrementSolo,
  createShare,
  confirmShare,
  rejectShare,
  removeShare,
} = useItemAssignments(sessionId, participantId)

  const {
    payments,
    claimPayment,
    getPayment,
    verifyPayment,
    unverifyPayment,
    markAsCash,
    ownerConfirmPayment,
  } = usePayments(sessionId)

  const { bills, summary } = useSessionBills(
    data?.session || null,
    data?.participants || [],
    data?.items || [],
    allAssignments,
    payments,
    charges
  )

  const editor = useSessionEditor(sessionId, payments, reload)

// Items locked from new tickers
// Lock only if: (a) non-owner paid AND (b) item is fully claimed (no room left)
const lockedItemIds = new Set<string>()
if (data) {
  const ownerIds = new Set(
    data.participants.filter((p) => p.is_owner).map((p) => p.id)
  )

  // Build map of item_id → total claimed quantity (solo + confirmed shares)
  const claimedPerItem = new Map<string, number>()
  data.items.forEach((item) => {
    let solo = 0
    let shareTotal = 0

    // Solo confirmed
    allAssignments
      .filter(
        (a) =>
          a.item_id === item.id &&
          a.share_group_id === null &&
          a.status === "confirmed"
      )
      .forEach((a) => {
        solo += Number(a.quantity) || 0
      })

    // Pending shares reserve capacity too: count any share group that still
    // has an active (pending or confirmed) member. Only a fully-rejected group
    // frees the quantity back up for others to claim.
    const shareGroupIds = new Set(
      allAssignments
        .filter((a) => a.item_id === item.id && a.share_group_id !== null)
        .map((a) => a.share_group_id)
    )
    shareGroupIds.forEach((groupId) => {
      const members = allAssignments.filter((a) => a.share_group_id === groupId)
      const anyActive = members.some((m) => m.status !== "rejected")
      if (anyActive) shareTotal += Number(members[0].quantity) || 0
    })

    claimedPerItem.set(item.id, solo + shareTotal)
  })

  // Now check each non-owner payment
  payments.forEach((p) => {
    if (!ownerIds.has(p.participant_id)) {
      ;(p.paid_item_ids || []).forEach((id) => {
        const item = data.items.find((i) => i.id === id)
        if (!item) return
        const totalClaimed = claimedPerItem.get(id) || 0
        // Lock only if fully claimed (no room for new tickers)
        if (totalClaimed >= item.quantity) {
          lockedItemIds.add(id)
        }
      })
    }
  })
}

  // Change notifications
 useChangeNotifications({
  participantId,
  participants: data?.participants || [],
  items: data?.items || [],
  allAssignments,
  isInitialLoad: loading,
})

  if (loading || !checkedStorage) {
  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Header skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-3 w-40" />
          </div>

          {/* Share button skeleton */}
          <Skeleton className="h-10 w-full rounded-lg" />

          {/* Card skeletons */}
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonItemRow />
          <SkeletonItemRow />
          <SkeletonItemRow />
        </div>
      </main>
    </>
  )
}

  if (error || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-500 font-medium">Session tak jumpa</p>
          <p className="text-gray-500 text-sm mt-2">{error}</p>
        </div>
      </main>
    )
  }

  const currentParticipant = participantId
    ? data.participants.find((p) => p.id === participantId)
    : null

  // If saved participant got deleted by owner, clear localStorage
  if (participantId && !currentParticipant) {
    clearParticipantId(sessionId)
  }

  return (
    <>
    <AppHeader />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {!currentParticipant ? (
  <NamePicker
    sessionId={sessionId}
    sessionName={data.session.name}
    participants={data.participants}
    onPicked={setParticipantId}
  />
) : currentParticipant.is_owner ? (
  <OwnerDashboard
  receipts={receipts}
onUploadReceipt={(file: File) => uploadReceipt(file, currentParticipant.id).then(() => {})}
onDeleteReceipt={deleteReceipt}
paymentMethods={paymentMethods}
onUploadPaymentMethod={(file: File, label?: string) => uploadPaymentMethod(file, label).then(() => {})}
onUpdatePaymentMethodLabel={updatePaymentMethodLabel}
onDeletePaymentMethod={deletePaymentMethod}
charges={charges}
      session={data.session}
      participant={currentParticipant}
      bills={bills}
      items={data.items}
      soloQty={soloQty}
      allAssignments={allAssignments}
      summary={summary}
      lockedItemIds={lockedItemIds}
      isItemLocked={editor.isItemLocked}
      canDeleteParticipant={editor.canDeleteParticipant}
      onAddItem={editor.addItem}
      onUpdateItem={editor.updateItem}
      onDeleteItem={editor.deleteItem}
      onAddParticipant={editor.addParticipant}
      onDeleteParticipant={editor.deleteParticipant}
      onIncrementItem={incrementSolo}
      onDecrementItem={decrementSolo}
      onCreateShare={createShare}
      onConfirmShare={confirmShare}
      onRejectShare={rejectShare}
      onRemoveShare={removeShare}
      onSwitchName={() => {
        clearParticipantId(sessionId)
        setParticipantId(null)
      }}
      onVerify={verifyPayment}
      onUnverify={unverifyPayment}
      onMarkAsCash={(participantId, amount, paidItemIds, paidItemQuantities, paidShareGroupIds) =>
        markAsCash(participantId, amount, paidItemIds, paidItemQuantities, paidShareGroupIds)
      }
      onOwnerConfirm={(participantId, amount, paidItemIds, paidItemQuantities, paidShareGroupIds) =>
        ownerConfirmPayment(participantId, amount, paidItemIds, paidItemQuantities, paidShareGroupIds)
      }
    />
  
) : (
  <ItemTicker
  receipts={receipts}
      paymentMethods={paymentMethods}
      charges={charges}
      session={data.session}
      participant={currentParticipant}
      participants={data.participants}
      items={data.items}
      soloQty={soloQty}
      allAssignments={allAssignments}
      myPayment={getPayment(currentParticipant.id)}
      lockedItemIds={lockedItemIds}
      onIncrement={incrementSolo}
      onDecrement={decrementSolo}
      onCreateShare={createShare}
      onConfirmShare={confirmShare}
      onRejectShare={rejectShare}
      onRemoveShare={removeShare}
      onSwitchName={() => {
        clearParticipantId(sessionId)
        setParticipantId(null)
      }}
      onClaimPayment={(amount, method, paidItemIds, paidItemQuantities, paidShareGroupIds) =>
        claimPayment(
          currentParticipant.id,
          amount,
          method,
          paidItemIds,
          paidItemQuantities,
          paidShareGroupIds
        )
      }
    />
  
)}
    </>
  )
}