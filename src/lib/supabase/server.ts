import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseUrl, getSupabaseAnonKey } from './client'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Bỏ qua lỗi nếu gọi từ Server Component
        }
      },
    },
  })
}
