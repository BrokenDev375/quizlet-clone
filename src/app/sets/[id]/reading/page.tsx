'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import { unpackCardContent } from '@/lib/quiz/card-serialization'
import {
  generateMultipleReadingPassages,
  ReadingPassage,
} from '@/lib/quiz/advanced-skills'
import { speakMultilingualText, isChineseText } from '@/lib/quiz/sentence-templates'
import { playSuccessChime, playRetryBeep } from '@/lib/quiz/speech-recognition'
import { pinyin } from 'pinyin-pro'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Search,
  Languages,
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
  const [showPinyin, setShowPinyin] = useState(true)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({})
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lookupInput, setLookupInput] = useState('')
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
        const genPassages = generateMultipleReadingPassages(unpacked, setData.title)
        setPassages(genPassages)
      }

      setLoading(false)
    }

    loadData()
  }, [setId])

  const currentPassage = passages[currentPassageIdx]
  const isZh = currentPassage ? isChineseText(currentPassage.content) : false

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

  // Tra cứu nghĩa từ vựng bất kỳ khi bấm kính lúp
  const handleQuickLookup = (textToFind: string) => {
    const clean = textToFind.trim()
    if (!clean) return

    // Tìm trong danh sách thẻ của học phần
    const foundCard = cards.find(
      (c) =>
        c.term.toLowerCase() === clean.toLowerCase() ||
        clean.toLowerCase().includes(c.term.toLowerCase()) ||
        c.term.toLowerCase().includes(clean.toLowerCase())
    )

    if (foundCard) {
      setSelectedWord({
        term: foundCard.term,
        phonetic: foundCard.phonetic || (isChineseText(foundCard.term) ? pinyin(foundCard.term) : undefined),
        definition: foundCard.definition,
      })
      speakMultilingualText(foundCard.term)
    } else {
      // Tự động sinh Pinyin cho chữ Hán nếu không khớp thẻ nào
      setSelectedWord({
        term: clean,
        phonetic: isChineseText(clean) ? pinyin(clean) : undefined,
        definition: 'Từ trong ngữ cảnh bài đọc (Bấm biểu tượng loa để nghe phát âm chuẩn)',
      })
      speakMultilingualText(clean)
    }
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
      setAiError(err.message || 'Lỗi khi gọi Gemini AI')
    } finally {
      setIsGeneratingAI(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="size-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Đang chuẩn bị phòng Đọc hiểu thông minh...</p>
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

  // Helper lấy chuỗi Pinyin đầy đủ cho câu/đoạn văn
  const getPinyinString = (text: string): string => {
    if (!text || !/[\u4e00-\u9fa5]/.test(text)) return ''
    try {
      return pinyin(text)
    } catch {
      return ''
    }
  }

  // Hàm render chữ Hán kèm thẻ <ruby> Pinyin phía trên ngữ cảnh thông minh
  const renderAnnotatedText = (
    text: string,
    options: { size?: 'sm' | 'md' | 'lg'; clickable?: boolean; forcePinyin?: boolean } = {}
  ) => {
    const { size = 'md', clickable = true, forcePinyin = false } = options
    const shouldShowPinyin = (isZh && showPinyin) || forcePinyin

    // Nếu không chứa chữ Hán, render text thuần
    if (!/[\u4e00-\u9fa5]/.test(text)) {
      return <span>{text}</span>
    }

    try {
      const tokens = pinyin(text, { type: 'all' }) as Array<{
        origin: string
        pinyin: string
        isZh: boolean
      }>

      const rtClass =
        size === 'lg'
          ? 'text-[11px] sm:text-xs font-normal text-indigo-600 dark:text-indigo-400 select-none pb-0.5'
          : size === 'sm'
          ? 'text-[9px] sm:text-[10px] font-normal text-indigo-600 dark:text-indigo-400 select-none pb-0.5'
          : 'text-[10px] sm:text-[11px] font-normal text-indigo-600 dark:text-indigo-400 select-none pb-0.5'

      return (
        <span className={shouldShowPinyin ? 'leading-[2.6] sm:leading-[3.0] inline' : 'inline'}>
          {tokens.map((token, i) => {
            const hasHanzi = /[\u4e00-\u9fa5]/.test(token.origin)
            if (hasHanzi && shouldShowPinyin && token.pinyin) {
              return (
                <ruby
                  key={i}
                  className={`mx-[0.5px] select-text transition ${
                    clickable ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400' : ''
                  }`}
                  onClick={(e) => {
                    if (clickable) {
                      e.stopPropagation()
                      handleQuickLookup(token.origin)
                    }
                  }}
                >
                  {token.origin}
                  <rt className={rtClass}>{token.pinyin}</rt>
                </ruby>
              )
            }

            if (hasHanzi && clickable) {
              return (
                <span
                  key={i}
                  className="cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition underline decoration-dotted decoration-indigo-400/40"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleQuickLookup(token.origin)
                  }}
                >
                  {token.origin}
                </span>
              )
            }

            return <span key={i}>{token.origin}</span>
          })}
        </span>
      )
    } catch {
      return <span>{text}</span>
    }
  }

  return (
    <div className="container max-w-3xl mx-auto py-6 px-4 space-y-6">
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
                Đang viết...
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" /> ✨ AI viết bài mới
              </>
            )}
          </Button>

          {/* Pinyin Toggle for Chinese */}
          {isZh && (
            <Button
              variant={showPinyin ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowPinyin(!showPinyin)}
              className="text-xs gap-1"
            >
              <Languages className="size-3.5 text-indigo-600" />
              {showPinyin ? 'Pinyin: BẬT' : 'Pinyin: TẮT'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTranslation(!showTranslation)}
            className="text-xs gap-1"
          >
            {showTranslation ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {showTranslation ? 'Ẩn dịch' : 'Dịch bài'}
          </Button>

          <Button
            size="sm"
            onClick={() => speakMultilingualText(currentPassage.content)}
            className="text-xs gap-1 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-medium shadow-md shadow-indigo-500/20"
          >
            <Volume2 className="size-3.5" /> Nghe
          </Button>
        </div>
      </div>

      {aiError && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-center justify-between">
          <span>⚠️ {aiError}</span>
          <button onClick={() => setAiError(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* Tinh gọn Bộ chọn chủ đề (Compact Horizontal Scroll Pills) */}
      {passages.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="font-bold text-muted-foreground shrink-0 flex items-center gap-1 pr-1">
            <Layers className="size-3.5 text-indigo-500" /> Chủ đề:
          </span>
          {passages.map((p, idx) => {
            const isActive = currentPassageIdx === idx
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSwitchPassage(idx)}
                className={`py-1.5 px-3 rounded-xl font-bold whitespace-nowrap shrink-0 transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30'
                    : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60'
                }`}
              >
                <span>Bài {idx + 1}: {p.genre}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Main Reading Passage Card */}
      <Card className="border-border shadow-xl bg-card">
        <CardHeader className="bg-muted/30 border-b border-border/60 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Badge variant="outline" className="text-[10px] font-semibold border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                {currentPassage.genre}
              </Badge>
              <CardTitle className="text-lg sm:text-xl font-bold">
                {renderAnnotatedText(currentPassage.title, { size: 'md', clickable: true })}
              </CardTitle>
            </div>

            {/* Quick Word Lookup Input Bar with Magnifying Glass */}
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tra từ..."
                  value={lookupInput}
                  onChange={(e) => setLookupInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleQuickLookup(lookupInput)
                  }}
                  className="h-8 w-28 sm:w-36 text-xs px-2.5 pr-7 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => handleQuickLookup(lookupInput)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-indigo-600"
                >
                  <Search className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Main Passage Text with Ruby Pinyin */}
          <div className="text-lg sm:text-xl font-medium text-foreground">
            {renderAnnotatedText(currentPassage.content, { size: 'lg', clickable: true })}
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
          <div className="space-y-2 pt-3 border-t border-border/60">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Search className="size-3 text-indigo-500" /> Chạm vào từ để tra nghĩa & nghe phát âm:
            </span>

            <div className="flex flex-wrap gap-2">
              {currentPassage.targetWords.map((wordObj) => {
                const isSelected = selectedWord?.term === wordObj.term
                return (
                  <button
                    key={wordObj.term}
                    type="button"
                    onClick={() => handleWordClick(wordObj)}
                    className={`px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
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

          {/* Selected Word Details Popup Card with Magnifying Glass Inspector */}
          {selectedWord && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-card to-blue-500/10 border-2 border-indigo-500/30 space-y-2 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                    <Search className="size-3.5" />
                  </div>
                  <span className="text-lg font-black text-foreground">{selectedWord.term}</span>
                  {selectedWord.phonetic && (
                    <Badge variant="outline" className="font-mono text-xs border-indigo-500/30 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400">
                      {selectedWord.phonetic}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => speakMultilingualText(selectedWord.term)}
                    className="gap-1 text-xs text-indigo-600 dark:text-indigo-400 h-8"
                  >
                    <Volume2 className="size-4" /> Phát âm
                  </Button>
                  <button
                    type="button"
                    onClick={() => setSelectedWord(null)}
                    className="text-xs text-muted-foreground hover:text-foreground font-bold px-2 py-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">
                Nghĩa: <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedWord.definition}</span>
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

        <div className="space-y-5">
          {currentPassage.questions.map((q, qIdx) => {
            const userChoice = selectedAnswers[q.id]
            const isAnswered = userChoice !== undefined
            const isCorrect = userChoice === q.correctIndex

            return (
              <Card key={q.id} className="border-border bg-card shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5 sm:p-6 space-y-4">
                  {/* Question Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[11px] font-bold border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                          Câu {qIdx + 1}
                        </Badge>
                        {isZh && (
                          <Badge variant="secondary" className="text-[10px] gap-1 font-mono">
                            <Languages className="size-3 text-indigo-500" /> Tiếng Trung
                          </Badge>
                        )}
                      </div>
                      <p className="font-bold text-base text-foreground leading-relaxed pt-0.5">
                        {renderAnnotatedText(q.question, { size: 'md', clickable: true })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => speakMultilingualText(q.question)}
                      className="size-8 text-muted-foreground hover:text-indigo-600 shrink-0 rounded-lg"
                      title="Nghe phát âm câu hỏi"
                    >
                      <Volume2 className="size-4" />
                    </Button>
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = userChoice === optIdx
                      const isCorrectOption = optIdx === q.correctIndex
                      const optPinyin = getPinyinString(opt)
                      const hasChinese = /[\u4e00-\u9fa5]/.test(opt)

                      let containerStyle = 'border-border/80 bg-card hover:bg-muted/50 hover:border-indigo-300 dark:hover:border-indigo-800'
                      if (quizSubmitted) {
                        if (isCorrectOption) {
                          containerStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-950 dark:text-emerald-50 shadow-sm ring-2 ring-emerald-500/20'
                        } else if (isSelected) {
                          containerStyle = 'border-rose-500 bg-rose-500/10 text-rose-950 dark:text-rose-50 shadow-sm ring-2 ring-rose-500/20'
                        } else {
                          containerStyle = 'border-border/60 bg-muted/20 opacity-75'
                        }
                      } else if (isSelected) {
                        containerStyle = 'border-indigo-600 bg-indigo-500/10 text-indigo-900 dark:text-indigo-100 font-semibold ring-2 ring-indigo-500/30'
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={quizSubmitted}
                          onClick={() => handleSelectOption(q.id, optIdx)}
                          className={`p-3.5 rounded-2xl border text-left text-sm transition-all duration-200 flex flex-col justify-between gap-2 relative group cursor-pointer disabled:cursor-default ${containerStyle}`}
                        >
                          <div className="flex items-start justify-between gap-2 w-full">
                            <div className="flex items-start gap-2.5 flex-1">
                              <span className={`size-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 border transition ${
                                quizSubmitted && isCorrectOption
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : quizSubmitted && isSelected
                                  ? 'bg-rose-600 text-white border-rose-600'
                                  : isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-muted text-muted-foreground border-border/80 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-950/50'
                              }`}>
                                {String.fromCharCode(65 + optIdx)}
                              </span>

                              <div className="flex-1 text-sm font-medium leading-relaxed">
                                {renderAnnotatedText(opt, { size: 'sm', clickable: true })}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {/* Option Voice Button */}
                              {hasChinese && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    speakMultilingualText(opt)
                                  }}
                                  className="size-7 rounded-lg text-muted-foreground hover:text-indigo-600 hover:bg-muted/80 flex items-center justify-center cursor-pointer transition"
                                  title="Nghe phát âm đáp án"
                                >
                                  <Volume2 className="size-3.5" />
                                </span>
                              )}

                              {/* Status Badges on Submit */}
                              {quizSubmitted && isCorrectOption && (
                                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] gap-1 py-0.5 px-2 font-bold shadow-sm">
                                  <CheckCircle2 className="size-3" /> Đáp án đúng
                                </Badge>
                              )}
                              {quizSubmitted && isSelected && !isCorrectOption && (
                                <Badge variant="destructive" className="text-[10px] gap-1 py-0.5 px-2 font-bold shadow-sm">
                                  <XCircle className="size-3" /> Bạn đã chọn
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Dedicated Pinyin Transcription line for Chinese options */}
                          {(quizSubmitted || isSelected) && optPinyin && (
                            <div className={`mt-1 text-xs font-mono px-2.5 py-1 rounded-xl flex items-center justify-between gap-2 border ${
                              quizSubmitted && isCorrectOption
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-200 font-semibold'
                                : quizSubmitted && isSelected
                                ? 'bg-rose-500/15 border-rose-500/30 text-rose-800 dark:text-rose-200 font-semibold'
                                : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                            }`}>
                              <span className="flex items-center gap-1.5 truncate">
                                <span className="opacity-70">🗣️ Pinyin:</span>
                                <span className="font-bold">{optPinyin}</span>
                              </span>
                              <span
                                onClick={(e) => {
                                  e.stopPropagation()
                                  speakMultilingualText(opt)
                                }}
                                className="text-[11px] opacity-75 hover:opacity-100 hover:underline shrink-0 cursor-pointer font-sans"
                              >
                                Nghe
                              </span>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Feedback and Explanation Section upon Submission */}
                  {quizSubmitted && (
                    <div className="space-y-3 pt-2">
                      {/* Result Status Banner */}
                      <div className={`p-3.5 rounded-2xl flex items-start gap-3 border ${
                        isCorrect
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
                      }`}>
                        {isCorrect ? (
                          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="size-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1 flex-1 text-xs sm:text-sm">
                          <p className="font-bold">
                            {isCorrect
                              ? '🎉 Chính xác! Bạn đã chọn đúng đáp án.'
                              : `❌ Chưa chính xác! Đáp án đúng là lựa chọn ${String.fromCharCode(65 + q.correctIndex)}.`}
                          </p>
                          {!isCorrect && (
                            <p className="text-muted-foreground text-xs leading-relaxed">
                              Đáp án đúng:{' '}
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                {q.options[q.correctIndex]}
                              </span>
                              {getPinyinString(q.options[q.correctIndex]) && (
                                <span className="font-mono ml-1.5 opacity-90">
                                  ({getPinyinString(q.options[q.correctIndex])})
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Detailed Explanation Box */}
                      {q.explanation && (
                        <div className="p-4 rounded-2xl bg-muted/60 border border-border/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-1.5">
                              💡 Giải thích chi tiết & Phân tích ngữ cảnh:
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => speakMultilingualText(q.explanation)}
                              className="h-7 text-xs text-indigo-600 dark:text-indigo-400 gap-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                            >
                              <Volume2 className="size-3.5" /> Nghe giải thích
                            </Button>
                          </div>
                          <div className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                            {renderAnnotatedText(q.explanation, { size: 'sm', clickable: true })}
                          </div>
                        </div>
                      )}
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
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-base shadow-lg shadow-indigo-500/25 cursor-pointer hover:scale-[1.01] transition-transform"
          >
            Nộp bài & Kiểm tra đáp án
          </Button>
        ) : (
          <div className="p-6 rounded-2xl bg-gradient-to-b from-card to-muted/40 border border-border text-center space-y-4">
            <Trophy className="size-12 text-indigo-600 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-xl font-black">
                Kết quả: {correctAnswersCount} / {currentPassage.questions.length} câu đúng
              </h3>
              <p className="text-sm text-muted-foreground">
                {correctAnswersCount === currentPassage.questions.length
                  ? '🎉 Xuất sắc! Bạn đã hiểu toàn bộ bài đọc và trả lời đúng 100%!'
                  : '💪 Bạn hãy xem lại phiên âm Pinyin và phần giải thích chi tiết phía trên để rút kinh nghiệm nhé!'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                onClick={() => {
                  setSelectedAnswers({})
                  setQuizSubmitted(false)
                }}
                variant="outline"
                className="gap-2 font-bold cursor-pointer"
              >
                <RotateCcw className="size-4" /> Làm lại bài trắc nghiệm này
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

