import { NextResponse, NextRequest } from 'next/server'
import { directSupabaseSignup, createAuthResponse } from '@/lib/supabase/auth-helper'

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ thông tin' },
        { status: 400 }
      )
    }

    const { ok, data } = await directSupabaseSignup(email, password, fullName)

    if (!ok) {
      const errorMsg =
        data.msg ||
        data.error_description ||
        data.error ||
        'Đăng ký thất bại. Vui lòng thử lại.'
      return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    return createAuthResponse(data, data.user)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Lỗi hệ thống khi đăng ký' },
      { status: 500 }
    )
  }
}
