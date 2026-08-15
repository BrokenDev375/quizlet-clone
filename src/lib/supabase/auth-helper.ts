import { NextResponse } from 'next/server'
import { getSupabaseUrl, getSupabaseAnonKey } from './client'

const PROJECT_REF = 'downjqvzgmefflxadbem'
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`

export async function directSupabaseSignup(email: string, password: string, fullName: string) {
  const url = getSupabaseUrl()
  const anonKey = getSupabaseAnonKey()

  const res = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email.trim(),
      password,
      data: {
        full_name: fullName || '',
        username: email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 6),
      },
    }),
  })

  const data = await res.json()
  return { ok: res.ok, status: res.status, data }
}

export async function directSupabaseLogin(email: string, password: string) {
  const url = getSupabaseUrl()
  const anonKey = getSupabaseAnonKey()

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email.trim(),
      password,
    }),
  })

  const data = await res.json()
  return { ok: res.ok, status: res.status, data }
}

export function createAuthResponse(sessionData: any, userData: any) {
  const response = NextResponse.json({
    success: true,
    user: userData || sessionData?.user,
    session: sessionData,
  })

  if (sessionData && sessionData.access_token) {
    const rawSession = {
      access_token: sessionData.access_token,
      token_type: sessionData.token_type || 'bearer',
      expires_in: sessionData.expires_in || 3600,
      expires_at: sessionData.expires_at || Math.floor(Date.now() / 1000) + (sessionData.expires_in || 3600),
      refresh_token: sessionData.refresh_token,
      user: userData || sessionData.user,
    }

    const encoded = 'base64-' + Buffer.from(JSON.stringify(rawSession)).toString('base64')

    response.cookies.set(COOKIE_NAME, encoded, {
      path: '/',
      httpOnly: false, // Accessible to client Supabase SDK
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 3600, // 30 days
    })
  }

  return response
}
