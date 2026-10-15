'use client'

import { useState, useEffect, use, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import { fetchAllCards } from '@/lib/quiz/cards-service'
import { speakMultilingualText } from '@/lib/quiz/sentence-templates'
import { playSuccessChime, playRetryBeep } from '@/lib/quiz/speech-recognition'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, ArrowRight, RotateCcw, Trophy, Timer, Volume2, VolumeX } from 'lucide-react'

const PAIRS_PER_STAGE = 6

interface MatchItem {
  id: string
  cardId: string
  text: string
  phonetic?: string | null
  type: 'term' | 'definition'
  isMatched: boolean
}

function shuffle<T>(values: T[]): T[] {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function createStageItems(cards: CardType[], stageIndex: number): MatchItem[] {
  const start = stageIndex * PAIRS_PER_STAGE
  const stageCards = cards.slice(start, start + PAIRS_PER_STAGE)
  const items: MatchItem[] = stageCards.flatMap((card) => [
    {
      id: `${card.id}_term`,
      cardId: card.id,
      text: card.term,
      phonetic: card.phonetic,
      type: 'term',
      isMatched: false,
    },
    {
      id: `${card.id}_def`,
      cardId: card.id,
      text: card.definition,
      type: 'definition',
      isMatched: false,
    },
  ])
  return shuffle(items)
}

export default function MatchGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <MatchGame key={id} setId={id} />
}

function MatchGame({ setId }: { setId: string }) {
  const [set, setSet] = useState<FlashcardSet | null>(null)
  const [sessionCards, setSessionCards] = useState<CardType[]>([])
  const [stageIndex, setStageIndex] = useState(0)
  const [items, setItems] = useState<MatchItem[]>([])
  const [selectedItem, setSelectedItem] = useState<MatchItem | null>(null)
  const [isWrong, setIsWrong] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [gameStarted, setGameStarted] = useState(false)
  const [stageComplete, setStageComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [supabase] = useState(createClient)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wrongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const totalStages = Math.ceil(sessionCards.length / PAIRS_PER_STAGE)
  const gameWon = stageComplete && stageIndex === totalStages - 1
  const completedCards = stageIndex * PAIRS_PER_STAGE
    + items.filter((item) => item.type === 'term' && item.isMatched).length

  const setupGame = useCallback((cards: CardType[]) => {
    // Xáo trộn danh sách một lần cho cả lượt, sau đó chia thành các chặng không trùng thẻ.
    const shuffledCards = shuffle(cards)
    setSessionCards(shuffledCards)
    setStageIndex(0)
    setItems(createStageItems(shuffledCards, 0))
    setSelectedItem(null)
    setIsWrong(null)
    setSeconds(0)
    setGameStarted(shuffledCards.length > 0)
    setStageComplete(false)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const { data: setData, error } = await supabase
          .from('sets')
          .select('*')
          .eq('id', setId)
          .single()

        if (cancelled) return
        if (error || !setData) {
          setLoadError('Không thể tải học phần này.')
          return
        }
        setSet(setData)

        const cardsData = await fetchAllCards(supabase, setId)
        if (!cancelled) setupGame(cardsData)
      } catch (err) {
        console.error('Lỗi nạp thẻ trò chơi ghép thẻ:', err)
        if (!cancelled) setLoadError('Không thể tải thẻ. Vui lòng thử lại sau.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [setId, supabase, setupGame])

  // Cộng dồn thời gian chơi, tạm dừng ở màn hình hoàn thành mỗi chặng.
  useEffect(() => {
    if (gameStarted && !stageComplete) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => +(prev + 0.1).toFixed(1))
      }, 100)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameStarted, stageComplete])

  useEffect(() => () => {
    if (wrongTimeoutRef.current) clearTimeout(wrongTimeoutRef.current)
  }, [])

  const startNextStage = () => {
    if (!stageComplete || gameWon) return
    const nextIndex = stageIndex + 1
    setStageIndex(nextIndex)
    setItems(createStageItems(sessionCards, nextIndex))
    setSelectedItem(null)
    setIsWrong(null)
    setStageComplete(false)
  }

  const handleTileClick = (item: MatchItem) => {
    if (!gameStarted || stageComplete || item.isMatched || isWrong) return

    if (!selectedItem) {
      setSelectedItem(item)
      return
    }

    if (selectedItem.id === item.id) {
      setSelectedItem(null)
      return
    }

    if (selectedItem.cardId === item.cardId && selectedItem.type !== item.type) {
      if (soundEnabled) {
        playSuccessChime()
        const termItem = selectedItem.type === 'term' ? selectedItem : item
        speakMultilingualText(termItem.text)
      }

      const updated = items.map((i) =>
        i.cardId === item.cardId ? { ...i, isMatched: true } : i
      )
      setItems(updated)
      setSelectedItem(null)

      if (updated.every((i) => i.isMatched)) {
        setStageComplete(true)
      }
    } else {
      if (soundEnabled) playRetryBeep()
      setIsWrong(item.id)
      wrongTimeoutRef.current = setTimeout(() => {
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

  if (loadError || sessionCards.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-muted-foreground">{loadError || 'Học phần chưa có thẻ để chơi.'}</p>
        <Link href={`/sets/${setId}`} className="text-sm font-semibold text-amber-600 hover:underline">
          Quay lại học phần
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/sets/${setId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="size-4" />
          Quay lại học phần
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl border border-border/80 bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground transition flex items-center gap-1.5 text-xs font-semibold"
            title={soundEnabled ? 'Đang bật âm thanh' : 'Đang tắt âm thanh'}
            aria-label={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            aria-pressed={soundEnabled}
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

          <div title="Tổng thời gian chơi, không tính lúc nghỉ giữa các chặng" className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-mono font-bold text-sm">
            <Timer className="size-4" />
            <span>{seconds.toFixed(1)}s</span>
          </div>
        </div>
      </div>

      <section aria-label="Tiến độ ghép thẻ" className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold">Ghép thẻ</h1>
          <p className="text-sm text-muted-foreground mt-1">{set?.title}</p>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="font-semibold text-amber-600 dark:text-amber-400">Chặng {stageIndex + 1} / {totalStages}</p>
          <p className="text-muted-foreground">Đã ghép {completedCards} / {sessionCards.length} từ</p>
        </div>
        <div
          role="progressbar"
          aria-label="Số từ đã ghép"
          aria-valuemin={0}
          aria-valuemax={sessionCards.length}
          aria-valuenow={completedCards}
          className="h-2 rounded-full bg-amber-500/10 overflow-hidden"
        >
          <div className="h-full rounded-full bg-amber-500 transition-all duration-300" style={{ width: `${completedCards / sessionCards.length * 100}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">Ghép hết các cặp để sang chặng tiếp theo. Mỗi thẻ xuất hiện một lần trong lượt chơi.</p>
      </section>

      {stageComplete ? (
        <Card className="border-amber-500/40 bg-gradient-to-br from-card to-amber-500/10 p-8 sm:p-12 text-center shadow-xl">
          <CardContent className="space-y-6">
            <div className="inline-flex size-20 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 items-center justify-center text-white shadow-lg shadow-amber-500/30 mx-auto">
              <Trophy className="size-10" />
            </div>

            <div>
              <h2 className="text-3xl font-black tracking-tight">
                {gameWon ? 'Hoàn thành học phần!' : `Hoàn thành chặng ${stageIndex + 1}!`}
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                {gameWon
                  ? `Bạn đã ghép đủ ${sessionCards.length} từ qua ${totalStages} chặng.`
                  : `Bạn đã ghép ${completedCards} / ${sessionCards.length} từ. Sẵn sàng cho chặng tiếp theo!`}
              </p>
              <p className="text-muted-foreground mt-4 text-sm">Tổng thời gian chơi</p>
              <p className="text-5xl font-black text-amber-500 mt-2 font-mono">{seconds.toFixed(1)}s</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Button
                onClick={gameWon ? () => setupGame(sessionCards) : startNextStage}
                className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 gap-2"
              >
                {gameWon ? <RotateCcw className="size-4" /> : <ArrowRight className="size-4" />}
                {gameWon ? 'Chơi lại từ đầu' : 'Chặng tiếp theo'}
              </Button>

              <Link href={`/sets/${setId}`}>
                <Button variant="outline">Trở về học phần</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
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

            let tileStyle = 'border-border/80 bg-card hover:border-amber-500/50 hover:bg-amber-500/5 text-foreground'
            if (isSelected && !isWrongMatch) {
              tileStyle = 'border-indigo-600 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/30 scale-[1.02]'
            } else if (isWrongMatch) {
              tileStyle = 'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300 animate-shake'
            }

            return (
              <button
                key={item.id}
                onClick={() => handleTileClick(item)}
                aria-pressed={isSelected}
                disabled={isWrong !== null}
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
