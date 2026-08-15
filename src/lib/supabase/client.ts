import { createBrowserClient } from '@supabase/ssr'

export function getSupabaseUrl(): string {
  let url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://downjqvzgmefflxadbem.supabase.co'
  
  url = url.trim().replace(/\/+$/, '')
  // Tự động cắt bỏ /rest/v1 nếu người dùng copy nhầm REST URL
  url = url.replace(/\/rest\/v1\/?$/, '')
  return url
}

export function getSupabaseAnonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd25qcXZ6Z21lZmZseGFkYmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTg1NzYsImV4cCI6MjEwMjM3NDU3Nn0.-HGH6IbexNZ-iP2M5JJ_e3dcBj7min9_X-ikL-Vdl1Q'
  return key.trim()
}

export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey())
}
