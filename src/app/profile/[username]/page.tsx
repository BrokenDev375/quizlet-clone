'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Profile } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { User, BookOpen, ArrowRight, Layers } from 'lucide-react'

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const resolvedParams = use(params)
  const username = decodeURIComponent(resolvedParams.username)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [sets, setSets] = useState<FlashcardSet[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      // Find profile by username
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()

      if (profileData) {
        setProfile(profileData)

        // Find public sets by this owner
        const { data: setsData } = await supabase
          .from('sets')
          .select(`
            *,
            cards (id)
          `)
          .eq('owner_id', profileData.id)
          .eq('is_public', true)
          .order('created_at', { ascending: false })

        if (setsData) {
          const formatted = setsData.map((s: any) => ({
            ...s,
            card_count: s.cards?.length || 0,
          }))
          setSets(formatted)
        }
      }

      setLoading(false)
    }

    loadProfile()
  }, [username])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="inline-block size-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Đang tải trang cá nhân...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Profile Header */}
      <div className="p-6 sm:p-8 rounded-2xl border border-border/80 bg-card/60 flex flex-col sm:flex-row items-center gap-6">
        <div className="size-20 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
          {profile?.username?.[0]?.toUpperCase() || username[0]?.toUpperCase() || 'U'}
        </div>
        <div className="text-center sm:text-left space-y-1">
          <h1 className="text-2xl font-black">{profile?.full_name || username}</h1>
          <p className="text-sm text-muted-foreground">@{username}</p>
          <div className="flex items-center justify-center sm:justify-start gap-4 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="size-3.5" /> {sets.length} học phần công khai
            </span>
          </div>
        </div>
      </div>

      {/* Sets List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Học phần đã tạo ({sets.length})</h2>

        {sets.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4">Người dùng này chưa có học phần công khai nào.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sets.map((s) => (
              <Link key={s.id} href={`/sets/${s.id}`} className="group">
                <Card className="border-border/80 bg-card hover:border-indigo-500/50 hover:shadow-md transition duration-200 h-full flex flex-col justify-between">
                  <CardContent className="p-5 space-y-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      {s.card_count} thẻ
                    </span>
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
                    <span>{new Date(s.created_at).toLocaleDateString('vi-VN')}</span>
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
