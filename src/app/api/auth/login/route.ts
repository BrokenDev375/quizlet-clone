import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ email và mật khẩu' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      const message =
        error.message === 'Invalid login credentials'
          ? 'Email hoặc mật khẩu không chính xác'
          : error.message
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ success: true, user: data.user })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Lỗi hệ thống khi đăng nhập' },
      { status: 500 }
    )
  }
}
