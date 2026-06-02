"use client"

import { useCreateSession } from "@/hooks/useCreateSession"
import SessionNameInput from "./_components/SessionNameInput"
import ItemsSection from "./_components/ItemsSection"
import ParticipantsSection from "./_components/ParticipantsSection"
import TaxSection from "./_components/TaxSection"
import QRUploadSection from "./_components/QRUploadSection"
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
    tax,
    setTax,
    service,
    setService,
    qrFile,
    setQrFile,
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

        <TaxSection label="Tax" config={tax} onChange={setTax} />

        <TaxSection label="Service Charge" config={service} onChange={setService} />

        <QRUploadSection file={qrFile} onChange={setQrFile} />

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
      <Spinner size={18} />
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