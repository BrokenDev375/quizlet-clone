'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Mail, Lock, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      // 1. Try server-side API first (bypasses browser adblock / CORS)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const result = await res.json()

      if (!res.ok || result.error) {
        setErrorMsg(result.error || 'Đăng nhập thất bại')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err: any) {
      // 2. Fallback to client SDK if API route fails
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) {
          setErrorMsg(error.message === 'Invalid login credentials' ? 'Email hoặc mật khẩu không chính xác' : error.message)
        } else {
          router.push('/dashboard')
          router.refresh()
        }
      } catch (fallbackErr: any) {
        setErrorMsg('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setErrorMsg(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header Icon */}
        <div className="text-center space-y-2">
          <div className="inline-flex size-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 items-center justify-center text-white shadow-lg shadow-indigo-500/25">
            <Sparkles className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Chào mừng bạn trở lại!</h1>
          <p className="text-sm text-muted-foreground">Đăng nhập để tiếp tục hành trình học tập của bạn</p>
        </div>

        <Card className="border-border/80 shadow-xl shadow-indigo-500/5 bg-card/60 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Đăng nhập</CardTitle>
            <CardDescription>Nhập thông tin tài khoản Quizlet của bạn</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMsg && (
              <div className="p-3 text-sm rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Google OAuth Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-10 border-border hover:bg-muted/60 font-normal flex items-center justify-center gap-2.5"
            >
              <svg className="size-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                />
              </svg>
              <span>Tiếp tục với Google</span>
            </Button>

            <div className="relative flex items-center justify-center my-2">
              <div className="border-t border-border w-full" />
              <span className="bg-card px-3 text-xs text-muted-foreground uppercase absolute">hoặc</span>
            </div>

            {/* Email / Password Form */}
            <form onSubmit={handleEmailLogin} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Lock className="size-3.5" />
                  Mật khẩu
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-medium shadow-md shadow-indigo-500/20"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    Đăng nhập <ArrowRight className="size-4" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-border/40 pt-4">
            <p className="text-sm text-muted-foreground">
              Chưa có tài khoản?{' '}
              <Link href="/signup" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                Đăng ký ngay
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
