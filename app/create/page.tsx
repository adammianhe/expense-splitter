"use client"

import { useCreateSession } from "@/hooks/useCreateSession"
import SessionNameInput from "./_components/SessionNameInput"
import ItemsSection from "./_components/ItemsSection"
import ParticipantsSection from "./_components/ParticipantsSection"
import ChargesSection from "./_components/ChargesSection"
import PaymentMethodsSection from "./_components/PaymentMethodsSection"
import Button from "@/components/ui/Button"
import ReceiptUploadSection from "./_components/ReceiptUploadSection"
import AppHeader from "@/components/AppHeader"
import Spinner from "@/components/ui/Spinner"

export default function CreateSessionPage() {
  const {
    sessionName,
    setSessionName,
    items,
    setItems,
    participants,
    setParticipants,
    receiptFiles, setReceiptFiles,
    charges,
    setCharges,
    paymentMethods,
    setPaymentMethods,
    loading,
    createSession,
  } = useCreateSession()

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-md mx-auto space-y-6">
          <h1 className="text-3xl font-bold text-gray-900">Create Session</h1>

        <SessionNameInput value={sessionName} onChange={setSessionName} />

        <ItemsSection items={items} onChange={setItems} />

        <ParticipantsSection participants={participants} onChange={setParticipants} />

        <ChargesSection charges={charges} onChange={setCharges} />

        <PaymentMethodsSection methods={paymentMethods} onChange={setPaymentMethods} />

        <ReceiptUploadSection
  files={receiptFiles}
  onChange={setReceiptFiles}
/>

        <Button
  variant="primary"
  onClick={createSession}
  disabled={loading}
  className="w-full py-4 text-lg"
>
  {loading ? (
    <span className="flex items-center justify-center gap-2">
      <Spinner size={20} />
      Creating...
    </span>
  ) : (
    "Create Session"
  )}
</Button>
      </div>
    </main>
    </>
  )
}