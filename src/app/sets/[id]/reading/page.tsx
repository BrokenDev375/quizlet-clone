'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import {
  generateReadingFromCards,
  ReadingPassage,
} from '@/lib/quiz/advanced-skills'
import { speakMultilingualText } from '@/lib/quiz/sentence-templates'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BookOpenText,
  Volume2,
  ArrowLeft,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react'

export default function ReadingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const setId = resolvedParams.id

  const [set, setSet] = useState<FlashcardSet | null>(null)
  const [cards, setCards] = useState<(CardType & { phonetic?: string; example_sentence?: string })[]>([])
  const [passage, setPassage] = useState<ReadingPassage | null>(null)
  const [selectedWord, setSelectedWord] = useState<{
    term: string
    phonetic?: string
    definition: string
  } | null>(null)
  const [showTranslation, setShowTranslation] = useState(false)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)

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
        const genPassage = generateReadingFromCards(cardsData, setData.title)
        setPassage(genPassage)
      }

      setLoading(false)
    }

    loadData()
  }, [setId])

  const handleWordClick = (wordObj: { term: string; phonetic?: string; definition: string }) => {
    setSelectedWord(wordObj)
    speakMultilingualText(wordObj.term)
  }

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (quizSubmitted) return
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }))
  }

  const handleSubmitQuiz = () => {
    setQuizSubmitted(true)
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="size-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Đang chuẩn bị bài Đọc hiểu...</p>
      </div>
    )
  }

  if (!set || !passage) {
    return (
      <div className="container max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <BookOpenText className="size-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold">Học phần này chưa có dữ liệu để tạo bài đọc</h2>
        <Link
          href={`/sets/${setId}`}
          className={buttonVariants({ variant: 'default' })}
        >
          Quay lại học phần
        </Link>
      </div>
    )
  }

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4 space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/sets/${setId}`}
            className={buttonVariants({
              variant: 'ghost',
              size: 'icon',
              className: 'rounded-full size-9 text-muted-foreground hover:text-foreground',
            })}
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Đọc hiểu ngữ cảnh</h1>
            <p className="text-xs text-muted-foreground">Học phần: {set.title}</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTranslation(!showTranslation)}
          className="text-xs gap-1.5"
        >
          {showTranslation ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {showTranslation ? 'Ẩn dịch nghĩa' : 'Dịch toàn bài'}
        </Button>
      </div>

      {/* Reading Passage Card */}
      <Card className="border-border shadow-xl bg-card">
        <CardHeader className="bg-muted/30 border-b border-border/60 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold">{passage.title}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => speakMultilingualText(passage.content)}
              className="gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold"
            >
              <Volume2 className="size-4" /> Nghe bài đọc
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Main Passage Text */}
          <div className="text-lg sm:text-xl font-medium text-foreground leading-relaxed">
            {passage.content}
          </div>

          {showTranslation && (
            <div className="p-4 rounded-xl bg-muted/50 border border-border/60 text-sm text-muted-foreground leading-relaxed animate-in fade-in">
              <span className="font-bold text-foreground block text-xs mb-1 uppercase tracking-wider">
                Bản dịch tiếng Việt:
              </span>
              {passage.translation}
            </div>
          )}

          {/* Quick Target Vocabulary Inspector Bar */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Từ vựng trọng tâm trong bài (Bấm để tra nghĩa & nghe phát âm):
            </span>

            <div className="flex flex-wrap gap-2">
              {passage.targetWords.map((wordObj) => {
                const isSelected = selectedWord?.term === wordObj.term
                return (
                  <button
                    key={wordObj.term}
                    type="button"
                    onClick={() => handleWordClick(wordObj)}
                    className={`px-3 py-1.5 rounded-xl border text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-500/30'
                        : 'bg-indigo-500/5 hover:bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                    }`}
                  >
                    <span>{wordObj.term}</span>
                    <Volume2 className="size-3.5 opacity-70" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected Word Details Popup Card */}
          {selectedWord && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-card to-blue-500/10 border-2 border-indigo-500/30 space-y-2 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-foreground">{selectedWord.term}</span>
                  {selectedWord.phonetic && (
                    <Badge variant="outline" className="font-mono text-xs border-indigo-500/30 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400">
                      {selectedWord.phonetic}
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => speakMultilingualText(selectedWord.term)}
                  className="gap-1 text-xs text-indigo-600 dark:text-indigo-400"
                >
                  <Volume2 className="size-4" /> Phát âm
                </Button>
              </div>
              <p className="text-sm font-medium text-foreground">
                Định nghĩa: <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedWord.definition}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comprehension Quiz Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <HelpCircle className="size-5 text-indigo-600" />
          Câu hỏi kiểm tra độ hiểu bài ({passage.questions.length} câu)
        </h2>

        <div className="space-y-4">
          {passage.questions.map((q, qIdx) => {
            const userChoice = selectedAnswers[q.id]
            const isCorrect = userChoice === q.correctIndex

            return (
              <Card key={q.id} className="border-border bg-card">
                <CardContent className="p-5 space-y-4">
                  <p className="font-bold text-base text-foreground">
                    Câu {qIdx + 1}: {q.question}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = userChoice === optIdx

                      let btnStyle = 'border-border bg-card hover:bg-muted/60'
                      if (quizSubmitted) {
                        if (optIdx === q.correctIndex) {
                          btnStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold'
                        } else if (isSelected) {
                          btnStyle = 'border-destructive bg-destructive/10 text-destructive font-bold'
                        }
                      } else if (isSelected) {
                        btnStyle = 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold ring-2 ring-indigo-500/20'
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={quizSubmitted}
                          onClick={() => handleSelectOption(q.id, optIdx)}
                          className={`p-3 rounded-xl border text-left text-sm transition-all duration-200 ${btnStyle}`}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>

                  {quizSubmitted && (
                    <div
                      className={`p-3 rounded-xl border text-xs ${
                        isCorrect
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-destructive/10 border-destructive/30 text-destructive'
                      }`}
                    >
                      <span className="font-bold block mb-0.5">
                        {isCorrect ? '✅ Chính xác!' : '❌ Chưa đúng!'}
                      </span>
                      {q.explanation}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {!quizSubmitted ? (
          <Button
            size="lg"
            onClick={handleSubmitQuiz}
            disabled={Object.keys(selectedAnswers).length < passage.questions.length}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xl shadow-indigo-500/25"
          >
            Nộp câu trả lời Đọc hiểu
          </Button>
        ) : (
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setQuizSubmitted(false)
              setSelectedAnswers({})
            }}
            className="w-full"
          >
            Làm lại bài đọc
          </Button>
        )}
      </div>
    </div>
  )
}
