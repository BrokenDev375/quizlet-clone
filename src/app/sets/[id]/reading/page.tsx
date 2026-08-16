'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import {
  generateMultipleReadingPassages,
  ReadingPassage,
} from '@/lib/quiz/advanced-skills'
import { speakMultilingualText } from '@/lib/quiz/sentence-templates'
import { playSuccessChime, playRetryBeep } from '@/lib/quiz/speech-recognition'
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
  BookMarked,
  RotateCcw,
  Trophy,
  Layers,
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
  const [passages, setPassages] = useState<ReadingPassage[]>([])
  const [currentPassageIdx, setCurrentPassageIdx] = useState(0)

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
        const genPassages = generateMultipleReadingPassages(cardsData, setData.title)
        setPassages(genPassages)
      }

      setLoading(false)
    }

    loadData()
  }, [setId])

  const currentPassage = passages[currentPassageIdx]

  const handleSwitchPassage = (idx: number) => {
    setCurrentPassageIdx(idx)
    setSelectedWord(null)
    setShowTranslation(false)
    setSelectedAnswers({})
    setQuizSubmitted(false)
  }

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
    if (!currentPassage) return
    setQuizSubmitted(true)

    // Kiểm tra số câu đúng
    let correctCount = 0
    currentPassage.questions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        correctCount++
      }
    })

    if (correctCount === currentPassage.questions.length) {
      playSuccessChime()
    } else {
      playRetryBeep()
    }
  }

  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const handleGenerateAI = async () => {
    if (!set || cards.length === 0 || isGeneratingAI) return
    setIsGeneratingAI(true)
    setAiError(null)

    try {
      const res = await fetch('/api/ai/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards, setTitle: set.title }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Lỗi khi gọi Gemini AI')
      }

      const aiData = await res.json()

      const newPassage: ReadingPassage = {
        id: `ai_passage_${Date.now()}`,
        title: aiData.title || `Bài đọc AI: ${set.title}`,
        genre: aiData.genre || 'Sáng tác bởi Gemini AI',
        content: aiData.content,
        translation: aiData.translation,
        targetWords: cards.slice(0, 8).map((c) => ({
          term: c.term,
          phonetic: c.phonetic || undefined,
          definition: c.definition,
        })),
        questions: (aiData.questions || []).map((q: any, qIdx: number) => ({
          id: `ai_q_${qIdx}`,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex ?? 0,
          explanation: q.explanation || 'Đáp án chính xác.',
        })),
      }

      setPassages((prev) => [newPassage, ...prev])
      setCurrentPassageIdx(0)
      setSelectedAnswers({})
      setQuizSubmitted(false)
      setSelectedWord(null)
      setShowTranslation(false)
      playSuccessChime()
    } catch (err: any) {
      console.warn('AI reading generation fallback:', err)
      setAiError(err.message || 'Chưa cấu hình GEMINI_API_KEY')
    } finally {
      setIsGeneratingAI(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="size-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Đang chuẩn bị kho bài Đọc hiểu phong phú...</p>
      </div>
    )
  }

  if (!set || passages.length === 0 || !currentPassage) {
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

  const correctAnswersCount = currentPassage.questions.filter(
    (q) => selectedAnswers[q.id] === q.correctIndex
  ).length

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
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
            <p className="text-xs text-muted-foreground">Học phần: {set.title} ({passages.length} bài đọc)</p>
          </div>
        </div>

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
                Gemini đang viết...
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" /> ✨ Nhờ Gemini AI viết bài mới
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTranslation(!showTranslation)}
            className="text-xs gap-1.5"
          >
            {showTranslation ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {showTranslation ? 'Ẩn bản dịch' : 'Dịch toàn bài'}
          </Button>

          <Button
            size="sm"
            onClick={() => speakMultilingualText(currentPassage.content)}
            className="text-xs gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-medium shadow-md shadow-indigo-500/20"
          >
            <Volume2 className="size-3.5" /> Nghe
          </Button>
        </div>
      </div>

      {aiError && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-center justify-between">
          <span>⚠️ {aiError} (Hãy thêm <code>GEMINI_API_KEY=...</code> vào <code>.env.local</code> để sử dụng AI)</span>
          <button onClick={() => setAiError(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* Multi-Passage Selector Tabs */}
      {passages.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1">
              <Layers className="size-3.5" /> Chọn bài đọc chủ đề:
            </span>
            <span>{currentPassageIdx + 1} / {passages.length} bài</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {passages.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSwitchPassage(idx)}
                className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                  currentPassageIdx === idx
                    ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="text-xs font-bold uppercase truncate">{p.genre}</div>
                <div className="text-sm font-medium truncate text-foreground">Bài {idx + 1}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Reading Passage Card */}
      <Card className="border-border shadow-xl bg-card">
        <CardHeader className="bg-muted/30 border-b border-border/60 pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Badge variant="outline" className="text-xs font-semibold border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                {currentPassage.genre}
              </Badge>
              <CardTitle className="text-xl font-bold">{currentPassage.title}</CardTitle>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => speakMultilingualText(currentPassage.content)}
              className="gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold"
            >
              <Volume2 className="size-4" /> Phát âm
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Main Passage Text */}
          <div className="text-lg sm:text-xl font-medium text-foreground leading-loose">
            {currentPassage.content}
          </div>

          {showTranslation && (
            <div className="p-4 rounded-xl bg-muted/50 border border-border/60 text-sm text-muted-foreground leading-relaxed animate-in fade-in">
              <span className="font-bold text-foreground block text-xs mb-1 uppercase tracking-wider">
                Bản dịch tiếng Việt:
              </span>
              {currentPassage.translation}
            </div>
          )}

          {/* Quick Target Vocabulary Inspector Bar */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Từ vựng trọng tâm trong bài (Chạm vào từ để tra nghĩa & nghe phát âm):
            </span>

            <div className="flex flex-wrap gap-2">
              {currentPassage.targetWords.map((wordObj) => {
                const isSelected = selectedWord?.term === wordObj.term
                return (
                  <button
                    key={wordObj.term}
                    type="button"
                    onClick={() => handleWordClick(wordObj)}
                    className={`px-3.5 py-2 rounded-xl border text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${
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
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <HelpCircle className="size-5 text-indigo-600" />
            Bộ câu hỏi đọc hiểu ({currentPassage.questions.length} câu)
          </h2>

          {quizSubmitted && (
            <Badge className="text-xs font-bold bg-indigo-600 text-white">
              Đúng: {correctAnswersCount} / {currentPassage.questions.length} câu
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          {currentPassage.questions.map((q, qIdx) => {
            const userChoice = selectedAnswers[q.id]
            const isCorrect = userChoice === q.correctIndex

            return (
              <Card key={q.id} className="border-border bg-card">
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <p className="font-bold text-base text-foreground leading-snug">
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
                          className={`p-3.5 rounded-xl border text-left text-sm transition-all duration-200 leading-snug ${btnStyle}`}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>

                  {quizSubmitted && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                        isCorrect
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-destructive/10 border-destructive/30 text-destructive'
                      }`}
                    >
                      <span className="font-bold block mb-1">
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
            disabled={Object.keys(selectedAnswers).length < currentPassage.questions.length}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xl shadow-indigo-500/25"
          >
            Nộp câu trả lời Đọc hiểu ({Object.keys(selectedAnswers).length}/{currentPassage.questions.length} câu)
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setQuizSubmitted(false)
                setSelectedAnswers({})
              }}
              className="flex-1 gap-2"
            >
              <RotateCcw className="size-4" /> Làm lại bài này
            </Button>

            {currentPassageIdx < passages.length - 1 && (
              <Button
                size="lg"
                onClick={() => handleSwitchPassage(currentPassageIdx + 1)}
                className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 font-semibold"
              >
                Chuyển sang Bài {currentPassageIdx + 2} →
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
