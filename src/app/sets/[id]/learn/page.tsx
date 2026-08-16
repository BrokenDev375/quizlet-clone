'use client'

import { useState, useEffect, use, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import {
  QuizQuestion,
  CardProgressState,
  CardMasteryLevel,
  generateAdaptiveLearnBatch,
  checkWrittenAnswer,
} from '@/lib/quiz/question-generator'
import { speakMultilingualText } from '@/lib/quiz/sentence-templates'
import { playSuccessChime, playRetryBeep } from '@/lib/quiz/speech-recognition'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Brain,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  Sparkles,
  ArrowRight,
  Volume2,
  HelpCircle,
  Layers,
  Flame,
  Check,
} from 'lucide-react'

export default function LearnModePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const setId = resolvedParams.id

  const [set, setSet] = useState<FlashcardSet | null>(null)
  const [allCards, setAllCards] = useState<CardType[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, CardProgressState>>({})
  const [currentQueue, setCurrentQueue] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  // Question Interaction State
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [writtenInput, setWrittenInput] = useState('')
  const [isAnswered, setIsAnswered] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)

  // Round & Milestone Tracking
  const [roundNumber, setRoundNumber] = useState(1)
  const [showRoundSummary, setShowRoundSummary] = useState(false)
  const [roundMasteredCount, setRoundMasteredCount] = useState(0)
  const [roundLearningCount, setRoundLearningCount] = useState(0)
  const [isFullyMastered, setIsFullyMastered] = useState(false)
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)

  const writtenInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  // 1. Tải dữ liệu ban đầu
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

      if (cardsData && cardsData.length > 0) {
        setAllCards(cardsData)

        // Khởi tạo Progress Map cho từng thẻ
        const initialMap: Record<string, CardProgressState> = {}
        cardsData.forEach((c) => {
          initialMap[c.id] = {
            cardId: c.id,
            level: 'new',
            correctStreak: 0,
            incorrectCount: 0,
            testedTypes: [],
          }
        })
        setProgressMap(initialMap)

        // Sinh vòng học 1
        const firstBatch = generateAdaptiveLearnBatch(cardsData, initialMap, 6)
        setCurrentQueue(firstBatch)
        setCurrentIndex(0)
      }

      setLoading(false)
    }

    loadData()
  }, [setId])

  // Focus input khi chuyển sang câu tự luận hoặc điền chỗ trống
  useEffect(() => {
    if (
      currentQueue.length > 0 &&
      currentIndex < currentQueue.length &&
      (currentQueue[currentIndex].type === 'written' ||
        currentQueue[currentIndex].type === 'cloze_fill_blank') &&
      !isAnswered
    ) {
      setTimeout(() => {
        writtenInputRef.current?.focus()
      }, 50)
    }
  }, [currentIndex, currentQueue, isAnswered])

  // Phát âm Text-to-Speech đa ngôn ngữ (Tiếng Anh, Tiếng Trung, Tiếng Việt)
  const speakText = (text: string) => {
    speakMultilingualText(text)
  }

  // 2. Xử lý trả lời câu hỏi
  const handleAnswer = (userChoice: string) => {
    if (isAnswered || currentQueue.length === 0) return

    const currentQ = currentQueue[currentIndex]
    let correct = false

    if (currentQ.type === 'written') {
      correct = checkWrittenAnswer(userChoice, currentQ.targetAnswer)
    } else if (currentQ.type === 'true_false') {
      correct = userChoice.toLowerCase() === currentQ.targetAnswer.toLowerCase()
    } else {
      // Trắc nghiệm xuôi hoặc ngược
      correct = userChoice.trim() === currentQ.targetAnswer.trim()
    }

    setSelectedAnswer(userChoice)
    setIsCorrect(correct)
    setIsAnswered(true)

    // Cập nhật streak & Âm thanh phát âm
    if (correct) {
      setStreak((s) => s + 1)
      playSuccessChime()
      // Tự động phát âm thuật ngữ khi trả lời đúng
      speakText(currentQ.card.term)
    } else {
      setStreak(0)
      playRetryBeep()
      // Tự động phát âm thuật ngữ chuẩn khi trả lời SAI để người học nghe lại và sửa sai
      setTimeout(() => {
        speakText(currentQ.card.term)
      }, 300)
    }

    // Cập nhật State Mastery của thẻ trong Progress Map
    const cardId = currentQ.card.id
    const prevCardState = progressMap[cardId] || {
      cardId,
      level: 'new',
      correctStreak: 0,
      incorrectCount: 0,
      testedTypes: [],
    }

    let nextLevel: CardMasteryLevel = prevCardState.level
    let nextStreak = correct ? prevCardState.correctStreak + 1 : 0
    let nextIncorrect = correct ? prevCardState.incorrectCount : prevCardState.incorrectCount + 1

    if (!correct) {
      // Trả lời sai -> Rớt về 'new' (chưa nhớ) để luyện lại
      nextLevel = 'new'
    } else {
      // Trả lời đúng
      if (prevCardState.level === 'new') {
        nextLevel = 'learning'
      } else if (prevCardState.level === 'learning') {
        if (nextStreak >= 2) {
          nextLevel = 'mastered' // Đã thuộc khi đúng 2 lần liên tiếp ở các dạng khác nhau
        }
      }
    }

    const updatedTestedTypes = Array.from(
      new Set([...prevCardState.testedTypes, currentQ.type])
    )

    const updatedMap = {
      ...progressMap,
      [cardId]: {
        cardId,
        level: nextLevel,
        correctStreak: nextStreak,
        incorrectCount: nextIncorrect,
        testedTypes: updatedTestedTypes,
      },
    }

    setProgressMap(updatedMap)
  }

  // 3. Chuyển sang câu tiếp theo hoặc kết thúc vòng học
  const handleNext = () => {
    // Reset tương tác
    setSelectedAnswer(null)
    setWrittenInput('')
    setIsAnswered(false)
    setIsCorrect(false)

    if (currentIndex + 1 < currentQueue.length) {
      setCurrentIndex((i) => i + 1)
    } else {
      // Đã hoàn thành batch/vòng hiện tại!
      // Đếm số lượng theo cấp độ
      const mastered = allCards.filter(
        (c) => progressMap[c.id]?.level === 'mastered'
      ).length
      const learning = allCards.filter(
        (c) => progressMap[c.id]?.level === 'learning'
      ).length

      setRoundMasteredCount(mastered)
      setRoundLearningCount(learning)

      if (mastered === allCards.length) {
        setIsFullyMastered(true)
      } else {
        setShowRoundSummary(true)
      }
    }
  }

  // 4. Bắt đầu vòng học tiếp theo
  const startNextRound = () => {
    setShowRoundSummary(false)
    setRoundNumber((r) => r + 1)

    // Sinh batch câu hỏi mới thích ứng dựa trên trạng thái mới nhất
    const nextBatch = generateAdaptiveLearnBatch(allCards, progressMap, 6)
    if (nextBatch.length > 0) {
      setCurrentQueue(nextBatch)
      setCurrentIndex(0)
    } else {
      setIsFullyMastered(true)
    }
  }

  // Khởi động lại từ đầu
  const restartLearn = () => {
    const initialMap: Record<string, CardProgressState> = {}
    allCards.forEach((c) => {
      initialMap[c.id] = {
        cardId: c.id,
        level: 'new',
        correctStreak: 0,
        incorrectCount: 0,
        testedTypes: [],
      }
    })
    setProgressMap(initialMap)
    setRoundNumber(1)
    setStreak(0)
    setIsFullyMastered(false)
    setShowRoundSummary(false)

    const firstBatch = generateAdaptiveLearnBatch(allCards, initialMap, 6)
    setCurrentQueue(firstBatch)
    setCurrentIndex(0)
    setSelectedAnswer(null)
    setWrittenInput('')
    setIsAnswered(false)
  }

  // Xử lý phím tắt
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFullyMastered || showRoundSummary || currentQueue.length === 0) return

      const currentQ = currentQueue[currentIndex]
      if (!currentQ) return

      if (isAnswered) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleNext()
        }
        return
      }

      if (currentQ.type === 'mc_term_to_def' || currentQ.type === 'mc_def_to_term') {
        const keyNum = parseInt(e.key)
        if (keyNum >= 1 && keyNum <= (currentQ.options?.length || 4)) {
          e.preventDefault()
          const opt = currentQ.options?.[keyNum - 1]
          if (opt) handleAnswer(opt)
        }
      } else if (currentQ.type === 'true_false') {
        if (e.key.toLowerCase() === 't' || e.key === '1') {
          e.preventDefault()
          handleAnswer('true')
        } else if (e.key.toLowerCase() === 'f' || e.key === '2') {
          e.preventDefault()
          handleAnswer('false')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAnswered, currentIndex, currentQueue, isFullyMastered, showRoundSummary])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="size-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Đang khởi tạo thuật toán học thích ứng...</p>
      </div>
    )
  }

  if (!set || allCards.length === 0) {
    return (
      <div className="container max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <Brain className="size-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold">Chưa có thẻ nào trong học phần</h2>
        <p className="text-sm text-muted-foreground">Vui lòng thêm thẻ vào học phần để bắt đầu luyện tập.</p>
            <Link
              href={`/sets/${setId}`}
              className={buttonVariants({ variant: 'default' })}
            >
              Quay lại học phần
            </Link>
      </div>
    )
  }

  // Tính toán số liệu thống kê Mastery
  const masteredCount = allCards.filter(
    (c) => progressMap[c.id]?.level === 'mastered'
  ).length
  const learningCount = allCards.filter(
    (c) => progressMap[c.id]?.level === 'learning'
  ).length
  const newCount = allCards.length - masteredCount - learningCount

  const masteredPercent = Math.round((masteredCount / allCards.length) * 100)
  const learningPercent = Math.round((learningCount / allCards.length) * 100)
  const newPercent = 100 - masteredPercent - learningPercent

  // =========================================================================
  // MÀN HÌNH 1: HOÀN THÀNH 100% THÀNH THẠO (100% MASTERY CELEBRATION)
  // =========================================================================
  if (isFullyMastered) {
    return (
      <div className="container max-w-2xl mx-auto py-12 px-4 space-y-8 animate-in fade-in zoom-in duration-300">
        <Card className="border-border/80 shadow-2xl bg-gradient-to-b from-card via-card to-emerald-500/5 text-center p-8 space-y-6">
          <div className="inline-flex size-20 rounded-full bg-emerald-500/10 text-emerald-500 items-center justify-center shadow-inner mx-auto ring-8 ring-emerald-500/20 animate-bounce">
            <Trophy className="size-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight">
              Xuất sắc! Bạn đã làm chủ 100% bộ thẻ! 🎉
            </h1>
            <p className="text-muted-foreground">
              Toàn bộ <span className="font-semibold text-foreground">{allCards.length} từ vựng</span> đã đạt cấp độ{' '}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Thành thạo (Mastered)</span> qua nhiều dạng câu hỏi đa chiều.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 bg-muted/40 rounded-2xl border border-border/60">
            <div className="p-3 bg-card rounded-xl border border-border/40">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{allCards.length}</div>
              <div className="text-xs text-muted-foreground">Đã thuộc vĩnh viễn</div>
            </div>
            <div className="p-3 bg-card rounded-xl border border-border/40">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{roundNumber}</div>
              <div className="text-xs text-muted-foreground">Vòng học đã vượt qua</div>
            </div>
            <div className="p-3 bg-card rounded-xl border border-border/40">
              <div className="text-2xl font-bold text-amber-500 flex items-center justify-center gap-1">
                <Flame className="size-5 fill-amber-500" />
                {streak}
              </div>
              <div className="text-xs text-muted-foreground">Chuỗi đúng kỷ lục</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              size="lg"
              variant="outline"
              onClick={restartLearn}
              className="gap-2"
            >
              <RotateCcw className="size-4" /> Học lại từ đầu
            </Button>
            <Link
              href={`/sets/${setId}/test`}
              className={buttonVariants({
                size: 'lg',
                className: 'gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg shadow-indigo-500/20',
              })}
            >
              <Sparkles className="size-4" /> Làm bài kiểm tra (Test Mode)
            </Link>
            <Link
              href={`/sets/${setId}`}
              className={buttonVariants({ size: 'lg', variant: 'ghost' })}
            >
              Về học phần
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  // =========================================================================
  // MÀN HÌNH 2: TỔNG KẾT VÒNG HỌC (ROUND CHECKPOINT SUMMARY)
  // =========================================================================
  if (showRoundSummary) {
    return (
      <div className="container max-w-xl mx-auto py-12 px-4 space-y-6 animate-in fade-in duration-200">
        <Card className="border-border shadow-xl p-6 sm:p-8 space-y-6 text-center">
          <div className="inline-flex size-14 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 items-center justify-center mx-auto">
            <Layers className="size-7" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Hoàn thành Vòng {roundNumber}! 👏</h2>
            <p className="text-sm text-muted-foreground">
              Tiếp tục giữ vững phong độ! Bộ não của bạn đang dần ghi nhớ sâu các từ vựng.
            </p>
          </div>

          {/* Thanh tiến độ đa màu */}
          <div className="space-y-2">
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
              <div
                style={{ width: `${masteredPercent}%` }}
                className="bg-emerald-500 transition-all duration-500"
                title={`Đã thuộc: ${masteredCount}`}
              />
              <div
                style={{ width: `${learningPercent}%` }}
                className="bg-amber-500 transition-all duration-500"
                title={`Đang học: ${learningCount}`}
              />
              <div
                style={{ width: `${newPercent}%` }}
                className="bg-slate-300 dark:bg-slate-700 transition-all duration-500"
                title={`Chưa học: ${newCount}`}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500" /> Đã thuộc: {roundMasteredCount} / {allCards.length} ({masteredPercent}%)
              </span>
              <span className="flex items-center gap-1.5 font-medium text-amber-500">
                <span className="size-2 rounded-full bg-amber-500" /> Đang học: {roundLearningCount}
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="size-2 rounded-full bg-slate-400" /> Còn lại: {allCards.length - roundMasteredCount - roundLearningCount}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <Button
              size="lg"
              onClick={startNextRound}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg shadow-indigo-500/25 gap-2"
            >
              Tiếp tục Vòng {roundNumber + 1} <ArrowRight className="size-5" />
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // =========================================================================
  // MÀN HÌNH 3: GIAO DIỆN LÀM CÂU HỎI TRONG VÒNG (ACTIVE QUIZ SCREEN)
  // =========================================================================
  const currentQ = currentQueue[currentIndex]
  if (!currentQ) return null

  const currentCardState = progressMap[currentQ.card.id] || {
    level: 'new',
    correctStreak: 0,
  }

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4 space-y-6">
      {/* Header & Thanh tiến độ 3 màu */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Link
            href={`/sets/${setId}`}
            className={buttonVariants({
              variant: 'ghost',
              size: 'sm',
              className: 'text-muted-foreground hover:text-foreground gap-1.5',
            })}
          >
            <ArrowLeft className="size-4" /> Rời Chế độ Học
          </Link>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 gap-1.5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5">
              <Layers className="size-3.5" /> Vòng {roundNumber}
            </Badge>

            {streak > 1 && (
              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 gap-1 animate-pulse">
                <Flame className="size-3.5 fill-amber-500" /> {streak} liên tiếp
              </Badge>
            )}
          </div>
        </div>

        {/* Thanh tiến độ Mastery 3 màu */}
        <div className="space-y-1.5">
          <div className="h-2.5 w-full bg-muted/80 rounded-full overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${masteredPercent}%` }}
              className="bg-emerald-500 transition-all duration-300"
              title={`Đã thuộc: ${masteredCount}`}
            />
            <div
              style={{ width: `${learningPercent}%` }}
              className="bg-amber-500 transition-all duration-300"
              title={`Đang học: ${learningCount}`}
            />
            <div
              style={{ width: `${newPercent}%` }}
              className="bg-slate-300 dark:bg-slate-700 transition-all duration-300"
              title={`Chưa học: ${newCount}`}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" /> Thuộc: {masteredCount}
              </span>
              <span className="flex items-center gap-1 font-medium text-amber-500">
                <span className="size-1.5 rounded-full bg-amber-500" /> Đang học: {learningCount}
              </span>
              <span className="flex items-center gap-1 font-medium">
                <span className="size-1.5 rounded-full bg-slate-400" /> Mới: {newCount}
              </span>
            </div>
            <span className="font-semibold text-foreground">
              Câu {currentIndex + 1} / {currentQueue.length} (Vòng {roundNumber})
            </span>
          </div>
        </div>
      </div>

      {/* QUESTION CARD */}
      <Card className="border-border/80 shadow-xl shadow-indigo-500/5 overflow-hidden bg-card backdrop-blur-sm">
        {/* Question Header Bar */}
        <div className="px-6 py-3 bg-muted/40 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="text-xs font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-none"
            >
              {currentQ.promptTypeLabel}
            </Badge>

            {currentCardState.level === 'learning' && (
              <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5">
                Cấp độ 2 • Đang củng cố
              </Badge>
            )}
            {currentCardState.level === 'new' && (
              <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                Cấp độ 1 • Khởi đầu
              </Badge>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => speakText(currentQ.card.term)}
            className="size-8 rounded-full text-muted-foreground hover:text-foreground"
            title="Phát âm từ tiếng Anh"
          >
            <Volume2 className="size-4" />
          </Button>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Prompt Box */}
          <div className="min-h-[90px] flex flex-col justify-center">
            <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-1">
              {currentQ.type === 'mc_def_to_term' || currentQ.type === 'written'
                ? 'Định nghĩa:'
                : 'Thuật ngữ:'}
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-snug">
              {currentQ.prompt}
            </div>

            {/* Nếu là dạng Đúng / Sai -> Hiển thị thêm định nghĩa so sánh */}
            {currentQ.type === 'true_false' && (
              <div className="mt-4 p-4 rounded-xl bg-muted/50 border border-border/70 space-y-1">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Định nghĩa hiển thị:</div>
                <div className="text-lg font-medium text-foreground">{currentQ.tfDisplayDef}</div>
              </div>
            )}
          </div>

          {/* INTERACTION AREA (4 QUESTION TYPES) */}

          {/* DẠNG 1 & 2: TRẮC NGHIỆM 4 ĐÁP ÁN (XUÔI HOẶC NGƯỢC) */}
          {(currentQ.type === 'mc_term_to_def' || currentQ.type === 'mc_def_to_term') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {currentQ.options?.map((option, idx) => {
                let btnStyle = 'border-border/80 bg-card hover:bg-muted/60 hover:border-indigo-500/50'

                if (isAnswered) {
                  const isThisCorrect = option.trim() === currentQ.targetAnswer.trim()
                  const isThisSelected = option === selectedAnswer

                  if (isThisCorrect) {
                    btnStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold ring-2 ring-emerald-500/20'
                  } else if (isThisSelected && !isThisCorrect) {
                    btnStyle = 'border-destructive bg-destructive/10 text-destructive font-semibold ring-2 ring-destructive/20'
                  } else {
                    btnStyle = 'opacity-40 border-border'
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAnswer(option)}
                    disabled={isAnswered}
                    className={`relative p-4 rounded-xl border text-left transition-all duration-200 flex items-start gap-3 text-sm sm:text-base ${btnStyle}`}
                  >
                    <span className="size-6 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs shrink-0 border border-border/60">
                      {idx + 1}
                    </span>
                    <span className="flex-1 leading-relaxed">{option}</span>
                    {isAnswered && option.trim() === currentQ.targetAnswer.trim() && (
                      <CheckCircle2 className="size-5 text-emerald-500 shrink-0 mt-0.5" />
                    )}
                    {isAnswered && option === selectedAnswer && option.trim() !== currentQ.targetAnswer.trim() && (
                      <XCircle className="size-5 text-destructive shrink-0 mt-0.5" />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* DẠNG 3: ĐÚNG HAY SAI (TRUE / FALSE) */}
          {currentQ.type === 'true_false' && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              {[
                { label: 'Đúng (True)', value: 'true', keyNum: '1', shortcut: 'T' },
                { label: 'Sai (False)', value: 'false', keyNum: '2', shortcut: 'F' },
              ].map((btn) => {
                let btnStyle = 'border-border/80 bg-card hover:bg-muted/60'

                if (isAnswered) {
                  const isThisCorrect = btn.value === currentQ.targetAnswer
                  const isThisSelected = btn.value === selectedAnswer

                  if (isThisCorrect) {
                    btnStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold ring-2 ring-emerald-500/20'
                  } else if (isThisSelected && !isThisCorrect) {
                    btnStyle = 'border-destructive bg-destructive/10 text-destructive font-bold ring-2 ring-destructive/20'
                  } else {
                    btnStyle = 'opacity-40 border-border'
                  }
                }

                return (
                  <button
                    key={btn.value}
                    type="button"
                    onClick={() => handleAnswer(btn.value)}
                    disabled={isAnswered}
                    className={`h-16 rounded-2xl border text-center font-bold text-lg transition-all duration-200 flex items-center justify-center gap-3 ${btnStyle}`}
                  >
                    <span>{btn.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      {btn.shortcut}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* DẠNG 4: TỰ LUẬN NHỚ TỪ (WRITTEN RECALL) */}
          {currentQ.type === 'written' && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (writtenInput.trim()) handleAnswer(writtenInput.trim())
              }}
              className="space-y-4 pt-2"
            >
              <div className="relative">
                <Input
                  ref={writtenInputRef}
                  type="text"
                  placeholder="Gõ thuật ngữ chính xác..."
                  value={writtenInput}
                  onChange={(e) => setWrittenInput(e.target.value)}
                  disabled={isAnswered}
                  className="h-14 text-lg px-4 rounded-xl border-border focus-visible:ring-indigo-500 font-medium"
                />
              </div>

              {!isAnswered ? (
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAnswer('')}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    Tôi không biết (Bỏ qua)
                  </Button>
                  <Button
                    type="submit"
                    disabled={!writtenInput.trim()}
                    className="h-10 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-medium"
                  >
                    Kiểm tra
                  </Button>
                </div>
              ) : null}
            </form>
          )}

          {/* DẠNG 5: ĐIỀN TỪ VÀO CHỖ TRỐNG TRONG CÂU (INLINE SENTENCE CLOZE) */}
          {currentQ.type === 'cloze_fill_blank' && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (writtenInput.trim()) handleAnswer(writtenInput.trim())
              }}
              className="space-y-5 pt-2"
            >
              {/* Câu tiếng Anh có ô trống inline */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-card to-blue-500/10 border-2 border-indigo-500/30 text-lg sm:text-xl font-medium leading-loose">
                <span className="text-foreground">{currentQ.clozePrefix}</span>
                <span className="inline-block mx-2 align-baseline">
                  <input
                    ref={writtenInputRef}
                    type="text"
                    placeholder="[ ______ ]"
                    value={writtenInput}
                    onChange={(e) => setWrittenInput(e.target.value)}
                    disabled={isAnswered}
                    className="w-48 sm:w-56 h-11 text-center font-bold text-lg bg-background text-indigo-600 dark:text-indigo-400 border-2 border-indigo-500 shadow-md rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/30 transition-all placeholder:text-muted-foreground/50"
                  />
                </span>
                <span className="text-foreground">{currentQ.clozeSuffix}</span>
              </div>

              {/* Thông tin hỗ trợ & Gợi ý */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 rounded-xl border border-border/60 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span>Nghĩa tiếng Việt:</span>
                  <span className="font-bold text-foreground">{currentQ.prompt}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Gợi ý từ:</span>
                  <Badge variant="outline" className="font-mono text-xs border-indigo-500/30 bg-indigo-500/5">
                    {currentQ.letterHint}
                  </Badge>
                </div>
              </div>

              {!isAnswered ? (
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAnswer('')}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    Tôi không biết (Bỏ qua)
                  </Button>
                  <Button
                    type="submit"
                    disabled={!writtenInput.trim()}
                    className="h-11 px-8 text-base font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/25"
                  >
                    Kiểm tra đáp án
                  </Button>
                </div>
              ) : null}
            </form>
          )}

          {/* FEEDBACK & GIẢI THÍCH KHI ĐÃ TRẢ LỜI */}
          {isAnswered && (
            <div
              className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
                isCorrect
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  : 'bg-destructive/10 border-destructive/30 text-destructive'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-base sm:text-lg">
                    {isCorrect ? (
                      <>
                        <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
                        <span>Chính xác! Làm rất tốt! ✨</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="size-5 text-destructive shrink-0" />
                        <span>Chưa chính xác! Hãy ghi nhớ lại:</span>
                      </>
                    )}
                  </div>

                  {!isCorrect && (
                    <div className="pt-2 space-y-1 text-sm text-foreground">
                      <div>
                        <span className="font-semibold text-muted-foreground">Thuật ngữ: </span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{currentQ.card.term}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-muted-foreground">Định nghĩa: </span>
                        <span>{currentQ.card.definition}</span>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleNext}
                  className={`h-11 px-6 font-semibold shrink-0 shadow-md ${
                    isCorrect
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                  }`}
                >
                  Tiếp tục <ArrowRight className="size-4 ml-1.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
