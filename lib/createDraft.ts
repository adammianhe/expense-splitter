import { ItemForm, ParticipantForm } from "@/types"
import { ChargeInput } from "@/app/create/_components/ChargesSection"

export const CREATE_DRAFT_KEY = "splitto:create_draft"

export type CreateDraft = {
  sessionName: string
  items: ItemForm[]
  participants: ParticipantForm[]
  charges: ChargeInput[]
  savedAt: string
}

export function hasCreateDraft(): boolean {
  if (typeof window === "undefined") return false
  try {
    return sessionStorage.getItem(CREATE_DRAFT_KEY) !== null
  } catch {
    return false
  }
}

export function readCreateDraft(): CreateDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(CREATE_DRAFT_KEY)
    return raw ? (JSON.parse(raw) as CreateDraft) : null
  } catch {
    return null
  }
}

export function writeCreateDraft(draft: Omit<CreateDraft, "savedAt">): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(
      CREATE_DRAFT_KEY,
      JSON.stringify({ ...draft, savedAt: new Date().toISOString() })
    )
  } catch {
    // best effort — sessionStorage full/unavailable
  }
}

export function clearCreateDraft(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(CREATE_DRAFT_KEY)
  } catch {
    // best effort
  }
}
