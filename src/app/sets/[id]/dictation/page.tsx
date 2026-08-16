'use client'

import { useState, useEffect, use, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import { unpackCardContent } from '@/lib/quiz/card-serialization'
import { checkWrittenAnswer, normalizeAnswer } from '@/lib/quiz/question-generator'
import { isChineseText, speakMultilingualText } from '@/lib/quiz/sentence-templates'
import { playSuccessChime, playRetryBeep } from '@/lib/quiz/speech-recognition'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Headphones,
  Volume2,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Trophy,
  CheckCircle2,
  XCircle,
  Play,
  ArrowRight,
  Eye,
  EyeOff,
  HelpCircle,
  Flame,
} from 'lucide-react'

export default function DictationModePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const setId = resolvedParams.id

  const [set, setSet] = useState<FlashcardSet | null>(null)
  const [cards, setCards] = useState<(CardType & { phonetic?: string; example_sentence?: string })[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  // Dictation States
  const [userInput, setUserInput] = useState('')
  const [isAnswered, setIsAnswered] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [audioSpeed, setAudioSpeed] = useState<0.75 | 1.0>(1.0)
  const [resultsHistory, setResultsHistory] = useState<Record<string, boolean>>({})
  const [isCompleted, setIsCompleted] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

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
        setCards(cardsData.map(unpackCardContent))
      }

      setLoading(false)
    }

    loadData()
  }, [setId])

  // Tự động phát âm thanh khi chuyển sang từ mới và focus ô input
  useEffect(() => {
    if (cards.length > 0 && currentIndex < cards.length && !isCompleted) {
      setUserInput('')
      setIsAnswered(false)
      setShowHint(false)

      const currentCard = cards[currentIndex]
      // Phát âm tự động sau 300ms
      const timer = setTimeout(() => {
        handlePlayAudio(currentCard.term)
        inputRef.current?.focus()
      }, 300)

      return () => clearTimeout(timer)
    }
  }, [currentIndex, cards, isCompleted])

  const handlePlayAudio = (text: string) => {
    speakMultilingualText(text)
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isAnswered || !userInput.trim() || !cards[currentIndex]) return

    const currentCard = cards[currentIndex]
    const correct = checkWrittenAnswer(userInput.trim(), currentCard.term)

    setIsCorrect(correct)
    setIsAnswered(true)
    setResultsHistory((prev) => ({ ...prev, [currentCard.id]: correct }))

    if (correct) {
      playSuccessChime()
      speakMultilingualText(currentCard.term)
      setTimeout(() => {
        handleNextCard()
      }, 1800)
    } else {
      playRetryBeep()
      setTimeout(() => {
        speakMultilingualText(currentCard.term)
      }, 200)
    }
  }

  const handleNextCard = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      setIsCompleted(true)
    }
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setUserInput('')
    setIsAnswered(false)
    setResultsHistory({})
    setIsCompleted(false)
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="size-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Đang chuẩn bị phòng Nghe Chép...</p>
      </div>
    )
  }

  if (!set || cards.length === 0) {
    return (
      <div className="container max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <Headphones className="size-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold">Học phần này chưa có thẻ nào để luyện nghe chép</h2>
        <Link
          href={`/sets/${setId}`}
          className={buttonVariants({ variant: 'default' })}
        >
          Quay lại học phần
        </Link>
      </div>
    )
  }

  // =========================================================================
  // MÀN HÌNH HOÀN THÀNH (DICTATION SUMMARY)
  // =========================================================================
  if (isCompleted) {
    const totalCount = cards.length
    const correctCount = Object.values(resultsHistory).filter(Boolean).length
    const accuracyPercent = Math.round((correctCount / totalCount) * 100)

    return (
      <div className="container max-w-2xl mx-auto py-10 px-4 space-y-6 animate-in fade-in duration-300">
        <Card className="border-border shadow-2xl p-6 sm:p-8 text-center space-y-6 bg-gradient-to-b from-card to-muted/30">
          <div className="inline-flex size-20 rounded-full items-center justify-center mx-auto bg-indigo-500/10 text-indigo-600 ring-8 ring-indigo-500/20 shadow-inner">
            <Trophy className="size-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Hoàn thành Nghe Chép chính tả!
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Độ chính xác chính tả:{' '}
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {accuracyPercent}%
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Bạn đã viết đúng <span className="font-bold text-foreground">{correctCount}</span> /{' '}
              <span className="font-bold text-foreground">{totalCount} từ</span> nghe được.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button
              size="lg"
              onClick={handleRestart}
              className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold shadow-lg shadow-indigo-500/25"
            >
              <RotateCcw className="size-4" /> Luyện nghe chép lại
            </Button>
            <Link
              href={`/sets/${setId}`}
              className={buttonVariants({ size: 'lg', variant: 'outline' })}
            >
              Quay lại học phần
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  // =========================================================================
  // MÀN HÌNH LUYỆN NGHE CHÉP CHÍNH (ACTIVE DICTATION ARENA)
  // =========================================================================
  const currentCard = cards[currentIndex]
  const isZh = isChineseText(currentCard.term)
  const progressPercent = Math.round(((currentIndex + 1) / cards.length) * 100)

  return (
    <div className="container max-w-2xl mx-auto py-6 px-4 space-y-6">
      {/* Top Navigation & Progress */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/sets/${setId}`}
          className={buttonVariants({
            variant: 'ghost',
            size: 'sm',
            className: 'text-muted-foreground hover:text-foreground gap-1.5',
          })}
        >
          <ArrowLeft className="size-4" /> Quay lại
        </Link>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
            {currentIndex + 1} / {cards.length}
          </Badge>
          <span className="text-xs font-bold text-muted-foreground hidden sm:inline">
            Nghe Chép chính tả
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleNextCard}
          className="text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          Bỏ qua <ArrowRight className="size-3.5" />
        </Button>
      </div>

      <Progress value={progressPercent} className="h-2" />

      {/* Main Dictation Card */}
      <Card className="border-border/80 shadow-2xl overflow-hidden bg-card/90 backdrop-blur-md">
        <CardContent className="p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-8 min-h-[400px]">
          
          {/* Big Interactive Speaker Button */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => handlePlayAudio(currentCard.term)}
              className="group relative size-28 sm:size-32 rounded-full bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-2xl shadow-indigo-500/40 hover:scale-105 transition-all duration-300 ring-8 ring-indigo-500/20"
              title="Bấm để nghe lại phát âm"
            >
              <Volume2 className="size-12 sm:size-14 group-hover:scale-110 transition-transform" />
            </button>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handlePlayAudio(currentCard.term)}
                className="gap-1.5 text-xs font-semibold rounded-xl hover:bg-muted"
              >
                <Volume2 className="size-3.5 text-indigo-600" /> Nghe lại từ vựng
              </Button>

              {currentCard.example_sentence && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePlayAudio(currentCard.example_sentence!.replace(/\[|\]/g, ''))}
                  className="gap-1.5 text-xs font-semibold rounded-xl hover:bg-muted text-purple-600 dark:text-purple-400"
                >
                  <Sparkles className="size-3.5 text-purple-600" /> Nghe cả câu ví dụ
                </Button>
              )}
            </div>
          </div>

          {/* Hint Toggle */}
          <div className="space-y-2 max-w-md w-full">
            <button
              type="button"
              onClick={() => setShowHint(!showHint)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center justify-center gap-1 mx-auto font-medium"
            >
              {showHint ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showHint ? 'Ẩn gợi ý nghĩa' : 'Xem gợi ý nghĩa tiếng Việt'}
            </button>

            {showHint && (
              <div className="p-3 rounded-xl bg-muted/60 border border-border text-sm text-foreground animate-in fade-in">
                <span className="font-semibold text-muted-foreground block text-xs mb-0.5">Nghĩa:</span>
                {currentCard.definition}
              </div>
            )}
          </div>

          {/* Typing Form */}
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                placeholder={isZh ? 'Gõ chữ Hán hoặc Pinyin nghe được...' : 'Gõ chính xác từ bạn nghe được...'}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={isAnswered && isCorrect}
                className="h-14 text-center text-lg sm:text-xl font-bold rounded-2xl border-2 focus-visible:ring-indigo-500 shadow-inner bg-background"
                autoComplete="off"
              />
            </div>

            {!isAnswered ? (
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={!userInput.trim()}
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/25 rounded-xl"
                >
                  Kiểm tra đáp án
                </Button>
              </div>
            ) : null}
          </form>

          {/* Result Feedback */}
          {isAnswered && (
            <div
              className={`w-full max-w-md p-4 rounded-2xl border text-left space-y-2 animate-in fade-in zoom-in-95 ${
                isCorrect
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-destructive/10 border-destructive/40 text-destructive'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm flex items-center gap-1.5">
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                      Chính xác 100%!
                    </>
                  ) : (
                    <>
                      <XCircle className="size-5 text-destructive" />
                      Chưa chính xác!
                    </>
                  )}
                </span>

                {!isCorrect && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsAnswered(false)
                      setUserInput('')
                      inputRef.current?.focus()
                    }}
                    className="h-7 text-xs gap-1"
                  >
                    <RotateCcw className="size-3" /> Gõ lại
                  </Button>
                )}
              </div>

              {!isCorrect && (
                <div className="pt-2 border-t border-border/40 text-xs space-y-1 text-foreground">
                  <div>
                    <span className="text-muted-foreground">Đáp án đúng:</span>{' '}
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                      {currentCard.term}
                    </span>
                    {currentCard.phonetic && (
                      <span className="font-mono text-muted-foreground ml-2">
                        ({currentCard.phonetic})
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nghĩa:</span>{' '}
                    <span className="font-medium">{currentCard.definition}</span>
                  </div>
                </div>
              )}
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
