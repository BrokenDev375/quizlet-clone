'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  BookOpen, 
  Brain, 
  FileCheck2, 
  Gamepad2, 
  Edit3, 
  ChevronLeft, 
  ChevronRight, 
  RotateCw, 
  Volume2, 
  Shuffle, 
  ArrowLeft, 
  Maximize2, 
  User, 
  Calendar,
  Lock,
  Globe,
  Trash2
} from 'lucide-react'

export default function SetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const setId = resolvedParams.id

  const [set, setSet] = useState<FlashcardSet | null>(null)
  const [cards, setCards] = useState<CardType[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isShuffled, setIsShuffled] = useState(false)
  const [flippedSide, setFlippedSide] = useState<'term' | 'definition'>('term') // start with term
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      // Fetch Set info
      const { data: setData, error: setError } = await supabase
        .from('sets')
        .select(`
          *,
          profiles:owner_id (id, username, full_name, avatar_url)
        `)
        .eq('id', setId)
        .single()

      if (setError || !setData) {
        setLoading(false)
        return
      }

      setSet(setData)

      // Fetch Cards
      const { data: cardsData } = await supabase
        .from('cards')
        .select('*')
        .eq('set_id', setId)
        .order('position', { ascending: true })

      if (cardsData) {
        setCards(cardsData)
      }

      setLoading(false)
    }

    fetchData()
  }, [setId])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setIsFlipped((prev) => !prev)
      } else if (e.code === 'ArrowRight') {
        handleNext()
      } else if (e.code === 'ArrowLeft') {
        handlePrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cards.length, currentIndex])

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false)
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false)
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5)
    setCards(shuffled)
    setCurrentIndex(0)
    setIsFlipped(false)
    setIsShuffled(true)
  }

  const handleSpeak = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && text) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text.trim())
      if (/[\u4e00-\u9fa5]/.test(text)) {
        utterance.lang = 'zh-CN'
        utterance.rate = 0.85
      } else if (/[à-ỹÀ-Ỹ]/.test(text)) {
        utterance.lang = 'vi-VN'
      } else {
        utterance.lang = 'en-US'
        utterance.rate = 0.95
      }
      window.speechSynthesis.speak(utterance)
    }
  }

  const handleDeleteSet = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa học phần này không?')) return
    await supabase.from('sets').delete().eq('id', setId)
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="inline-block size-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Đang tải học phần...</p>
      </div>
    )
  }

  if (!set) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold">Không tìm thấy học phần</h2>
        <p className="text-muted-foreground text-sm">Học phần này không tồn tại hoặc đã được chuyển sang chế độ riêng tư.</p>
        <Link href="/explore">
          <Button>Khám phá học phần khác</Button>
        </Link>
      </div>
    )
  }

  const currentCard = cards[currentIndex]
  const isOwner = user && user.id === set.owner_id
  const progressPercent = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Breadcrumb & Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/explore" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 transition">
            <ArrowLeft className="size-4" />
            Tất cả học phần
          </Link>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{set.title}</h1>
            {set.is_public ? (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Globe className="size-3" /> Công khai
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1 text-xs">
                <Lock className="size-3" /> Riêng tư
              </Badge>
            )}
          </div>
          {set.description && (
            <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{set.description}</p>
          )}
        </div>

        {/* Action Controls for Owner */}
        {isOwner && (
          <div className="flex items-center gap-2">
            <Link href={`/sets/${setId}/edit`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Edit3 className="size-4" /> Sửa
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleDeleteSet} className="text-destructive hover:bg-destructive/10">
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Study Modes Navigation Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href={`/sets/${setId}`} className="group">
          <div className="p-3.5 rounded-xl border-2 border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 flex items-center gap-3 transition shadow-xs">
            <div className="size-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <BookOpen className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-950 dark:text-indigo-200">Thẻ ghi nhớ</p>
              <p className="text-xs text-muted-foreground">Lật thẻ 3D</p>
            </div>
          </div>
        </Link>

        <Link href={`/sets/${setId}/learn`} className="group">
          <div className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-indigo-500/50 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 flex items-center gap-3 transition">
            <div className="size-10 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition">
              <Brain className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Chế độ Học</p>
              <p className="text-xs text-muted-foreground">Trắc nghiệm</p>
            </div>
          </div>
        </Link>

        <Link href={`/sets/${setId}/test`} className="group">
          <div className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-indigo-500/50 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 flex items-center gap-3 transition">
            <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition">
              <FileCheck2 className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Kiểm tra</p>
              <p className="text-xs text-muted-foreground">Làm bài thi</p>
            </div>
          </div>
        </Link>

        <Link href={`/sets/${setId}/match`} className="group">
          <div className="p-3.5 rounded-xl border border-border/80 bg-card hover:border-indigo-500/50 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 flex items-center gap-3 transition">
            <div className="size-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition">
              <Gamepad2 className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Ghép thẻ</p>
              <p className="text-xs text-muted-foreground">Trò chơi tốc độ</p>
            </div>
          </div>
        </Link>
      </div>

      {/* 3D Flashcard Player */}
      {cards.length > 0 ? (
        <div className="space-y-4">
          <div className="perspective-1000 w-full min-h-[340px] sm:min-h-[380px]">
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className={`relative w-full h-[340px] sm:h-[380px] rounded-2xl cursor-pointer transition-transform duration-500 transform-style-3d shadow-xl shadow-indigo-500/5 select-none ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
              style={{
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* FRONT (Term) */}
              <div
                className="absolute inset-0 w-full h-full rounded-2xl border-2 border-border/80 bg-gradient-to-b from-card to-card/90 p-8 flex flex-col justify-between backface-hidden"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider">Thuật ngữ</span>
                  <button
                    onClick={(e) => handleSpeak(currentCard.term, e)}
                    className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition"
                    title="Phát âm"
                  >
                    <Volume2 className="size-5" />
                  </button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center text-center px-4 space-y-2">
                  <p className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
                    {currentCard.term}
                  </p>
                  {currentCard.phonetic && (
                    <span className="text-sm sm:text-base font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-3 py-0.5 rounded-full border border-indigo-500/20">
                      {currentCard.phonetic}
                    </span>
                  )}
                </div>

                <div className="text-center text-xs text-muted-foreground/70 font-medium">
                  Nhấn chuột hoặc phím Space để xem định nghĩa
                </div>
              </div>

              {/* BACK (Definition) */}
              <div
                className="absolute inset-0 w-full h-full rounded-2xl border-2 border-indigo-500/40 bg-gradient-to-b from-indigo-500/5 to-card p-8 flex flex-col justify-between backface-hidden"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400">
                  <span className="font-semibold uppercase tracking-wider">Định nghĩa</span>
                  <button
                    onClick={(e) => handleSpeak(currentCard.definition, e)}
                    className="p-2 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 transition"
                    title="Phát âm"
                  >
                    <Volume2 className="size-5" />
                  </button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center text-center px-4 space-y-2">
                  <p className="text-xl sm:text-3xl font-medium tracking-tight text-foreground leading-relaxed">
                    {currentCard.definition}
                  </p>
                  {currentCard.example_sentence && (
                    <p className="text-xs sm:text-sm text-muted-foreground italic max-w-md bg-muted/50 px-3 py-1.5 rounded-xl border border-border/40">
                      VD: {currentCard.example_sentence}
                    </p>
                  )}
                </div>

                <div className="text-center text-xs text-muted-foreground/70 font-medium">
                  Nhấn chuột để lật lại thuật ngữ
                </div>
              </div>
            </div>
          </div>

          {/* Flashcard Controls Bar */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShuffle}
                className={isShuffled ? 'border-indigo-500 text-indigo-600' : ''}
                title="Trộn thẻ ngẫu nhiên"
              >
                <Shuffle className="size-4" />
                <span className="hidden sm:inline">Trộn thẻ</span>
              </Button>
            </div>

            {/* Prev / Counter / Next */}
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="rounded-full size-10"
              >
                <ChevronLeft className="size-5" />
              </Button>

              <span className="text-sm font-bold min-w-[70px] text-center">
                {currentIndex + 1} / {cards.length}
              </span>

              <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                disabled={currentIndex === cards.length - 1}
                className="rounded-full size-10"
              >
                <ChevronRight className="size-5" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFlipped(!isFlipped)}
                title="Lật thẻ"
              >
                <RotateCw className="size-4" />
                <span className="hidden sm:inline">Lật thẻ</span>
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="pt-2">
            <Progress value={progressPercent} indicatorClassName="bg-indigo-600" />
          </div>
        </div>
      ) : (
        <div className="p-8 text-center border-2 border-dashed rounded-xl">
          <p className="text-muted-foreground">Học phần này chưa có thẻ nào.</p>
        </div>
      )}

      {/* Creator Info */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/80">
        <div className="size-10 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold flex items-center justify-center">
          {set.profiles?.username?.[0]?.toUpperCase() || 'U'}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tạo bởi</p>
          <Link href={`/profile/${set.profiles?.username}`} className="font-semibold text-sm hover:underline">
            {set.profiles?.full_name || set.profiles?.username || 'Người dùng'}
          </Link>
        </div>
      </div>

      {/* Full Cards List */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-xl font-bold tracking-tight">
            Thuật ngữ trong học phần này ({cards.length})
          </h2>
        </div>

        <div className="space-y-3">
          {cards.map((card, idx) => (
            <div
              key={card.id}
              className="p-4 sm:p-5 rounded-xl border border-border/80 bg-card/60 hover:border-indigo-500/30 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4 flex-1">
                <span className="text-xs font-bold text-muted-foreground/60 w-5 pt-0.5">
                  {idx + 1}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                  <div>
                    <p className="font-semibold text-foreground">{card.term}</p>
                    {card.phonetic && (
                      <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {card.phonetic}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground">{card.definition}</p>
                    {card.example_sentence && (
                      <p className="text-xs text-muted-foreground/80 italic mt-1">
                        VD: {card.example_sentence}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => handleSpeak(`${card.term}. ${card.definition}`)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                  title="Nghe phát âm"
                >
                  <Volume2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
