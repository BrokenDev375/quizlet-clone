import { createBrowserClient } from '@supabase/ssr'

export function getSupabaseUrl(): string {
  const envUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  
  // Extract project ref from any malformed supabase URL (including missing 'o' like .supabase.c or trailing /rest/v1)
  const match =
    envUrl.match(/([a-z0-9-]{15,30})\.supabase/i) ||
    envUrl.match(/([a-z0-9]{20})/i)
    
  if (match && match[1]) {
    return `https://${match[1]}.supabase.co`
  }

  // Fallback default
  return 'https://downjqvzgmefflxadbem.supabase.co'
}

export function getSupabaseAnonKey(): string {
  const envKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
  const cleanKey = envKey.replace(/^["'\s]+|["'\s]+$/g, '').trim()
  
  if (cleanKey && cleanKey.startsWith('eyJ')) {
    return cleanKey
  }

  // Fallback to active project anon key
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd25qcXZ6Z21lZmZseGFkYmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTg1NzYsImV4cCI6MjEwMjM3NDU3Nn0.-HGH6IbexNZ-iP2M5JJ_e3dcBj7min9_X-ikL-Vdl1Q'
}

export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey())
}
