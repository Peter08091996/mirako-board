import { createClient } from '@supabase/supabase-js'

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

export const supabaseMissing = !url || !key
export const supabase = supabaseMissing
  ? (null as any)
  : createClient(url, key)

// force re-deploy to bust corrupted Vercel chunk cache
export type Task = {
  id: string
  content: string
  status: 'todo' | 'doing' | 'done'
  assignee_ids: string[]
  created_by: string
  created_at: string
}

export type Member = {
  id: string
  name: string
  abbr: string
}
