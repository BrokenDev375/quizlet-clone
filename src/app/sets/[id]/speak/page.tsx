'use client'

import { useState, useEffect, use, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import { unpackCardContent } from '@/lib/quiz/card-serialization'
import { getStudySession, saveStudySession } from '@/lib/quiz/study-session'
import {
  scorePronunciation,
  scoreMultipleTranscripts,
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
  Play,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Trophy,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MessageSquare,
  BookOpen,
} from 'lucide-react'

export default function SpeakPracticePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const setId = resolvedParams.id

  const [set, setSet] = useState<FlashcardSet | null>(null)
  const [cards, setCards] = useState<(CardType & { phonetic?: string; example_sentence?: string })[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [targetMode, setTargetMode] = useState<'term' | 'sentence'>('term')
  const [loading, setLoading] = useState(true)
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
        const unpacked = cardsData.map(unpackCardContent)
        setCards(unpacked)

        // Phục hồi tiến độ
        try {
          const session = await getStudySession(setId)
          if (session && session.last_mode === 'speak' && session.last_card_index > 0) {
            setCurrentIndex(Math.min(session.last_card_index, unpacked.length - 1))
          }
        } catch (e) {}
      }

      setLoading(false)
    }

    loadData()
  }, [setId])

  const currentCard = cards[currentIndex]
  const isCardZh = currentCard ? isChineseText(currentCard.term) : false
  const fallbackSentence = isCardZh
    ? `我 每天 都 在 练习 ${currentCard?.term || ''}`
    : `She is actively practicing ${currentCard?.term || ''} in class.`

  const rawSentence =
    currentCard?.example_sentence && currentCard.example_sentence.trim()
      ? currentCard.example_sentence.replace(/\[|\]/g, '').trim()
      : fallbackSentence

  const activeTarget = targetMode === 'sentence' ? rawSentence : currentCard?.term || ''

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
      recognition.maxAlternatives = 5

      recognition.onresult = (event: any) => {
        setIsListening(false)

        if (cards.length > 0 && currentIndex < cards.length) {
          const card = cards[currentIndex]
          const isZh = isChineseText(card.term)
          const fallback = isZh
            ? `我 每天 都 在 练习 ${card.term}`
            : `She is actively practicing ${card.term} in class.`

          const target =
            targetMode === 'sentence'
              ? card.example_sentence && card.example_sentence.trim()
                ? card.example_sentence.replace(/\[|\]/g, '').trim()
                : fallback
              : card.term

          // Lấy toàn bộ danh sách các ứng viên âm thanh (Top 5 Alternatives) mà máy thu được
          const candidates: { transcript: string; confidence: number }[] = []
          const resultsList = event.results[0]

          if (resultsList) {
            for (let i = 0; i < resultsList.length; i++) {
              if (resultsList[i]?.transcript) {
                candidates.push({
                  transcript: resultsList[i].transcript,
                  confidence: resultsList[i].confidence || 0.9,
                })
              }
            }
          }

          const result = scoreMultipleTranscripts(candidates, target)
          setScoreResult(result)
          setResultsHistory((prev) => ({ ...prev, [`${card.id}_${targetMode}`]: result }))

          if (result.isPassed) {
            playSuccessChime()
            setTimeout(() => {
              handleNextCard()
            }, 2000)
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
  }, [cards, currentIndex, targetMode])

  const handleSpeakSample = (text: string, speed = audioSpeed) => {
    if (!text) return
    speakMultilingualText(text)
  }

  const handleStartListening = () => {
    if (!recognitionRef.current || !cards[currentIndex]) return

    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      const isZh = isChineseText(activeTarget)

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
      const nextIdx = currentIndex + 1
      setCurrentIndex(nextIdx)
      setScoreResult(null)
      setIsListening(false)
      saveStudySession({ setId, mode: 'speak', cardIndex: nextIdx })
    } else {
      setIsCompleted(true)
    }
  }

  const handlePrevCard = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1
      setCurrentIndex(prevIdx)
      setScoreResult(null)
      setIsListening(false)
      saveStudySession({ setId, mode: 'speak', cardIndex: prevIdx })
    }
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setScoreResult(null)
    setResultsHistory({})
    setIsCompleted(false)
    saveStudySession({ setId, mode: 'speak', cardIndex: 0 })
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
    const passedCount = Object.values(resultsHistory).filter((r) => r.isPassed).length
    const totalAttempted = Object.keys(resultsHistory).length
    const avgScore =
      totalAttempted > 0
        ? Math.round(
            Object.values(resultsHistory).reduce((acc, cur) => acc + cur.score, 0) /
              totalAttempted
          )
        : 0

    return (
      <div className="container max-w-2xl mx-auto py-12 px-4">
        <Card className="border-border/80 shadow-2xl p-6 sm:p-10 text-center space-y-8 bg-gradient-to-b from-card to-background">
          <div className="inline-flex size-20 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 items-center justify-center text-white shadow-xl shadow-indigo-500/25 mx-auto animate-bounce">
            <Trophy className="size-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight">Hoàn thành bài Luyện nói!</h1>
            <p className="text-muted-foreground text-sm">
              Bạn đã hoàn thành lượt luyện phát âm cho học phần <strong>{set.title}</strong>
            </p>
          </div>

          {/* Stats Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
              <span className="text-xs font-semibold text-muted-foreground">Điểm trung bình</span>
              <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {avgScore}%
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-xs font-semibold text-muted-foreground">Phát âm đạt</span>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {passedCount} / {cards.length}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 col-span-2 sm:col-span-1">
              <span className="text-xs font-semibold text-muted-foreground">Đánh giá</span>
              <p className="text-base font-bold text-purple-600 dark:text-purple-400 mt-2">
                {avgScore >= 80 ? '🎉 Xuất sắc' : avgScore >= 60 ? '👍 Khá tốt' : '💪 Cần rèn thêm'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Button
              onClick={handleRestart}
              className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold gap-2"
              size="lg"
            >
              <RotateCcw className="size-4" /> Luyện lại lần nữa
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
  const isZh = isChineseText(activeTarget)
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

      {/* Target Mode Selector: Luôn luôn hiển thị để người học có thể chuyển đổi bất cứ lúc nào */}
      <div className="flex items-center justify-center gap-2 bg-muted/60 p-1.5 rounded-2xl border border-border/60 max-w-md mx-auto">
        <button
          type="button"
          onClick={() => {
            setTargetMode('term')
            setScoreResult(null)
          }}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            targetMode === 'term'
              ? 'bg-card text-indigo-600 dark:text-indigo-400 shadow-sm border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="size-4" /> Luyện đọc Từ vựng
        </button>
        <button
          type="button"
          onClick={() => {
            setTargetMode('sentence')
            setScoreResult(null)
          }}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            targetMode === 'sentence'
              ? 'bg-card text-purple-600 dark:text-purple-400 shadow-sm border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MessageSquare className="size-4" /> Luyện cả câu ví dụ ✨
        </button>
      </div>

      {!speechSupported && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs text-center space-y-1">
          <p className="font-bold">⚠️ Trình duyệt của bạn chưa bật quyền Micro hoặc không hỗ trợ Web Speech Recognition.</p>
          <p>Hãy sử dụng trình duyệt <strong>Google Chrome, Microsoft Edge, Safari</strong> trên máy tính hoặc điện thoại để có trải nghiệm tốt nhất!</p>
        </div>
      )}

      {/* Main Speaking Stage Card */}
      <Card className="border-border/80 shadow-2xl overflow-hidden bg-card/90 backdrop-blur-md">
        <CardContent className="p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-8 min-h-[420px]">
          
          {/* Target Word / Sentence Display */}
          <div className="space-y-3 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1.5">
              {targetMode === 'sentence' ? (
                <>
                  <MessageSquare className="size-3.5 text-purple-500" />
                  Đọc toàn bộ câu ví dụ sau:
                </>
              ) : (
                <>
                  <BookOpen className="size-3.5 text-indigo-500" />
                  {isZh ? 'Phát âm chữ Hán / Tiếng Trung:' : 'Phát âm từ vựng tiếng Anh:'}
                </>
              )}
            </span>

            {targetMode === 'sentence' ? (
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground leading-relaxed">
                  {rawSentence}
                </h1>
                <p className="text-sm font-medium text-muted-foreground">
                  Nghĩa của từ trọng tâm: <strong className="text-foreground">{currentCard.term}</strong> ({currentCard.definition})
                </p>
              </div>
            ) : (
              <>
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
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetMode('sentence')
                        setScoreResult(null)
                      }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center justify-center gap-1 mx-auto bg-indigo-500/10 py-1.5 px-3 rounded-xl border border-indigo-500/20 font-medium"
                    >
                      <MessageSquare className="size-3" />
                      VD: {currentCard.example_sentence} (Bấm để luyện cả câu)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Reference Audio Controls */}
          <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-2xl border border-border/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleSpeakSample(activeTarget, 1.0)}
              className="gap-1.5 text-xs font-semibold rounded-xl hover:bg-background"
            >
              <Volume2 className="size-4 text-indigo-600" /> Nghe phát âm mẫu
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
                  : 'bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white hover:scale-105 ring-8 ring-indigo-500/20 shadow-indigo-500/40'
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
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {scoreResult.isPassed ? (
                    <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="size-5 text-amber-600 dark:text-amber-400" />
                  )}
                  <span className="font-bold text-sm">
                    {scoreResult.feedbackMessage}
                  </span>
                </div>

                <div className="flex items-center gap-1 font-mono font-black text-lg">
                  <span
                    className={
                      scoreResult.isPassed
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }
                  >
                    {scoreResult.score}%
                  </span>
                </div>
              </div>

              {/* What the machine heard */}
              <div className="text-xs space-y-1 bg-card/60 p-3 rounded-xl border border-border/50">
                <p className="text-muted-foreground font-semibold">Máy thu được:</p>
                <p className="font-medium text-foreground italic">
                  "{scoreResult.transcript || '(Không nghe rõ âm thanh)'}"
                </p>
              </div>

              {/* Word by word breakdown feedback */}
              {scoreResult.wordFeedback.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground">Đánh giá chi tiết từng từ:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {scoreResult.wordFeedback.map((wf, idx) => (
                      <span
                        key={idx}
                        className={`text-xs px-2 py-0.5 rounded-md font-semibold border ${
                          wf.isCorrect
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                        }`}
                      >
                        {wf.word}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Navigation controls */}
          <div className="flex items-center justify-between w-full pt-4 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevCard}
              disabled={currentIndex === 0}
              className="gap-1 text-xs"
            >
              <ArrowLeft className="size-3.5" /> Thẻ trước
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextCard}
              className="gap-1 text-xs"
            >
              Thẻ kế tiếp <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
