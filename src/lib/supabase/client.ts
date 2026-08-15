import { createBrowserClient } from '@supabase/ssr'

export function getSupabaseUrl(): string {
  const envUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  
  // Extract project ref if contains supabase.co
  const match = envUrl.match(/([a-z0-9-]+)\.supabase\.co/i)
  if (match && match[1]) {
    return `https://${match[1]}.supabase.co`
  }
  
  // If user only entered project ID
  if (/^[a-z0-9]{20}$/i.test(envUrl)) {
    return `https://${envUrl}.supabase.co`
  }

  if (envUrl.startsWith('http://') || envUrl.startsWith('https://')) {
    try {
      const parsed = new URL(envUrl)
      return parsed.origin
    } catch {}
  }

  // Fallback to current project
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
