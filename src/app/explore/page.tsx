'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { 
  Compass, 
  Search, 
  BookOpen, 
  Sparkles, 
  ArrowRight, 
  User,
  Flame,
  Globe
} from 'lucide-react'

const CATEGORIES = [
  'Tất cả',
  'Tiếng Anh & Ngoại ngữ',
  'Lập trình & CNTT',
  'Y Dược & Y tế',
  'Toán & Khoa học',
  'Lịch sử & Xã hội',
]

function ExploreContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''

  const [query, setQuery] = useState(initialQuery)
  const [selectedCategory, setSelectedCategory] = useState('Tất cả')
  const [sets, setSets] = useState<FlashcardSet[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchPublicSets() {
      setLoading(true)

      let req = supabase
        .from('sets')
        .select(`
          *,
          profiles:owner_id (id, username, full_name, avatar_url),
          cards (id)
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false })

      if (query.trim()) {
        req = req.ilike('title', `%${query.trim()}%`)
      }

      const { data, error } = await req

      if (data) {
        const formatted = data.map((s: any) => ({
          ...s,
          card_count: s.cards?.length || 0,
        }))
        setSets(formatted)
      }

      setLoading(false)
    }

    fetchPublicSets()
  }, [query])

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex size-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 items-center justify-center text-white shadow-lg shadow-indigo-500/25">
          <Compass className="size-6" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Khám phá học phần cộng đồng</h1>
        <p className="text-sm text-muted-foreground">
          Tìm kiếm và học tập hàng ngàn bộ flashcard chất lượng được chia sẻ từ mọi người
        </p>

        {/* Search Bar */}
        <div className="relative max-w-lg mx-auto pt-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo chủ đề, từ khóa, môn học..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-11 text-sm rounded-full bg-card shadow-sm border-border/80"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center justify-center gap-2 flex-wrap pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Sets Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">
            {query ? `Kết quả tìm kiếm cho "${query}"` : 'Học phần nổi bật'}
          </h2>
          <span className="text-xs text-muted-foreground">{sets.length} học phần</span>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block size-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-sm text-muted-foreground">Đang tìm kiếm học phần...</p>
          </div>
        ) : sets.length === 0 ? (
          <Card className="border-dashed border-2 p-12 text-center bg-card/40">
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">Không tìm thấy học phần phù hợp.</p>
              <Link href="/sets/new">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  Tạo học phần của riêng bạn
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sets.map((s) => (
              <Link key={s.id} href={`/sets/${s.id}`} className="group">
                <Card className="border-border/80 bg-card hover:border-indigo-500/50 hover:shadow-md transition duration-200 h-full flex flex-col justify-between">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        {s.card_count} thuật ngữ
                      </span>
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
                    <div className="flex items-center gap-2">
                      <div className="size-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex items-center justify-center">
                        {s.profiles?.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="line-clamp-1">
                        {s.profiles?.full_name || s.profiles?.username || 'Thành viên'}
                      </span>
                    </div>
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

export default function ExplorePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={
        <div className="py-16 text-center">
          <div className="inline-block size-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-sm text-muted-foreground">Đang tải trang khám phá...</p>
        </div>
      }>
        <ExploreContent />
      </Suspense>
    </div>
  )
}
