import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ email và mật khẩu' },
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

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      // Fallback to direct HTTP fetch
      const directRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
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

      const directData = await directRes.json()
      if (!directRes.ok) {
        const rawMsg =
          directData.error_description || directData.msg || directData.error || error.message
        const msg =
          rawMsg === 'Invalid login credentials'
            ? 'Email hoặc mật khẩu không chính xác'
            : rawMsg
        return NextResponse.json({ error: msg }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        user: directData.user,
        session: directData,
      })
    }

    return NextResponse.json({ success: true, user: data.user })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Lỗi hệ thống khi đăng nhập' },
      { status: 500 }
    )
  }
}
