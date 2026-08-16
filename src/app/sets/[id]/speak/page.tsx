'use client'

import { useState, useEffect, use, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import {
  scorePronunciation,
  SpeechScoreResult,
  playSuccessChime,
  playRetryBeep,
} from '@/lib/quiz/speech-recognition'
import { speakMultilingualText, isChineseText } from '@/lib/quiz/sentence-templates'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Mic,
  MicOff,
  Volume2,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Trophy,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Play,
  ArrowRight,
  Flame,
  VolumeX,
} from 'lucide-react'

export default function SpeakingModePage({
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

  // Speech Recognition States
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [scoreResult, setScoreResult] = useState<SpeechScoreResult | null>(null)
  const [audioSpeed, setAudioSpeed] = useState<0.75 | 1.0>(1.0)
  const [resultsHistory, setResultsHistory] = useState<Record<string, SpeechScoreResult>>({})
  const [isCompleted, setIsCompleted] = useState(false)

  const recognitionRef = useRef<any>(null)
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
        setCards(cardsData)
      }

      setLoading(false)
    }

    loadData()
  }, [setId])

  // Khởi tạo Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (!SpeechRecognition) {
        setSpeechSupported(false)
        return
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        const confidence = event.results[0][0].confidence || 0.9
        setIsListening(false)

        if (cards.length > 0 && currentIndex < cards.length) {
          const currentCard = cards[currentIndex]
          const result = scorePronunciation(transcript, currentCard.term, confidence)
          setScoreResult(result)
          setResultsHistory((prev) => ({ ...prev, [currentCard.id]: result }))

          if (result.isPassed) {
            playSuccessChime()
            // Tự động chuyển câu sau 2 giây nếu đạt điểm
            setTimeout(() => {
              handleNextCard()
            }, 1800)
          } else {
            playRetryBeep()
          }
        }
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }
  }, [cards, currentIndex])

  const handleSpeakSample = (text: string, speed = audioSpeed) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text.trim())

    if (isChineseText(text)) {
      utterance.lang = 'zh-CN'
      utterance.rate = speed === 1.0 ? 0.85 : 0.6
    } else {
      utterance.lang = 'en-US'
      utterance.rate = speed === 1.0 ? 0.95 : 0.7
    }

    window.speechSynthesis.speak(utterance)
  }

  const handleStartListening = () => {
    if (!recognitionRef.current || !cards[currentIndex]) return

    try {
      window.speechSynthesis.cancel()
      const currentCard = cards[currentIndex]
      const isZh = isChineseText(currentCard.term)

      // Cài đặt ngôn ngữ nhận diện phù hợp
      recognitionRef.current.lang = isZh ? 'zh-CN' : 'en-US'
      setScoreResult(null)
      setIsListening(true)
      recognitionRef.current.start()
    } catch (err) {
      console.warn('Recognition start issue:', err)
      setIsListening(false)
    }
  }

  const handleStopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  const handleNextCard = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setScoreResult(null)
      setIsListening(false)
    } else {
      setIsCompleted(true)
    }
  }

  const handlePrevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
      setScoreResult(null)
      setIsListening(false)
    }
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setScoreResult(null)
    setResultsHistory({})
    setIsCompleted(false)
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="size-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Đang chuẩn bị phòng Luyện nói AI...</p>
      </div>
    )
  }

  if (!set || cards.length === 0) {
    return (
      <div className="container max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <Mic className="size-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold">Học phần này chưa có thẻ nào để luyện nói</h2>
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
  // MÀN HÌNH HOÀN THÀNH (SPEAKING SUMMARY)
  // =========================================================================
  if (isCompleted) {
    const totalAttempted = Object.keys(resultsHistory).length
    const passedCount = Object.values(resultsHistory).filter((r) => r.isPassed).length
    const averageScore = totalAttempted > 0
      ? Math.round(
          Object.values(resultsHistory).reduce((acc, curr) => acc + curr.score, 0) / totalAttempted
        )
      : 0

    return (
      <div className="container max-w-2xl mx-auto py-10 px-4 space-y-6 animate-in fade-in duration-300">
        <Card className="border-border shadow-2xl p-6 sm:p-8 text-center space-y-6 bg-gradient-to-b from-card to-muted/30">
          <div className="inline-flex size-20 rounded-full items-center justify-center mx-auto bg-indigo-500/10 text-indigo-600 ring-8 ring-indigo-500/20 shadow-inner">
            <Trophy className="size-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Hoàn thành bài Luyện nói!
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Điểm phát âm trung bình:{' '}
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {averageScore}%
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Bạn đã phát âm chuẩn <span className="font-bold text-foreground">{passedCount}</span> /{' '}
              <span className="font-bold text-foreground">{cards.length} từ</span> trong học phần.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button
              size="lg"
              onClick={handleRestart}
              className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold shadow-lg shadow-indigo-500/25"
            >
              <RotateCcw className="size-4" /> Luyện nói lại từ đầu
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
  // MÀN HÌNH LUYỆN NÓI CHÍNH (ACTIVE SPEAKING ARENA)
  // =========================================================================
  const currentCard = cards[currentIndex]
  const isZh = isChineseText(currentCard.term)
  const progressPercent = Math.round(((currentIndex + 1) / cards.length) * 100)

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4 space-y-6">
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
            Luyện nói AI
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

      {!speechSupported && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs text-center space-y-1">
          <p className="font-bold">⚠️ Trình duyệt của bạn chưa bật quyền Micro hoặc không hỗ trợ Web Speech Recognition.</p>
          <p>Hãy sử dụng trình duyệt <strong>Google Chrome, Microsoft Edge, Safari</strong> trên máy tính hoặc điện thoại để có trải nghiệm tốt nhất!</p>
        </div>
      )}

      {/* Main Speaking Stage Card */}
      <Card className="border-border/80 shadow-2xl overflow-hidden bg-card/90 backdrop-blur-md">
        <CardContent className="p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-8 min-h-[420px]">
          
          {/* Target Word & Phonetic */}
          <div className="space-y-3 max-w-xl">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {isZh ? 'Phát âm chữ Hán / Tiếng Trung:' : 'Phát âm từ vựng tiếng Anh:'}
            </span>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-foreground">
              {currentCard.term}
            </h1>

            {currentCard.phonetic && (
              <div className="inline-block">
                <span className="text-base sm:text-lg font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-4 py-1 rounded-full border border-indigo-500/20">
                  {currentCard.phonetic}
                </span>
              </div>
            )}

            <p className="text-lg sm:text-xl font-medium text-muted-foreground pt-1">
              {currentCard.definition}
            </p>

            {currentCard.example_sentence && (
              <p className="text-xs sm:text-sm text-muted-foreground/80 italic pt-1 bg-muted/40 p-2.5 rounded-xl border border-border/40">
                VD: {currentCard.example_sentence}
              </p>
            )}
          </div>

          {/* Reference Audio Controls */}
          <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-2xl border border-border/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleSpeakSample(currentCard.term, 1.0)}
              className="gap-1.5 text-xs font-semibold rounded-xl hover:bg-background"
            >
              <Volume2 className="size-4 text-indigo-600" /> Nghe chuẩn (1.0x)
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleSpeakSample(currentCard.term, 0.75)}
              className="gap-1.5 text-xs font-semibold rounded-xl hover:bg-background text-muted-foreground"
            >
              <Play className="size-3.5" /> Nghe chậm (0.75x)
            </Button>
          </div>

          {/* Big Animated Mic Button Stage */}
          <div className="relative flex flex-col items-center justify-center pt-2">
            {/* Animated Pulsing Rings when listening */}
            {isListening && (
              <>
                <div className="absolute size-36 rounded-full bg-rose-500/20 animate-ping" />
                <div className="absolute size-28 rounded-full bg-rose-500/30 animate-pulse" />
              </>
            )}

            <button
              type="button"
              onClick={isListening ? handleStopListening : handleStartListening}
              className={`relative size-24 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 select-none ${
                isListening
                  ? 'bg-rose-600 text-white scale-110 ring-8 ring-rose-500/30 shadow-rose-500/50'
                  : 'bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 text-white hover:scale-105 ring-8 ring-indigo-500/20 shadow-indigo-500/40'
              }`}
            >
              {isListening ? (
                <Mic className="size-10 animate-bounce" />
              ) : (
                <Mic className="size-10" />
              )}
            </button>

            <span className="text-xs font-bold mt-4 text-muted-foreground">
              {isListening ? (
                <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5 animate-pulse font-semibold">
                  <span className="size-2 rounded-full bg-rose-600 animate-ping" />
                  Đang lắng nghe... Hãy nói to rõ ràng!
                </span>
              ) : (
                'Nhấn vào Micro để bắt đầu nói'
              )}
            </span>
          </div>

          {/* Pronunciation Feedback Result */}
          {scoreResult && (
            <div
              className={`w-full max-w-lg p-5 rounded-2xl border text-left space-y-3 transition-all duration-300 animate-in fade-in zoom-in-95 ${
                scoreResult.isPassed
                  ? 'bg-emerald-500/10 border-emerald-500/40'
                  : 'bg-amber-500/10 border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {scoreResult.isPassed ? (
                    <CheckCircle2 className="size-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="size-6 text-amber-500 shrink-0" />
                  )}
                  <span className="font-bold text-sm text-foreground">
                    {scoreResult.feedbackMessage}
                  </span>
                </div>

                <Badge
                  className={`text-sm font-black px-2.5 py-0.5 ${
                    scoreResult.isPassed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  {scoreResult.score}%
                </Badge>
              </div>

              {/* Spoken Word Breakdown */}
              <div className="p-3 bg-background/80 rounded-xl border border-border/60 text-sm">
                <span className="text-xs text-muted-foreground block mb-1 font-medium">
                  Máy nghe được bạn nói:
                </span>
                <p className="font-bold text-base text-foreground">
                  &ldquo;{scoreResult.transcript || '(Không nghe rõ âm thanh)'}&rdquo;
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleStartListening}
                  className="gap-1 text-xs"
                >
                  <RotateCcw className="size-3.5" /> Nói lại
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleNextCard}
                  className="gap-1 text-xs bg-indigo-600 text-white hover:bg-indigo-700 font-semibold"
                >
                  {currentIndex < cards.length - 1 ? 'Từ tiếp theo' : 'Xem kết quả'} <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
