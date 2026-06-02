// Item type — a dish on the bill (form data)
export type ItemForm = {
  name: string
  price: string  // string because <input> returns string
}

// Participant type — a person eating (form data)
export type ParticipantForm = {
  name: string
}

// Session form data — everything collected in the create form
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
  created_at: string
  updated_at: string
}

export type ItemAssignment = {
  id: string
  item_id: string
  participant_id: string
  assigned_by_participant_id: string | null
  status: 'pending' | 'confirmed' | 'rejected'
  created_at: string
  updated_at: string
}

export type Payment = {
  id: string
  session_id: string
  participant_id: string
  amount_paid: number
  status: 'unpaid' | 'claimed' | 'verified' | 'unverified'
  method: 'qr' | 'cash' | null
  paid_item_ids: string[]  // ← NEW
  created_at: string
  updated_at: string
}

// Loaded session data (with items and participants)
export type LoadedSession = {
  session: Session
  participants: Participant[]
  items: Item[]
}