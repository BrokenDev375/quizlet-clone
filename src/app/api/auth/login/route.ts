import { NextResponse, NextRequest } from 'next/server'
import { directSupabaseLogin, createAuthResponse } from '@/lib/supabase/auth-helper'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ email và mật khẩu' },
        { status: 400 }
      )
    }

    const { ok, data } = await directSupabaseLogin(email, password)

    if (!ok) {
      const rawMsg =
        data.error_description || data.msg || data.error || 'Đăng nhập thất bại'
      const errorMsg =
        rawMsg === 'Invalid login credentials'
          ? 'Email hoặc mật khẩu không chính xác'
          : rawMsg
      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    return createAuthResponse(data, data.user)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Lỗi hệ thống khi đăng nhập' },
      { status: 500 }
    )
  }
}
