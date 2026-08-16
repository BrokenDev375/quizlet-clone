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
} from 'lucide-react'

export default function GrammarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const setId = resolvedParams.id

  const [set, setSet] = useState<FlashcardSet | null>(null)
  const [cards, setCards] = useState<(CardType & { phonetic?: string; example_sentence?: string })[]>([])
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
        setCards(unpacked)
        const genEx = generateGrammarExercises(unpacked)
        setExercises(genEx)
      }

      setLoading(false)
    }

    loadData()
  }, [setId])

  const handleGenerateAI = async () => {
    if (!set || cards.length === 0 || isGeneratingAI) return
    setIsGeneratingAI(true)
    setAiError(null)

    try {
      const res = await fetch('/api/ai/grammar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards, setTitle: set.title }),
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

  const handlePickToken = (tokenObj: { id: string; word: string }) => {
    if (isAnswered) return
    setSelectedTokens([...selectedTokens, tokenObj.word])
    setAvailableTokens(availableTokens.filter((t) => t.id !== tokenObj.id))
  }

  const handleRemoveToken = (index: number) => {
    if (isAnswered) return
    const wordToRemove = selectedTokens[index]
    setSelectedTokens(selectedTokens.filter((_, i) => i !== index))
    setAvailableTokens([
      ...availableTokens,
      { id: `${wordToRemove}_${Math.random()}`, word: wordToRemove },
    ])
  }

  const handleCheckAnswer = () => {
    if (exercises.length === 0 || isAnswered) return
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

  const handleRestart = () => {
    setCurrentIndex(0)
    setScoreCount(0)
    setIsCompleted(false)
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="size-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Đang chuẩn bị phòng Luyện ngữ pháp...</p>
      </div>
    )
  }

  if (!set || exercises.length === 0) {
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

    return (
      <div className="container max-w-2xl mx-auto py-10 px-4 space-y-6 animate-in fade-in duration-300">
        <Card className="border-border shadow-2xl p-6 sm:p-8 text-center space-y-6 bg-gradient-to-b from-card to-muted/30">
          <div className="inline-flex size-20 rounded-full items-center justify-center mx-auto bg-indigo-500/10 text-indigo-600 ring-8 ring-indigo-500/20 shadow-inner">
            <Trophy className="size-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Hoàn thành Luyện cấu trúc câu!
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Điểm chính xác:{' '}
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {accuracyPercent}%
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Bạn đã sắp xếp đúng <span className="font-bold text-foreground">{scoreCount}</span> /{' '}
              <span className="font-bold text-foreground">{exercises.length} câu</span>.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button
              size="lg"
              onClick={handleRestart}
              className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold shadow-lg shadow-indigo-500/25"
            >
              <RotateCcw className="size-4" /> Luyện tập lại
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
            {currentIndex + 1} / {exercises.length}
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

      {aiError && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-center justify-between">
          <span>⚠️ {aiError}</span>
          <button onClick={() => setAiError(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      <Progress value={progressPercent} className="h-2" />

      {/* Main Grammar Card */}
      <Card className="border-border/80 shadow-2xl overflow-hidden bg-card/90 backdrop-blur-md">
        <CardContent className="p-6 sm:p-10 space-y-8 min-h-[420px] flex flex-col justify-between">
          
          {/* Question Title & Translation */}
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {currentEx.title}
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              {currentEx.translation}
            </h2>
            <p className="text-xs text-muted-foreground italic">
              💡 {currentEx.hint}
            </p>
          </div>

          {/* User Sentence Construction Drop Area */}
          <div className="min-h-[100px] p-4 sm:p-6 rounded-2xl bg-muted/40 border-2 border-dashed border-indigo-500/30 flex flex-wrap items-center justify-center gap-2">
            {selectedTokens.length === 0 ? (
              <span className="text-sm text-muted-foreground/60 italic font-medium">
                Chạm vào các từ bên dưới để ghép thành câu hoàn chỉnh...
              </span>
            ) : (
              selectedTokens.map((token, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isAnswered}
                  onClick={() => handleRemoveToken(idx)}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-base shadow-md hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-1.5 animate-in zoom-in-90"
                  title="Chạm để gỡ từ này"
                >
                  <span>{token}</span>
                </button>
              ))
            )}
          </div>

          {/* Available Word Chips Area */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block text-center">
              Kho từ vựng (Chạm để chọn):
            </span>

            <div className="flex flex-wrap items-center justify-center gap-2.5 min-h-[60px]">
              {availableTokens.map((tokenObj) => (
                <button
                  key={tokenObj.id}
                  type="button"
                  disabled={isAnswered}
                  onClick={() => handlePickToken(tokenObj)}
                  className="px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-indigo-500/10 hover:border-indigo-500/40 text-foreground font-semibold text-base shadow-xs active:scale-95 transition-all"
                >
                  {tokenObj.word}
                </button>
              ))}
            </div>
          </div>

          {/* Result Feedback & Actions */}
          {isAnswered ? (
            <div
              className={`p-4 rounded-2xl border text-left space-y-2 animate-in fade-in zoom-in-95 ${
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
                      Chính xác hoàn hảo!
                    </>
                  ) : (
                    <>
                      <XCircle className="size-5 text-destructive" />
                      Trật tự câu chưa chính xác!
                    </>
                  )}
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => speakMultilingualText(currentEx.targetSentence)}
                  className="gap-1 text-xs"
                >
                  <Volume2 className="size-3.5" /> Nghe câu chuẩn
                </Button>
              </div>

              {!isCorrect && (
                <div className="pt-2 border-t border-border/40 text-xs text-foreground">
                  <span className="text-muted-foreground block mb-0.5">Đáp án câu chuẩn:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                    {currentEx.targetSentence}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedTokens([])
                  setAvailableTokens(
                    currentEx.scrambledWords.map((w, idx) => ({
                      id: `${w}_${idx}_${Math.random()}`,
                      word: w,
                    }))
                  )
                }}
                disabled={selectedTokens.length === 0}
                className="w-1/3 h-12 text-sm font-semibold rounded-xl"
              >
                Đặt lại
              </Button>
              <Button
                type="button"
                onClick={handleCheckAnswer}
                disabled={selectedTokens.length === 0}
                className="w-2/3 h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/25 rounded-xl"
              >
                Kiểm tra trật tự câu
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
