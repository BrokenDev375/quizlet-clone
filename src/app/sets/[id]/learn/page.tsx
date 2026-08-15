'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Brain, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Trophy, 
  Sparkles, 
  ArrowRight,
  Volume2
} from 'lucide-react'

interface Question {
  card: CardType
  options: string[]
  correctAnswer: string
}

export default function LearnModePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const setId = resolvedParams.id

  const [set, setSet] = useState<FlashcardSet | null>(null)
  const [allCards, setAllCards] = useState<CardType[]>([])
  const [queue, setQueue] = useState<CardType[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [currentOptions, setCurrentOptions] = useState<string[]>([])
  const [correctCount, setCorrectCount] = useState(0)
  const [incorrectCards, setIncorrectCards] = useState<CardType[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
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
        // Shuffle queue
        const shuffled = [...cardsData].sort(() => Math.random() - 0.5)
        setQueue(shuffled)
      }

      setLoading(false)
    }

    loadData()
  }, [setId])

  // Generate options when current card changes
  useEffect(() => {
    if (queue.length > 0 && currentCardIndex < queue.length) {
      const current = queue[currentCardIndex]
      const otherCards = allCards.filter((c) => c.id !== current.id)
      const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5)
      const distractors = shuffledOthers.slice(0, 3).map((c) => c.definition)
      
      const options = [...distractors, current.definition].sort(() => Math.random() - 0.5)
      setCurrentOptions(options)
      setSelectedOption(null)
      setIsAnswered(false)
    } else if (queue.length > 0 && currentCardIndex >= queue.length) {
      setIsComplete(true)
    }
  }, [currentCardIndex, queue, allCards])

  const handleSelectOption = (option: string) => {
    if (isAnswered) return

    const current = queue[currentCardIndex]
    const correct = option === current.definition

    setSelectedOption(option)
    setIsCorrect(correct)
    setIsAnswered(true)

    if (correct) {
      setCorrectCount((prev) => prev + 1)
    } else {
      setIncorrectCards((prev) => [...prev, current])
    }
  }

  const handleNextQuestion = () => {
    setCurrentCardIndex((prev) => prev + 1)
  }

  const handleRestart = (onlyIncorrect = false) => {
    if (onlyIncorrect && incorrectCards.length > 0) {
      setQueue([...incorrectCards].sort(() => Math.random() - 0.5))
    } else {
      setQueue([...allCards].sort(() => Math.random() - 0.5))
    }
    setCurrentCardIndex(0)
    setCorrectCount(0)
    setIncorrectCards([])
    setIsComplete(false)
  }

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = /[à-ỹÀ-Ỹ]/.test(text) ? 'vi-VN' : 'en-US'
      window.speechSynthesis.speak(utterance)
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="inline-block size-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Đang chuẩn bị câu hỏi...</p>
      </div>
    )
  }

  if (allCards.length < 2) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold">Chưa đủ câu hỏi</h2>
        <p className="text-muted-foreground text-sm">Học phần này cần tối thiểu 2 thẻ để bắt đầu chế độ học.</p>
        <Link href={`/sets/${setId}`}>
          <Button>Quay lại học phần</Button>
        </Link>
      </div>
    )
  }

  const progressPercent = queue.length > 0 ? (currentCardIndex / queue.length) * 100 : 0
  const currentCard = queue[currentCardIndex]

  // Completion Screen
  if (isComplete) {
    const accuracy = Math.round((correctCount / queue.length) * 100) || 0

    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <Card className="border-border/80 text-center p-6 sm:p-10 shadow-xl bg-card/80 backdrop-blur-sm">
          <CardContent className="space-y-6">
            <div className="inline-flex size-20 rounded-full bg-gradient-to-tr from-amber-400 to-indigo-600 items-center justify-center text-white shadow-lg shadow-amber-500/25 mx-auto">
              <Trophy className="size-10" />
            </div>

            <div>
              <h2 className="text-3xl font-black tracking-tight">Xuất sắc! Bạn đã hoàn thành!</h2>
              <p className="text-sm text-muted-foreground mt-1">Kết quả ôn tập của bạn trong đợt học này</p>
            </div>

            <div className="grid grid-cols-3 gap-4 py-4 max-w-md mx-auto">
              <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <p className="text-2xl font-black text-foreground">{queue.length}</p>
                <p className="text-xs text-muted-foreground">Tổng số câu</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-2xl font-black text-emerald-600">{correctCount}</p>
                <p className="text-xs text-emerald-600/80 font-medium">Chính xác</p>
              </div>
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <p className="text-2xl font-black text-indigo-600">{accuracy}%</p>
                <p className="text-xs text-indigo-600/80 font-medium">Độ chính xác</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              {incorrectCards.length > 0 && (
                <Button
                  onClick={() => handleRestart(true)}
                  className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-medium"
                >
                  <RotateCcw className="size-4 mr-1.5" />
                  Ôn lại {incorrectCards.length} câu chưa nhớ
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => handleRestart(false)}
                className="w-full sm:w-auto font-medium"
              >
                <RotateCcw className="size-4 mr-1.5" />
                Học lại toàn bộ
              </Button>

              <Link href={`/sets/${setId}/test`} className="w-full sm:w-auto">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                  Làm bài kiểm tra ngay
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Header & Progress */}
      <div className="flex items-center justify-between">
        <Link
          href={`/sets/${setId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="size-4" />
          Thoát chế độ học
        </Link>
        <span className="text-xs font-bold text-muted-foreground">
          Câu {currentCardIndex + 1} / {queue.length}
        </span>
      </div>

      <Progress value={progressPercent} indicatorClassName="bg-indigo-600" />

      {/* Question Card */}
      {currentCard && (
        <div className="space-y-6">
          <Card className="border-border/80 bg-card p-6 sm:p-8 shadow-md">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
              <span className="font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Chọn định nghĩa đúng
              </span>
              <button
                onClick={() => handleSpeak(currentCard.term)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                title="Phát âm thuật ngữ"
              >
                <Volume2 className="size-4" />
              </button>
            </div>

            <div className="min-h-[100px] flex items-center justify-center text-center">
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
                {currentCard.term}
              </h2>
            </div>
          </Card>

          {/* Multiple Choice Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {currentOptions.map((option, idx) => {
              const isOptionCorrect = option === currentCard.definition
              const isOptionSelected = selectedOption === option

              let buttonStyle = "border-border/80 bg-card hover:border-indigo-500/50 hover:bg-muted/40 text-foreground"
              
              if (isAnswered) {
                if (isOptionCorrect) {
                  buttonStyle = "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs"
                } else if (isOptionSelected && !isOptionCorrect) {
                  buttonStyle = "border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold"
                } else {
                  buttonStyle = "border-border/40 opacity-40"
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(option)}
                  disabled={isAnswered}
                  className={`p-4 rounded-xl border text-left text-sm transition-all duration-200 flex items-start justify-between gap-3 ${buttonStyle}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="size-6 rounded-md bg-muted/80 text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="leading-snug">{option}</span>
                  </div>

                  {isAnswered && isOptionCorrect && (
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  {isAnswered && isOptionSelected && !isOptionCorrect && (
                    <XCircle className="size-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Feedback & Continue Bar */}
          {isAnswered && (
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
              isCorrect
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
            }`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="size-5 text-emerald-600" />
                    <span>Chính xác! Tiếp tục phát huy nhé!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-5 text-rose-600" />
                    <span>Chưa đúng! Đáp án đúng: <span className="underline font-bold ml-1">{currentCard.definition}</span></span>
                  </>
                )}
              </div>

              <Button
                onClick={handleNextQuestion}
                className={`font-semibold shrink-0 gap-1.5 text-white ${
                  isCorrect
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Tiếp tục <ArrowRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
