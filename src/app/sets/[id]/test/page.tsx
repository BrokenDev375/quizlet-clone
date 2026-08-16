'use client'

import { useState, useEffect, use, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import {
  QuizQuestion,
  QuestionType,
  generateCustomTestQuestions,
  checkWrittenAnswer,
} from '@/lib/quiz/question-generator'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  FileCheck2,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  Sparkles,
  Volume2,
  Settings2,
  Check,
  Sliders,
  Filter,
  ArrowRight,
  HelpCircle,
  Flame,
} from 'lucide-react'

export default function TestModePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const setId = resolvedParams.id

  const [set, setSet] = useState<FlashcardSet | null>(null)
  const [allCards, setAllCards] = useState<CardType[]>([])
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentViewIndex, setCurrentViewIndex] = useState(0)

  // Config State (Màn hình thiết lập bài thi)
  const [isConfiguring, setIsConfiguring] = useState(true)
  const [questionCount, setQuestionCount] = useState(20)
  const [enabledTypes, setEnabledTypes] = useState<QuestionType[]>([
    'mc_term_to_def',
    'mc_def_to_term',
    'true_false',
    'written',
    'cloze_fill_blank',
  ])

  // Results State
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [resultFilter, setResultFilter] = useState<'all' | 'incorrect' | 'correct'>('all')
  const [loading, setLoading] = useState(true)

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

      if (cardsData && cardsData.length > 0) {
        setAllCards(cardsData)
        // Mặc định chọn số câu bằng số thẻ hoặc 20 câu
        setQuestionCount(Math.min(cardsData.length * 2, 40))
      }

      setLoading(false)
    }

    loadData()
  }, [setId])

  // Bắt đầu làm bài thi với cấu hình đã chọn
  const handleStartTest = () => {
    if (allCards.length === 0) return

    const generated = generateCustomTestQuestions(allCards, {
      questionCount,
      enabledTypes,
    })

    setQuestions(generated)
    setAnswers({})
    setSubmitted(false)
    setIsConfiguring(false)
    setCurrentViewIndex(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSelectAnswer = (qId: string, value: string) => {
    if (submitted) return
    setAnswers((prev) => ({
      ...prev,
      [qId]: value,
    }))
  }

  const toggleQuestionType = (type: QuestionType) => {
    if (enabledTypes.includes(type)) {
      if (enabledTypes.length > 1) {
        const nextTypes = enabledTypes.filter((t) => t !== type)
        setEnabledTypes(nextTypes)
        // Tự động điều chỉnh số câu nếu vượt quá max
        const newMax = allCards.length * nextTypes.length
        if (questionCount > newMax) setQuestionCount(newMax)
      }
    } else {
      setEnabledTypes([...enabledTypes, type])
    }
  }

  // Chấm điểm bài thi
  const handleSubmitTest = () => {
    let totalCorrect = 0

    const gradedQuestions = questions.map((q) => {
      const userAns = answers[q.id] || ''
      let isCorrect = false

      if (q.type === 'written' || q.type === 'cloze_fill_blank') {
        isCorrect = checkWrittenAnswer(userAns, q.targetAnswer)
      } else if (q.type === 'true_false') {
        isCorrect = userAns.toLowerCase() === q.targetAnswer.toLowerCase()
      } else {
        isCorrect = userAns.trim() === q.targetAnswer.trim()
      }

      if (isCorrect) totalCorrect++

      return {
        ...q,
        userResponse: userAns,
        isCorrect,
      }
    })

    setQuestions(gradedQuestions)
    setCorrectCount(totalCorrect)
    const finalScore = Math.round((totalCorrect / questions.length) * 100)
    setScore(finalScore)
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.95
    window.speechSynthesis.speak(utterance)
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="size-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Đang chuẩn bị đề thi...</p>
      </div>
    )
  }

  if (!set || allCards.length === 0) {
    return (
      <div className="container max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <FileCheck2 className="size-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold">Chưa có thẻ nào để tạo bài kiểm tra</h2>
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
  // MÀN HÌNH 1: THIẾT LẬP BÀI THI TÙY BIẾN (TEST CONFIGURATION SCREEN)
  // =========================================================================
  if (isConfiguring) {
    const maxUniqueQuestions = allCards.length * enabledTypes.length

    const quickCounts = [
      ...(maxUniqueQuestions >= 10 && allCards.length !== 10
        ? [{ count: Math.min(10, maxUniqueQuestions), label: '10 câu (Nhanh)' }]
        : []),
      { count: Math.min(allCards.length, maxUniqueQuestions), label: `Mỗi từ 1 câu (${allCards.length} câu)` },
      ...(maxUniqueQuestions >= allCards.length * 2
        ? [
            {
              count: allCards.length * 2,
              label: `Mỗi từ 2 dạng (${allCards.length * 2} câu)`,
            },
          ]
        : []),
      {
        count: maxUniqueQuestions,
        label: `Tối đa tất cả ${enabledTypes.length} dạng không trùng (${maxUniqueQuestions} câu)`,
      },
    ]

    return (
      <div className="container max-w-2xl mx-auto py-10 px-4 space-y-6 animate-in fade-in duration-200">
        <Link
          href={`/sets/${setId}`}
          className={buttonVariants({
            variant: 'ghost',
            size: 'sm',
            className: 'text-muted-foreground hover:text-foreground gap-1.5 mb-2',
          })}
        >
          <ArrowLeft className="size-4" /> Quay lại học phần
        </Link>

        <Card className="border-border/80 shadow-xl overflow-hidden bg-card backdrop-blur-sm">
          <CardHeader className="bg-muted/30 border-b border-border/60 pb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Settings2 className="size-6" />
              </div>
              <div>
                <CardTitle className="text-2xl">Thiết lập bài kiểm tra</CardTitle>
                <CardDescription>
                  Học phần: <span className="font-semibold text-foreground">{set.title}</span> ({allCards.length} từ vựng)
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8 space-y-8">
            {/* 1. Chọn số lượng câu hỏi */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  1. Số lượng câu hỏi trong đề thi
                </label>
                <Badge variant="outline" className="text-xs font-semibold border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                  Tối đa không trùng: {maxUniqueQuestions} câu
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {quickCounts.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setQuestionCount(item.count)}
                    className={`p-3.5 rounded-xl border text-left font-medium text-sm transition-all duration-200 flex items-center justify-between ${
                      questionCount === item.count
                        ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20 font-semibold'
                        : 'border-border bg-card hover:bg-muted/60'
                    }`}
                  >
                    <span>{item.label}</span>
                    {questionCount === item.count && <Check className="size-4" />}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs text-muted-foreground">Hoặc nhập số câu tự chọn:</span>
                <Input
                  type="number"
                  min={1}
                  max={maxUniqueQuestions}
                  value={questionCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1
                    setQuestionCount(Math.min(Math.max(1, val), maxUniqueQuestions))
                  }}
                  className="w-28 h-9 text-sm font-semibold"
                />
                <span className="text-xs text-muted-foreground">(Tối đa {maxUniqueQuestions} câu)</span>
              </div>
            </div>

            {/* 2. Chọn dạng câu hỏi */}
            <div className="space-y-3">
              <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                2. Các dạng câu hỏi xuất hiện
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    type: 'mc_term_to_def' as QuestionType,
                    title: 'Trắc nghiệm xuôi',
                    desc: 'Cho Từ vựng → Chọn Định nghĩa',
                  },
                  {
                    type: 'mc_def_to_term' as QuestionType,
                    title: 'Trắc nghiệm đảo ngược',
                    desc: 'Cho Định nghĩa → Chọn Từ vựng',
                  },
                  {
                    type: 'true_false' as QuestionType,
                    title: 'Đúng hay Sai?',
                    desc: 'Phán đoán phản xạ cặp từ',
                  },
                  {
                    type: 'written' as QuestionType,
                    title: 'Tự luận / Nhớ từ',
                    desc: 'Tự gõ chính xác từ vựng',
                  },
                  {
                    type: 'cloze_fill_blank' as QuestionType,
                    title: 'Điền vào chỗ trống trong câu',
                    desc: 'Điền từ vào câu ngữ cảnh có gợi ý',
                  },
                ].map((item) => {
                  const isEnabled = enabledTypes.includes(item.type)
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => toggleQuestionType(item.type)}
                      className={`p-4 rounded-xl border text-left transition-all duration-200 flex items-start justify-between ${
                        isEnabled
                          ? 'border-indigo-600 bg-indigo-500/10 text-foreground ring-2 ring-indigo-500/20'
                          : 'border-border bg-card opacity-50 hover:opacity-80'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-sm">{item.title}</div>
                        <div className="text-xs text-muted-foreground">{item.desc}</div>
                      </div>
                      <div
                        className={`size-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                          isEnabled
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-muted-foreground/40'
                        }`}
                      >
                        {isEnabled && <Check className="size-3.5" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <Button
              size="lg"
              onClick={handleStartTest}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-xl shadow-indigo-500/25 gap-2"
            >
              <Sparkles className="size-5" /> Bắt đầu làm bài thi ({Math.min(questionCount, maxUniqueQuestions)} câu không trùng)
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // =========================================================================
  // MÀN HÌNH 2: KẾT QUẢ VÀ XEM LẠI BÀI THI (TEST RESULTS & DETAILED REVIEW)
  // =========================================================================
  if (submitted) {
    const isPassing = score >= 70
    const filteredQuestions = questions.filter((q) => {
      if (resultFilter === 'correct') return q.isCorrect
      if (resultFilter === 'incorrect') return !q.isCorrect
      return true
    })

    return (
      <div className="container max-w-3xl mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-300">
        {/* Score Summary Card */}
        <Card className="border-border shadow-2xl p-6 sm:p-8 text-center space-y-6 bg-gradient-to-b from-card to-muted/30">
          <div
            className={`inline-flex size-20 rounded-full items-center justify-center mx-auto shadow-inner ring-8 ${
              isPassing
                ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20'
                : 'bg-amber-500/10 text-amber-500 ring-amber-500/20'
            }`}
          >
            <Trophy className="size-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Điểm số: <span className={isPassing ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}>{score}%</span>
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Bạn đã trả lời đúng <span className="font-bold text-foreground">{correctCount}</span> trên tổng số{' '}
              <span className="font-bold text-foreground">{questions.length} câu hỏi</span>.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button
              size="lg"
              variant="outline"
              onClick={() => setIsConfiguring(true)}
              className="gap-2"
            >
              <Settings2 className="size-4" /> Tùy chỉnh & Thi lại
            </Button>
            <Button
              size="lg"
              onClick={handleStartTest}
              className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20"
            >
              <RotateCcw className="size-4" /> Làm lại đề này
            </Button>
            <Link
              href={`/sets/${setId}`}
              className={buttonVariants({ size: 'lg', variant: 'ghost' })}
            >
              Về học phần
            </Link>
          </div>
        </Card>

        {/* Question Review Header & Filters */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileCheck2 className="size-5 text-indigo-600" />
              Chi tiết câu trả lời
            </h2>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border border-border">
              <Button
                size="sm"
                variant={resultFilter === 'all' ? 'secondary' : 'ghost'}
                onClick={() => setResultFilter('all')}
                className="h-8 text-xs font-semibold"
              >
                Tất cả ({questions.length})
              </Button>
              <Button
                size="sm"
                variant={resultFilter === 'incorrect' ? 'secondary' : 'ghost'}
                onClick={() => setResultFilter('incorrect')}
                className="h-8 text-xs font-semibold text-destructive"
              >
                Sai ({questions.length - correctCount})
              </Button>
              <Button
                size="sm"
                variant={resultFilter === 'correct' ? 'secondary' : 'ghost'}
                onClick={() => setResultFilter('correct')}
                className="h-8 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
              >
                Đúng ({correctCount})
              </Button>
            </div>
          </div>

          {/* List of reviewed questions */}
          <div className="space-y-4">
            {filteredQuestions.map((q, idx) => (
              <Card
                key={q.id}
                className={`border transition-all duration-200 ${
                  q.isCorrect
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-destructive/40 bg-destructive/5'
                }`}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs px-2 py-0.5 rounded bg-muted border border-border">
                        Câu {idx + 1}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {q.promptTypeLabel}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      {q.isCorrect ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="size-4" /> Chính xác
                        </span>
                      ) : (
                        <span className="text-destructive flex items-center gap-1">
                          <XCircle className="size-4" /> Chưa đúng
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-lg font-bold text-foreground">
                    {q.prompt}
                  </div>

                  {q.type === 'true_false' && (
                    <div className="text-sm text-muted-foreground">
                      Định nghĩa hiển thị: <span className="font-medium text-foreground">{q.tfDisplayDef}</span>
                    </div>
                  )}

                  {q.type === 'cloze_fill_blank' && (
                    <div className="text-xs text-muted-foreground italic">
                      {q.clozePrefix}
                      <span className="font-bold not-italic text-foreground">{q.prompt}</span>
                      {q.clozeSuffix} (Gợi ý: {q.letterHint})
                    </div>
                  )}

                  <div className="pt-2 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Bạn trả lời:</span>
                      <span className={`font-semibold ${q.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                        {q.userResponse || '(Bỏ trống)'}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-muted-foreground block">Đáp án chính xác:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {q.type === 'true_false'
                          ? q.targetAnswer === 'true'
                            ? 'Đúng'
                            : 'Sai'
                          : q.targetAnswer}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // MÀN HÌNH 3: GIAO DIỆN LÀM BÀI KIỂM TRA (ACTIVE TEST-TAKING INTERFACE)
  // =========================================================================
  const answeredCount = Object.keys(answers).length
  const progressPercent = Math.round((answeredCount / questions.length) * 100)

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4 space-y-6 pb-24">
      {/* Top sticky progress bar */}
      <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-md py-3 border-b border-border/80 space-y-2">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsConfiguring(true)}
            className="text-muted-foreground hover:text-foreground text-xs gap-1"
          >
            <ArrowLeft className="size-3.5" /> Thiết lập lại
          </Button>

          <span className="text-xs font-bold text-foreground">
            Đã làm: {answeredCount} / {questions.length} ({progressPercent}%)
          </span>

          <Button
            size="sm"
            onClick={handleSubmitTest}
            className="h-8 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-500/20"
          >
            Nộp bài thi
          </Button>
        </div>

        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            style={{ width: `${progressPercent}%` }}
            className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-300 rounded-full"
          />
        </div>
      </div>

      {/* Danh sách toàn bộ các câu hỏi trong đề thi */}
      <div className="space-y-6">
        {questions.map((q, idx) => {
          const userAns = answers[q.id] || ''

          return (
            <Card
              key={q.id}
              id={`question-${idx}`}
              className="border-border shadow-sm overflow-hidden bg-card"
            >
              {/* Question Header */}
              <div className="px-6 py-3 bg-muted/40 border-b border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-6 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <Badge variant="outline" className="text-xs font-semibold">
                    {q.promptTypeLabel}
                  </Badge>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => speakText(q.card.term)}
                  className="size-7 rounded-full text-muted-foreground hover:text-foreground"
                >
                  <Volume2 className="size-3.5" />
                </Button>
              </div>

              <CardContent className="p-6 space-y-5">
                {/* Question Prompt */}
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase text-muted-foreground">
                    {q.type === 'mc_def_to_term' || q.type === 'written' || q.type === 'cloze_fill_blank'
                      ? 'Định nghĩa:'
                      : 'Thuật ngữ:'}
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-foreground leading-snug">
                    {q.prompt}
                  </div>

                  {q.type === 'true_false' && (
                    <div className="mt-3 p-3.5 rounded-xl bg-muted/60 border border-border/60">
                      <span className="text-xs font-semibold uppercase text-muted-foreground block mb-0.5">
                        Định nghĩa hiển thị:
                      </span>
                      <span className="text-base font-medium text-foreground">{q.tfDisplayDef}</span>
                    </div>
                  )}

                  {q.type === 'cloze_fill_blank' && (
                    <div className="mt-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">Gợi ý độ dài:</span>
                        <Badge variant="outline" className="font-mono text-xs border-indigo-500/30">
                          {q.letterHint}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>

                {/* Question Inputs */}
                {/* 1. Trắc nghiệm 4 đáp án */}
                {(q.type === 'mc_term_to_def' || q.type === 'mc_def_to_term') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {q.options?.map((opt, optIdx) => {
                      const isSelected = userAns === opt
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectAnswer(q.id, opt)}
                          className={`p-3.5 rounded-xl border text-left font-medium text-sm transition-all duration-200 flex items-start gap-2.5 ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold ring-2 ring-indigo-500/20'
                              : 'border-border bg-card hover:bg-muted/60'
                          }`}
                        >
                          <span className="size-5 rounded-md bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0 border border-border/60">
                            {optIdx + 1}
                          </span>
                          <span className="flex-1 leading-snug">{opt}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* 2. Đúng hay Sai */}
                {q.type === 'true_false' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {[
                      { label: 'Đúng (True)', val: 'true' },
                      { label: 'Sai (False)', val: 'false' },
                    ].map((btn) => {
                      const isSelected = userAns === btn.val
                      return (
                        <button
                          key={btn.val}
                          type="button"
                          onClick={() => handleSelectAnswer(q.id, btn.val)}
                          className={`h-12 rounded-xl border font-bold text-sm transition-all duration-200 ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20'
                              : 'border-border bg-card hover:bg-muted/60'
                          }`}
                        >
                          {btn.label}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* 3. Tự luận / Điền từ vào chỗ trống */}
                {(q.type === 'written' || q.type === 'cloze_fill_blank') && (
                  <div className="pt-1">
                    <Input
                      type="text"
                      placeholder={
                        q.type === 'cloze_fill_blank'
                          ? 'Điền từ tương ứng...'
                          : 'Gõ câu trả lời chính xác...'
                      }
                      value={userAns}
                      onChange={(e) => handleSelectAnswer(q.id, e.target.value)}
                      className="h-12 text-base px-4 rounded-xl border-border focus-visible:ring-indigo-500 font-medium"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Bottom Submit Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4">
        <Button
          size="lg"
          onClick={handleSubmitTest}
          className="w-full h-14 text-base font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 hover:from-indigo-700 hover:to-blue-700 text-white shadow-2xl shadow-indigo-500/40 rounded-2xl gap-2"
        >
          <CheckCircle2 className="size-5" /> Nộp bài và xem điểm ({answeredCount}/{questions.length} câu đã làm)
        </Button>
      </div>
    </div>
  )
}
