'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  FileCheck2, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Trophy, 
  Sparkles,
  HelpCircle
} from 'lucide-react'

interface TestQuestion {
  id: string
  card: CardType
  type: 'multiple_choice' | 'true_false' | 'written'
  questionText: string
  options?: string[]
  tfDefinition?: string
  isActuallyTrue?: boolean
  userAnswer?: string
  isCorrect?: boolean
}

export default function TestModePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const setId = resolvedParams.id

  const [set, setSet] = useState<FlashcardSet | null>(null)
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
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
        buildTestQuestions(cardsData)
      }

      setLoading(false)
    }

    loadData()
  }, [setId])

  const buildTestQuestions = (cards: CardType[]) => {
    const shuffledCards = [...cards].sort(() => Math.random() - 0.5)
    const generated: TestQuestion[] = []

    shuffledCards.forEach((card, idx) => {
      // Cycle through question types if sufficient cards
      const typeIndex = idx % 3
      const otherCards = cards.filter((c) => c.id !== card.id)

      if (typeIndex === 0 && otherCards.length >= 1) {
        // True / False
        const isTrue = Math.random() > 0.5
        const randomOther = otherCards[Math.floor(Math.random() * otherCards.length)]
        const displayDef = isTrue ? card.definition : randomOther.definition

        generated.push({
          id: card.id + '_tf',
          card,
          type: 'true_false',
          questionText: card.term,
          tfDefinition: displayDef,
          isActuallyTrue: isTrue,
          userAnswer: '',
        })
      } else if (typeIndex === 1 && otherCards.length >= 3) {
        // Multiple Choice
        const distractors = [...otherCards].sort(() => Math.random() - 0.5).slice(0, 3).map((c) => c.definition)
        const options = [...distractors, card.definition].sort(() => Math.random() - 0.5)

        generated.push({
          id: card.id + '_mc',
          card,
          type: 'multiple_choice',
          questionText: card.term,
          options,
          userAnswer: '',
        })
      } else {
        // Written Question
        generated.push({
          id: card.id + '_w',
          card,
          type: 'written',
          questionText: card.term,
          userAnswer: '',
        })
      }
    })

    setQuestions(generated)
    setSubmitted(false)
    setScore(0)
  }

  const handleAnswerChange = (qIndex: number, answer: string) => {
    if (submitted) return
    const updated = [...questions]
    updated[qIndex].userAnswer = answer
    setQuestions(updated)
  }

  const handleSubmitTest = () => {
    let totalCorrect = 0
    const evaluated = questions.map((q) => {
      let isCorrect = false

      if (q.type === 'true_false') {
        const expected = q.isActuallyTrue ? 'true' : 'false'
        isCorrect = q.userAnswer?.toLowerCase() === expected
      } else if (q.type === 'multiple_choice') {
        isCorrect = q.userAnswer === q.card.definition
      } else if (q.type === 'written') {
        const cleanUser = q.userAnswer?.trim().toLowerCase() || ''
        const cleanCorrect = q.card.definition.trim().toLowerCase()
        isCorrect = cleanUser === cleanCorrect || cleanCorrect.includes(cleanUser) && cleanUser.length > 2
      }

      if (isCorrect) totalCorrect++
      return { ...q, isCorrect }
    })

    setQuestions(evaluated)
    setScore(totalCorrect)
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="inline-block size-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Đang khởi tạo bài kiểm tra...</p>
      </div>
    )
  }

  const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <Link
            href={`/sets/${setId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2 transition"
          >
            <ArrowLeft className="size-4" />
            Quay lại học phần
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Bài kiểm tra: {set?.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">Tổng cộng {questions.length} câu hỏi</p>
        </div>

        {submitted && (
          <Button
            onClick={() => set?.id && buildTestQuestions(questions.map((q) => q.card))}
            variant="outline"
            className="gap-1.5"
          >
            <RotateCcw className="size-4" />
            Làm lại bài thi mới
          </Button>
        )}
      </div>

      {/* Result Card when Submitted */}
      {submitted && (
        <Card className="border-indigo-500/30 bg-gradient-to-br from-card to-indigo-500/5 p-6 sm:p-8 shadow-lg">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
            <div className="space-y-2">
              <Badge variant={percentage >= 80 ? 'success' : percentage >= 50 ? 'indigo' : 'destructive'} className="text-sm px-3 py-1">
                {percentage >= 80 ? 'Xuất sắc' : percentage >= 50 ? 'Đạt yêu cầu' : 'Cần ôn thêm'}
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-black">
                Điểm số của bạn: {score} / {questions.length} ({percentage}%)
              </h2>
              <p className="text-sm text-muted-foreground">
                Xem lại đáp án chi tiết của từng câu bên dưới để củng cố kiến thức.
              </p>
            </div>

            <div className="size-24 rounded-full border-4 border-indigo-600 flex items-center justify-center font-black text-2xl text-indigo-600 bg-background shadow-inner shrink-0">
              {percentage}%
            </div>
          </CardContent>
        </Card>
      )}

      {/* Questions List */}
      <div className="space-y-6">
        {questions.map((q, idx) => (
          <Card
            key={q.id}
            className={`border-border/80 transition ${
              submitted
                ? q.isCorrect
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-rose-500/50 bg-rose-500/5'
                : 'hover:border-indigo-500/30'
            }`}
          >
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Câu hỏi {idx + 1} • {q.type === 'multiple_choice' ? 'Trắc nghiệm' : q.type === 'true_false' ? 'Đúng / Sai' : 'Tự luận'}
                </span>
                {submitted && (
                  q.isCorrect ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="size-4" /> Chính xác
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                      <XCircle className="size-4" /> Sai
                    </span>
                  )
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Thuật ngữ:</p>
                <h3 className="text-lg font-bold text-foreground mt-0.5">{q.questionText}</h3>
              </div>

              {/* 1. TRUE / FALSE TYPE */}
              {q.type === 'true_false' && (
                <div className="space-y-3 pt-2">
                  <div className="p-3 rounded-lg bg-muted/40 text-sm">
                    <span className="font-semibold text-muted-foreground">Định nghĩa hiển thị: </span>
                    <span>{q.tfDefinition}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={submitted}
                      onClick={() => handleAnswerChange(idx, 'true')}
                      className={`p-3 rounded-lg border text-sm font-semibold transition ${
                        q.userAnswer === 'true'
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      ✓ Đúng
                    </button>
                    <button
                      type="button"
                      disabled={submitted}
                      onClick={() => handleAnswerChange(idx, 'false')}
                      className={`p-3 rounded-lg border text-sm font-semibold transition ${
                        q.userAnswer === 'false'
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      ✕ Sai
                    </button>
                  </div>
                </div>
              )}

              {/* 2. MULTIPLE CHOICE TYPE */}
              {q.type === 'multiple_choice' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  {q.options?.map((opt, optIdx) => (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={submitted}
                      onClick={() => handleAnswerChange(idx, opt)}
                      className={`p-3 rounded-lg border text-left text-sm transition flex items-start gap-2.5 ${
                        q.userAnswer === opt
                          ? 'border-indigo-600 bg-indigo-600 text-white font-medium'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <span className="size-5 rounded bg-muted/80 text-foreground text-xs font-bold flex items-center justify-center shrink-0">
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 3. WRITTEN TYPE */}
              {q.type === 'written' && (
                <div className="space-y-2 pt-2">
                  <Input
                    placeholder="Gõ câu trả lời của bạn..."
                    value={q.userAnswer || ''}
                    onChange={(e) => handleAnswerChange(idx, e.target.value)}
                    disabled={submitted}
                    className="bg-background"
                  />
                </div>
              )}

              {/* Solution feedback when submitted */}
              {submitted && !q.isCorrect && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-200 mt-3">
                  <span className="font-bold">Đáp án chính xác: </span>
                  {q.card.definition}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submit Button */}
      {!submitted && (
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSubmitTest}
            size="lg"
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold px-8 shadow-lg shadow-indigo-500/25"
          >
            Nộp bài kiểm tra
          </Button>
        </div>
      )}
    </div>
  )
}
