import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ thông tin' },
        { status: 400 }
      )
    }

    const url = getSupabaseUrl()
    const anonKey = getSupabaseAnonKey()
    let response = NextResponse.json({ success: true })

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    })

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName || '',
          username:
            email.split('@')[0] +
            '_' +
            Math.random().toString(36).substring(2, 6),
        },
      },
    })

    if (error) {
      // Fallback to direct HTTP fetch if SSR SDK failed
      const directRes = await fetch(`${url}/auth/v1/signup`, {
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
            username:
              email.split('@')[0] +
              '_' +
              Math.random().toString(36).substring(2, 6),
          },
        }),
      })

      const directData = await directRes.json()
      if (!directRes.ok) {
        const msg =
          directData.msg ||
          directData.error_description ||
          directData.error ||
          error.message
        return NextResponse.json({ error: msg }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        user: directData.user,
        session: directData,
      })
    }

    return NextResponse.json({
      success: true,
      user: data.user,
      session: data.session,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Lỗi hệ thống khi đăng ký' },
      { status: 500 }
    )
  }
}
