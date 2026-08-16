'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import { unpackCardContent } from '@/lib/quiz/card-serialization'
import {
  generateGrammarExercises,
  GrammarExercise,
} from '@/lib/quiz/advanced-skills'
import { speakMultilingualText, isChineseText } from '@/lib/quiz/sentence-templates'
import { playSuccessChime, playRetryBeep } from '@/lib/quiz/speech-recognition'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BookMarked,
  Volume2,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Trophy,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  Layers,
  ChevronDown,
} from 'lucide-react'

const BATCH_SIZE = 20 // Chia mỗi chặng 20 từ để học tập hiệu quả

export default function GrammarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const setId = resolvedParams.id

  const [set, setSet] = useState<FlashcardSet | null>(null)
  const [allCards, setAllCards] = useState<(CardType & { phonetic?: string; example_sentence?: string })[]>([])
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0) // 0 = 1-20, 1 = 21-40...
  const [isAllMode, setIsAllMode] = useState(false)

  const [exercises, setExercises] = useState<GrammarExercise[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedTokens, setSelectedTokens] = useState<string[]>([])
  const [availableTokens, setAvailableTokens] = useState<{ id: string; word: string }[]>([])
  const [isAnswered, setIsAnswered] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [scoreCount, setScoreCount] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

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
        setAllCards(unpacked)
        loadBatchExercises(unpacked, 0, false)
      }

      setLoading(false)
    }

    loadData()
  }, [setId])

  // Nạp danh sách bài tập theo nhóm 20 từ hoặc tất cả
  const loadBatchExercises = (
    cardsList: typeof allCards,
    batchIdx: number,
    allMode: boolean
  ) => {
    let targetCards = cardsList
    if (!allMode && cardsList.length > BATCH_SIZE) {
      const start = batchIdx * BATCH_SIZE
      const end = start + BATCH_SIZE
      targetCards = cardsList.slice(start, end)
    }

    const genEx = generateGrammarExercises(targetCards)
    setExercises(genEx)
    setCurrentIndex(0)
    setScoreCount(0)
    setIsCompleted(false)
    setSelectedTokens([])
    setIsAnswered(false)
  }

  const handleSelectBatch = (batchIdx: number) => {
    setCurrentBatchIndex(batchIdx)
    setIsAllMode(false)
    loadBatchExercises(allCards, batchIdx, false)
  }

  const handleSelectAll = () => {
    setIsAllMode(true)
    loadBatchExercises(allCards, 0, true)
  }

  // Tạo câu ngữ pháp mới bằng Gemini AI cho nhóm từ đang học
  const handleGenerateAI = async () => {
    if (!set || allCards.length === 0 || isGeneratingAI) return
    setIsGeneratingAI(true)
    setAiError(null)

    const activeBatchCards = isAllMode
      ? allCards.slice(0, 15)
      : allCards.slice(currentBatchIndex * BATCH_SIZE, (currentBatchIndex + 1) * BATCH_SIZE)

    try {
      const res = await fetch('/api/ai/grammar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: activeBatchCards, setTitle: set.title }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Lỗi khi gọi Gemini AI')
      }

      const aiData = await res.json()
      if (aiData.exercises && Array.isArray(aiData.exercises) && aiData.exercises.length > 0) {
        const mapped = aiData.exercises.map((ex: any, idx: number) => ({
          id: `ai_grammar_${idx}_${Date.now()}`,
          title: ex.title || `Thử thách ngữ pháp AI #${idx + 1}`,
          targetSentence: ex.targetSentence,
          scrambledWords: ex.scrambledWords || [],
          translation: ex.translation || '',
          hint: ex.hint || 'Cấu trúc ngữ pháp chuẩn',
        }))
        setExercises(mapped)
        setCurrentIndex(0)
        setScoreCount(0)
        setIsCompleted(false)
        playSuccessChime()
      }
    } catch (err: any) {
      console.warn('AI grammar generation fallback:', err)
      setAiError(err.message || 'Lỗi khi gọi Gemini AI')
    } finally {
      setIsGeneratingAI(false)
    }
  }

  // Khởi tạo các token từ xáo trộn cho câu hiện tại
  useEffect(() => {
    if (exercises.length > 0 && currentIndex < exercises.length && !isCompleted) {
      const ex = exercises[currentIndex]
      setSelectedTokens([])
      setIsAnswered(false)
      setAvailableTokens(
        ex.scrambledWords.map((w, idx) => ({
          id: `${w}_${idx}_${Math.random()}`,
          word: w,
        }))
      )
    }
  }, [currentIndex, exercises, isCompleted])

  const handleSelectWordToken = (token: { id: string; word: string }) => {
    if (isAnswered) return
    setSelectedTokens((prev) => [...prev, token.word])
    setAvailableTokens((prev) => prev.filter((t) => t.id !== token.id))
  }

  const handleRemoveWordToken = (indexToRemove: number) => {
    if (isAnswered) return
    const removedWord = selectedTokens[indexToRemove]
    setSelectedTokens((prev) => prev.filter((_, idx) => idx !== indexToRemove))
    setAvailableTokens((prev) => [
      ...prev,
      { id: `${removedWord}_${Date.now()}_${Math.random()}`, word: removedWord },
    ])
  }

  const handleResetTokens = () => {
    if (isAnswered) return
    if (exercises.length > 0 && currentIndex < exercises.length) {
      const ex = exercises[currentIndex]
      setSelectedTokens([])
      setAvailableTokens(
        ex.scrambledWords.map((w, idx) => ({
          id: `${w}_${idx}_${Math.random()}`,
          word: w,
        }))
      )
    }
  }

  const handleCheckAnswer = () => {
    if (isAnswered || selectedTokens.length === 0) return

    const currentEx = exercises[currentIndex]
    const isZh = isChineseText(currentEx.targetSentence)

    const userSentence = selectedTokens.join(isZh ? '' : ' ').trim()
    const targetSentence = currentEx.targetSentence.trim()

    const correct =
      userSentence.toLowerCase().replace(/\s+/g, '') ===
      targetSentence.toLowerCase().replace(/\s+/g, '')

    setIsCorrect(correct)
    setIsAnswered(true)

    if (correct) {
      setScoreCount((prev) => prev + 1)
      playSuccessChime()
      speakMultilingualText(currentEx.targetSentence)
      setTimeout(() => {
        handleNextQuestion()
      }, 1800)
    } else {
      playRetryBeep()
    }
  }

  const handleNextQuestion = () => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      setIsCompleted(true)
    }
  }

  const totalBatches = Math.ceil(allCards.length / BATCH_SIZE)

  const handleNextBatch = () => {
    if (currentBatchIndex < totalBatches - 1) {
      const nextBatch = currentBatchIndex + 1
      setCurrentBatchIndex(nextBatch)
      setIsAllMode(false)
      loadBatchExercises(allCards, nextBatch, false)
    }
  }

  const handleRestartCurrentBatch = () => {
    loadBatchExercises(allCards, currentBatchIndex, isAllMode)
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="size-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Đang chuẩn bị phòng Luyện ngữ pháp...</p>
      </div>
    )
  }

  if (!set || allCards.length === 0) {
    return (
      <div className="container max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <BookMarked className="size-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold">Học phần này chưa có thẻ nào để tạo bài tập ngữ pháp</h2>
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
  // MÀN HÌNH HOÀN THÀNH (GRAMMAR SUMMARY)
  // =========================================================================
  if (isCompleted) {
    const accuracyPercent = Math.round((scoreCount / exercises.length) * 100)
    const hasNextBatch = !isAllMode && currentBatchIndex < totalBatches - 1

    return (
      <div className="container max-w-2xl mx-auto py-10 px-4 space-y-6 animate-in fade-in duration-300">
        <Card className="border-border shadow-2xl p-6 sm:p-8 text-center space-y-6 bg-gradient-to-b from-card to-muted/30">
          <div className="inline-flex size-20 rounded-full items-center justify-center mx-auto bg-indigo-500/10 text-indigo-600 ring-8 ring-indigo-500/20 shadow-inner">
            <Trophy className="size-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Hoàn thành chặng luyện ngữ pháp!
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Điểm chính xác:{' '}
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {accuracyPercent}%
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Bạn đã ghép đúng <span className="font-bold text-foreground">{scoreCount}</span> /{' '}
              <span className="font-bold text-foreground">{exercises.length} câu</span> trong chặng này.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 pt-2">
            {hasNextBatch && (
              <Button
                size="lg"
                onClick={handleNextBatch}
                className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-lg shadow-purple-500/25"
              >
                Tiếp tục Phần {currentBatchIndex + 2} (Từ {(currentBatchIndex + 1) * BATCH_SIZE + 1} - {Math.min((currentBatchIndex + 2) * BATCH_SIZE, allCards.length)}) <ArrowRight className="size-4" />
              </Button>
            )}

            <Button
              size="lg"
              variant="outline"
              onClick={handleRestartCurrentBatch}
              className="gap-2"
            >
              <RotateCcw className="size-4" /> Luyện lại phần này
            </Button>

            <Link
              href={`/sets/${setId}`}
              className={buttonVariants({ size: 'lg', variant: 'ghost' })}
            >
              Quay lại học phần
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  // =========================================================================
  // MÀN HÌNH LUYỆN NGỮ PHÁP CHÍNH (ACTIVE GRAMMAR ARENA)
  // =========================================================================
  const currentEx = exercises[currentIndex]
  const progressPercent = Math.round(((currentIndex + 1) / exercises.length) * 100)

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Top Navigation & Progress */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
          {/* Magic AI Button */}
          <Button
            size="sm"
            onClick={handleGenerateAI}
            disabled={isGeneratingAI}
            className="text-xs gap-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white font-bold shadow-md shadow-purple-500/20 hover:scale-105 transition-all"
          >
            {isGeneratingAI ? (
              <>
                <div className="size-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Gemini đang tạo câu...
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" /> ✨ Nhờ Gemini AI tạo câu mới
              </>
            )}
          </Button>

          <Badge variant="outline" className="font-mono text-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
            {currentIndex + 1} / {exercises.length} câu
          </Badge>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextQuestion}
            className="text-xs text-muted-foreground hover:text-foreground gap-1 ml-auto sm:ml-0"
          >
            Bỏ qua <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Chặng học phần Selector (Khi bộ thẻ có nhiều hơn 20 từ) */}
      {allCards.length > BATCH_SIZE && (
        <div className="flex items-center justify-between gap-2 bg-muted/50 p-2 rounded-2xl border border-border/60 overflow-x-auto text-xs">
          <span className="font-bold text-muted-foreground shrink-0 pl-1 flex items-center gap-1">
            <Layers className="size-3.5" /> Chọn chặng ({allCards.length} từ):
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {Array.from({ length: totalBatches }).map((_, idx) => {
              const startNum = idx * BATCH_SIZE + 1
              const endNum = Math.min((idx + 1) * BATCH_SIZE, allCards.length)
              const isActive = !isAllMode && currentBatchIndex === idx

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectBatch(idx)}
                  className={`py-1 px-2.5 rounded-lg font-semibold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-card text-muted-foreground hover:text-foreground border border-border/60'
                  }`}
                >
                  Phần {idx + 1} ({startNum}-{endNum})
                </button>
              )
            })}

            <button
              type="button"
              onClick={handleSelectAll}
              className={`py-1 px-2.5 rounded-lg font-semibold transition ${
                isAllMode
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-card text-muted-foreground hover:text-foreground border border-border/60'
              }`}
            >
              Toàn bộ ({allCards.length} từ)
            </button>
          </div>
        </div>
      )}

      {aiError && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-center justify-between">
          <span>⚠️ {aiError}</span>
          <button onClick={() => setAiError(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      <Progress value={progressPercent} className="h-2" />

      {/* Main Grammar Unscramble Challenge Card */}
      {currentEx && (
        <Card className="border-border/80 shadow-2xl overflow-hidden bg-card/90 backdrop-blur-md">
          <CardHeader className="text-center pb-2 pt-6">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Badge variant="secondary" className="text-[11px] font-semibold">
                {currentEx.title}
              </Badge>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {currentEx.translation}
            </CardTitle>
            {currentEx.hint && (
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 pt-1">
                <HelpCircle className="size-3.5 text-amber-500" />
                {currentEx.hint}
              </p>
            )}
          </CardHeader>

          <CardContent className="p-6 sm:p-8 space-y-6 flex flex-col items-center">
            {/* Selected Tokens Drop Arena */}
            <div className="w-full min-h-[90px] p-4 rounded-2xl border-2 border-dashed border-indigo-500/40 bg-indigo-500/5 flex flex-wrap items-center justify-center gap-2 transition-all">
              {selectedTokens.length === 0 ? (
                <p className="text-xs text-muted-foreground italic select-none">
                  Chạm vào các từ bên dưới để ghép thành câu hoàn chỉnh...
                </p>
              ) : (
                selectedTokens.map((word, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleRemoveWordToken(idx)}
                    disabled={isAnswered}
                    className="py-2 px-3.5 rounded-xl bg-indigo-600 text-white font-bold text-base sm:text-lg shadow-md hover:bg-rose-600 transition-all cursor-pointer animate-in zoom-in-95"
                    title="Chạm để bỏ từ này"
                  >
                    {word}
                  </button>
                ))
              )}
            </div>

            {/* Available Tokens Selection Box */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold px-1">
                <span>Kho từ vựng:</span>
                {selectedTokens.length > 0 && !isAnswered && (
                  <button
                    type="button"
                    onClick={handleResetTokens}
                    className="text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="size-3" /> Xếp lại từ đầu
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5 min-h-[60px] p-4 rounded-2xl bg-muted/40 border border-border/60">
                {availableTokens.map((token) => (
                  <button
                    key={token.id}
                    type="button"
                    onClick={() => handleSelectWordToken(token)}
                    disabled={isAnswered}
                    className="py-2 px-4 rounded-xl bg-card border-2 border-border/80 hover:border-indigo-500 hover:bg-indigo-500/10 font-bold text-base sm:text-lg shadow-xs hover:scale-105 transition-all active:scale-95 cursor-pointer"
                  >
                    {token.word}
                  </button>
                ))}
              </div>
            </div>

            {/* Answer Result Banner */}
            {isAnswered && (
              <div
                className={`w-full p-4 rounded-2xl border text-sm flex items-center justify-between animate-in fade-in zoom-in-95 ${
                  isCorrect
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {isCorrect ? (
                    <CheckCircle2 className="size-6 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="size-6 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <p className="font-bold">
                      {isCorrect ? '🎉 Chính xác! Cấu trúc câu rất chuẩn!' : 'Chưa chính xác!'}
                    </p>
                    <p className="text-xs font-semibold mt-0.5">
                      Đáp án đúng: <span className="underline">{currentEx.targetSentence}</span>
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => speakMultilingualText(currentEx.targetSentence)}
                  className="gap-1 text-xs shrink-0"
                >
                  <Volume2 className="size-4" /> Nghe
                </Button>
              </div>
            )}

            {/* Submit & Next Button */}
            <div className="w-full max-w-sm pt-2">
              {!isAnswered ? (
                <Button
                  type="button"
                  onClick={handleCheckAnswer}
                  disabled={selectedTokens.length === 0}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-base shadow-lg shadow-indigo-500/25 hover:scale-[1.02] transition-all"
                >
                  Kiểm tra câu
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleNextQuestion}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base shadow-lg shadow-indigo-500/25 hover:scale-[1.02] transition-all gap-2"
                >
                  {currentIndex < exercises.length - 1 ? (
                    <>
                      Câu tiếp theo <ArrowRight className="size-4" />
                    </>
                  ) : (
                    <>
                      Xem kết quả <Trophy className="size-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
