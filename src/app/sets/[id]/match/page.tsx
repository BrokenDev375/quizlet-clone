'use client'

import { useState, useEffect, use, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import { speakMultilingualText } from '@/lib/quiz/sentence-templates'
import { playSuccessChime, playRetryBeep } from '@/lib/quiz/speech-recognition'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Gamepad2, 
  ArrowLeft, 
  RotateCcw, 
  Trophy, 
  Timer, 
  Sparkles,
  Zap,
  Volume2,
  VolumeX
} from 'lucide-react'

interface MatchItem {
  id: string
  cardId: string
  text: string
  phonetic?: string
  type: 'term' | 'definition'
  isMatched: boolean
}

export default function MatchGamePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const setId = resolvedParams.id

  const [set, setSet] = useState<FlashcardSet | null>(null)
  const [allCards, setAllCards] = useState<(CardType & { phonetic?: string })[]>([])
  const [items, setItems] = useState<MatchItem[]>([])
  const [selectedItem, setSelectedItem] = useState<MatchItem | null>(null)
  const [isWrong, setIsWrong] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameWon, setGameWon] = useState(false)
  const [loading, setLoading] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: setData } = await supabase
        .from('sets')
        .select('*')
        .eq('id', setId)
        .single()

      if (!setData) {
        setLoading(false)
        return
      }
      setSet(setData)

      const { data: cardsData } = await supabase
        .from('cards')
        .select('*')
        .eq('set_id', setId)
        .order('position', { ascending: true })

      if (cardsData && cardsData.length > 0) {
        setAllCards(cardsData)
        setupGame(cardsData)
      }

      setLoading(false)
    }

    loadData()
  }, [setId])

  // Timer runner
  useEffect(() => {
    if (gameStarted && !gameWon) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => +(prev + 0.1).toFixed(1))
      }, 100)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameStarted, gameWon])

  const setupGame = (cards: (CardType & { phonetic?: string })[]) => {
    // Lấy ngẫu nhiên tối đa 6 cặp thẻ để tạo bảng 12 ô cân đối
    const sample = [...cards].sort(() => Math.random() - 0.5).slice(0, 6)

    const list: MatchItem[] = []
    sample.forEach((c) => {
      list.push({
        id: `${c.id}_term`,
        cardId: c.id,
        text: c.term,
        phonetic: c.phonetic,
        type: 'term',
        isMatched: false,
      })
      list.push({
        id: `${c.id}_def`,
        cardId: c.id,
        text: c.definition,
        type: 'definition',
        isMatched: false,
      })
    })

    // Shuffle toàn bộ các ô
    setItems(list.sort(() => Math.random() - 0.5))
    setSelectedItem(null)
    setIsWrong(null)
    setSeconds(0)
    setGameStarted(true)
    setGameWon(false)
  }

  const handleTileClick = (item: MatchItem) => {
    if (item.isMatched || isWrong) return

    // Phát âm ngay từ vừa bấm nếu bật âm thanh
    if (soundEnabled) {
      speakMultilingualText(item.text)
    }

    // Nếu là ô đầu tiên được chọn
    if (!selectedItem) {
      setSelectedItem(item)
      return
    }

    // Nếu bấm lại chính ô đó -> Bỏ chọn
    if (selectedItem.id === item.id) {
      setSelectedItem(null)
      return
    }

    // Kiểm tra ghép đúng cặp (cùng cardId nhưng khác loại term/definition)
    if (selectedItem.cardId === item.cardId && selectedItem.type !== item.type) {
      // GHÉP ĐÚNG!
      if (soundEnabled) {
        playSuccessChime()
        // Phát âm từ chính của cặp thẻ
        const termItem = selectedItem.type === 'term' ? selectedItem : item
        setTimeout(() => {
          speakMultilingualText(termItem.text)
        }, 200)
      }

      const updated = items.map((i) =>
        i.cardId === item.cardId ? { ...i, isMatched: true } : i
      )
      setItems(updated)
      setSelectedItem(null)

      // Kiểm tra hoàn thành tất cả
      const allMatched = updated.every((i) => i.isMatched)
      if (allMatched) {
        setGameWon(true)
      }
    } else {
      // GHÉP SAI
      if (soundEnabled) {
        playRetryBeep()
      }
      setIsWrong(item.id)
      setTimeout(() => {
        setSelectedItem(null)
        setIsWrong(null)
      }, 600)
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="inline-block size-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Đang chuẩn bị trò chơi ghép thẻ...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Header & Live Timer */}
      <div className="flex items-center justify-between">
        <Link
          href={`/sets/${setId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="size-4" />
          Quay lại học phần
        </Link>

        <div className="flex items-center gap-3">
          {/* Nút Bật/Tắt âm thanh phát âm */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl border border-border/80 bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground transition flex items-center gap-1.5 text-xs font-semibold"
            title={soundEnabled ? 'Đang bật âm thanh' : 'Đang tắt âm thanh'}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="size-4 text-amber-500" />
                <span className="hidden sm:inline">Phát âm: Bật</span>
              </>
            ) : (
              <>
                <VolumeX className="size-4 text-muted-foreground" />
                <span className="hidden sm:inline">Phát âm: Tắt</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-mono font-bold text-sm">
            <Timer className="size-4" />
            <span>{seconds.toFixed(1)}s</span>
          </div>
        </div>
      </div>

      {/* Win Celebration */}
      {gameWon ? (
        <Card className="border-amber-500/40 bg-gradient-to-br from-card to-amber-500/10 p-8 sm:p-12 text-center shadow-xl">
          <CardContent className="space-y-6">
            <div className="inline-flex size-20 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 items-center justify-center text-white shadow-lg shadow-amber-500/30 mx-auto">
              <Trophy className="size-10" />
            </div>

            <div>
              <h2 className="text-3xl font-black tracking-tight">Kỷ lục mới!</h2>
              <p className="text-muted-foreground mt-1 text-sm">Bạn đã xóa sạch tất cả các ô trong</p>
              <p className="text-5xl font-black text-amber-500 mt-2 font-mono">{seconds.toFixed(1)}s</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Button
                onClick={() => setupGame(allCards)}
                className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 gap-2"
              >
                <RotateCcw className="size-4" />
                Chơi lại lần nữa
              </Button>

              <Link href={`/sets/${setId}`}>
                <Button variant="outline">
                  Trở về học phần
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Game Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 pt-4">
          {items.map((item) => {
            const isSelected = selectedItem?.id === item.id
            const isWrongMatch = isWrong === item.id || (selectedItem && selectedItem.id === item.id && isWrong !== null)

            if (item.isMatched) {
              return (
                <div
                  key={item.id}
                  className="h-28 rounded-xl border border-transparent opacity-0 pointer-events-none transition-opacity duration-300"
                />
              )
            }

            let tileStyle = "border-border/80 bg-card hover:border-amber-500/50 hover:bg-amber-500/5 text-foreground"
            if (isSelected && !isWrongMatch) {
              tileStyle = "border-indigo-600 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/30 scale-[1.02]"
            } else if (isWrongMatch) {
              tileStyle = "border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300 animate-shake"
            }

            return (
              <button
                key={item.id}
                onClick={() => handleTileClick(item)}
                className={`h-28 p-3.5 rounded-xl border text-sm font-semibold text-center flex flex-col items-center justify-center shadow-xs transition-all duration-200 cursor-pointer select-none leading-snug overflow-hidden text-ellipsis gap-1 ${tileStyle}`}
              >
                <span>{item.text}</span>
                {item.phonetic && (
                  <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-normal">
                    {item.phonetic}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
