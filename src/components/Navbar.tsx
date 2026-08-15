'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { 
  BookOpen, 
  Plus, 
  Search, 
  Compass, 
  LayoutDashboard, 
  LogOut, 
  User, 
  Menu, 
  X,
  Sparkles
} from 'lucide-react'

export function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/85 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Logo & Nav */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 font-black text-xl tracking-tight text-foreground hover:opacity-90 transition">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="size-5" />
            </div>
            <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-500 bg-clip-text text-transparent">
              Quizlet
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/explore"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition"
            >
              <Compass className="size-4" />
              Khám phá
            </Link>
            {user && (
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition"
              >
                <LayoutDashboard className="size-4" />
                Thư viện của tôi
              </Link>
            )}
          </nav>
        </div>

        {/* Center: Search Bar */}
        <form onSubmit={handleSearch} className="hidden sm:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm bộ thẻ, từ vựng, môn học..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-muted/50 hover:bg-muted/80 focus:bg-background border border-border/80 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
            />
          </div>
        </form>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <Link href="/sets/new">
            <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-sm gap-1.5 rounded-full px-4">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Tạo học phần</span>
            </Button>
          </Link>

          {!loading && (
            user ? (
              <div className="flex items-center gap-2">
                <Link href={`/profile/${user.user_metadata?.username || user.email?.split('@')[0]}`}>
                  <div className="size-8 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-200 dark:border-indigo-800 hover:ring-2 hover:ring-indigo-400 transition" title={user.email}>
                    {user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleLogout}
                  title="Đăng xuất"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Đăng nhập
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" variant="outline" className="hidden sm:inline-flex border-indigo-600/30 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50">
                    Đăng ký
                  </Button>
                </Link>
              </div>
            )
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border p-4 bg-background space-y-3">
          <form onSubmit={handleSearch} className="w-full">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-muted/50 border border-border rounded-lg"
              />
            </div>
          </form>
          <div className="flex flex-col gap-1 pt-2">
            <Link
              href="/explore"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted"
            >
              <Compass className="size-4" />
              Khám phá
            </Link>
            {user && (
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted"
              >
                <LayoutDashboard className="size-4" />
                Thư viện của tôi
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
