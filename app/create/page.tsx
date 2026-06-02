"use client"

import { useCreateSession } from "@/hooks/useCreateSession"
import SessionNameInput from "./_components/SessionNameInput"
import ItemsSection from "./_components/ItemsSection"
import ParticipantsSection from "./_components/ParticipantsSection"
import TaxSection from "./_components/TaxSection"
import QRUploadSection from "./_components/QRUploadSection"
import Button from "@/components/ui/Button"

export default function CreateSessionPage() {
  const {
    sessionName,
    setSessionName,
    items,
    setItems,
    participants,
    setParticipants,
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
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Create Session</h1>

        <SessionNameInput value={sessionName} onChange={setSessionName} />

        <ItemsSection items={items} onChange={setItems} />

        <ParticipantsSection participants={participants} onChange={setParticipants} />

        <TaxSection label="Tax" config={tax} onChange={setTax} />

        <TaxSection label="Service Charge" config={service} onChange={setService} />

        <QRUploadSection file={qrFile} onChange={setQrFile} />

        <Button
          variant="primary"
          onClick={createSession}
          disabled={loading}
          className="w-full py-4 text-base"
        >
          {loading ? "Creating..." : "Create Session"}
        </Button>
      </div>
    </main>
  )
}