import { NextResponse } from 'next/server'
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/client'

export async function GET() {
  const url = getSupabaseUrl()
  const anonKey = getSupabaseAnonKey()

  let fetchResult = null
  let fetchError = null

  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: {
        apikey: anonKey,
      },
    })
    fetchResult = {
      status: res.status,
      data: await res.json(),
    }
  } catch (err: any) {
    fetchError = {
      message: err.message,
      cause: err.cause ? String(err.cause) : null,
      stack: err.stack,
    }
  }

  return NextResponse.json({
    env_url_raw: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
    resolved_url: url,
    anon_key_prefix: anonKey.substring(0, 15) + '...',
    anon_key_length: anonKey.length,
    fetchResult,
    fetchError,
  })
}
