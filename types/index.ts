// Item type - a dish on the bill (form data)
export type ItemForm = {
  name: string
  price: string
  quantity: string
  priceMode: 'each' | 'total'
}

// Participant type - a person eating (form data)
export type ParticipantForm = {
  name: string
}

// Session form data - everything collected in the create form
export type SessionFormData = {
  sessionName: string
  items: ItemForm[]
  participants: ParticipantForm[]
}

// Database row types (matches Supabase schema)
export type Session = {
  id: string
  name: string
  mode: 'normal' | 'equal_split'
  tax_type: 'percentage' | 'fixed' | null
  tax_value: number
  service_type: 'percentage' | 'fixed' | null
  service_value: number
  qr_image_url: string | null
  receipt_image_url: string | null
  status: 'open' | 'locked' | 'settled'
  created_at: string
  updated_at: string
}

export type Participant = {
  id: string
  session_id: string
  name: string
  is_owner: boolean
  created_at: string
  updated_at: string
}

export type Item = {
  id: string
  session_id: string
  name: string
  price: number
  quantity: number
  created_at: string
  updated_at: string
}

export type ItemAssignment = {
  id: string
  item_id: string
  participant_id: string
  assigned_by_participant_id: string | null
  status: 'pending' | 'confirmed' | 'rejected'
  quantity: number
  share_group_id: string | null
  created_at: string
  updated_at: string
}

// A share group - group of people sharing N units of an item
export type ShareGroup = {
  id: string
  itemId: string
  quantity: number // how many units they're sharing
  members: {
    participantId: string
    name: string
    status: 'pending' | 'confirmed' | 'rejected'
    isInitiator: boolean
  }[]
}

export type PaymentStatus = 'claimed' | 'verified' | 'unverified' | 'cancelled'

// One payment ROUND. A participant can have many of these — verify/unverify
// act on a single round, not the participant's whole running total. Bill
// math aggregates across all of a participant's payment rows by status.
export type Payment = {
  id: string
  session_id: string
  participant_id: string
  amount_paid: number
  status: PaymentStatus
  method: 'qr' | 'cash' | 'manual' | null
  paid_item_ids: string[]
  paid_item_quantities: Record<string, number>
  paid_share_group_ids: string[]
  created_at: string
  updated_at: string
}

export type Receipt = {
  id: string
  session_id: string
  image_url: string
  uploaded_by_participant_id: string | null
  created_at: string
}

export type PaymentMethod = {
  id: string
  session_id: string
  image_url: string
  label: string | null
  display_order: number
  created_at: string
}

export type SessionCharge = {
  id: string
  session_id: string
  label: string | null
  charge_type: "percentage" | "fixed"
  charge_value: number
  display_order: number
  created_at: string
}

// Loaded session data (with items and participants)
export type LoadedSession = {
  session: Session
  participants: Participant[]
  items: Item[]
}

export type UserSession = {
  id: string
  user_id: string
  session_id: string
  participant_id: string
  role: "owner" | "friend"
  joined_at: string
  created_at: string
}

import type { User } from "@supabase/supabase-js"

export type AuthState = {
  user: User | null
  loading: boolean
  isSignedIn: boolean
}