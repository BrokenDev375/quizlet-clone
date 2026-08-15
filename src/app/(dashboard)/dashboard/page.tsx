'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  BookOpen, 
  Layers, 
  Globe, 
  Lock, 
  Sparkles, 
  ArrowRight, 
  FolderPlus,
  Compass
} from 'lucide-react'

export default function DashboardPage() {
  const [sets, setSets] = useState<FlashcardSet[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?next=/dashboard')
        return
      }
      setUser(user)

      // Fetch user sets with cards count
      const { data: setsData, error } = await supabase
        .from('sets')
        .select(`
          *,
          cards (id)
        `)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (setsData) {
        const formatted = setsData.map((s: any) => ({
          ...s,
          card_count: s.cards?.length || 0,
        }))
        setSets(formatted)
      }

      setLoading(false)
    }

    loadUserData()
  }, [])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="inline-block size-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Đang tải thư viện của bạn...</p>
      </div>
    )
  }

  const totalCards = sets.reduce((acc, curr) => acc + (curr.card_count || 0), 0)
  const publicSetsCount = sets.filter((s) => s.is_public).length

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Thư viện của tôi</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý các học phần và thẻ ghi nhớ bạn đã tạo
          </p>
        </div>

        <Link href="/sets/new">
          <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-medium gap-2 shadow-md shadow-indigo-500/20">
            <Plus className="size-4" />
            Tạo học phần mới
          </Button>
        </Link>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/80 bg-card/60">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="size-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
              <Layers className="size-6" />
            </div>
            <div>
              <p className="text-2xl font-black">{sets.length}</p>
              <p className="text-xs text-muted-foreground">Học phần đã tạo</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="size-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <BookOpen className="size-6" />
            </div>
            <div>
              <p className="text-2xl font-black">{totalCards}</p>
              <p className="text-xs text-muted-foreground">Tổng số thẻ từ vựng</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/60">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="size-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <Globe className="size-6" />
            </div>
            <div>
              <p className="text-2xl font-black">{publicSetsCount}</p>
              <p className="text-xs text-muted-foreground">Học phần công khai</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sets List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Danh sách học phần</h2>

        {sets.length === 0 ? (
          <Card className="border-dashed border-2 p-12 text-center bg-card/40">
            <CardContent className="space-y-4">
              <div className="size-16 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                <FolderPlus className="size-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Chưa có học phần nào</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Bạn chưa tạo bộ flashcard nào. Hãy bắt đầu tạo học phần đầu tiên để ôn thi và ghi nhớ hiệu quả!
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <Link href="/sets/new">
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                    <Plus className="size-4" /> Tạo ngay
                  </Button>
                </Link>
                <Link href="/explore">
                  <Button variant="outline" className="gap-1.5">
                    <Compass className="size-4" /> Khám phá học phần mẫu
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sets.map((s) => (
              <Link key={s.id} href={`/sets/${s.id}`} className="group">
                <Card className="border-border/80 bg-card hover:border-indigo-500/50 hover:shadow-md transition duration-200 h-full flex flex-col justify-between">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        {s.card_count} thẻ
                      </span>
                      {s.is_public ? (
                        <span title="Công khai">
                          <Globe className="size-3.5 text-muted-foreground" />
                        </span>
                      ) : (
                        <span title="Riêng tư">
                          <Lock className="size-3.5 text-amber-500" />
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="font-bold text-base text-foreground group-hover:text-indigo-600 transition line-clamp-1">
                        {s.title}
                      </h3>
                      {s.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {s.description}
                        </p>
                      )}
                    </div>
                  </CardContent>

                  <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {new Date(s.created_at).toLocaleDateString('vi-VN')}
                    </span>
                    <span className="text-indigo-600 font-medium group-hover:translate-x-1 transition flex items-center gap-1">
                      Học ngay <ArrowRight className="size-3.5" />
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
