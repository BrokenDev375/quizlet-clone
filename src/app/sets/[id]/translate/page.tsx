'use client'

import { useState, useEffect, use, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import { fetchAllCards } from '@/lib/quiz/cards-service'
import { getStudySession, saveStudySession } from '@/lib/quiz/study-session'
import { speakMultilingualText, isChineseText } from '@/lib/quiz/sentence-templates'
import { playSuccessChime, playRetryBeep, calculateLevenshteinDistance } from '@/lib/quiz/speech-recognition'
import { TranslateExercise } from '@/app/api/ai/translate/route'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import {
  Languages,
  ArrowLeft,
  Volume2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Lightbulb,
  ArrowRight,
  BookOpen,
  Send,
  Loader2,
  PlusCircle,
  HelpCircle,
  Trophy,
} from 'lucide-react'

const BATCH_SIZE = 10

export default function TranslatePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const setId = resolvedParams.id
  const router = useRouter()
  const supabase = createClient()

  const [set, setSet] = useState<FlashcardSet | null>(null)
  const [allCards, setAllCards] = useState<CardType[]>([])
  const [loading, setLoading] = useState(true)
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0)

  // AI Exercises state
  const [exercises, setExercises] = useState<TranslateExercise[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loadingAI, setLoadingAI] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // User input & evaluation
  const [userTranslation, setUserTranslation] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showHints, setShowHints] = useState(false)
  const [showPinyinHint, setShowPinyinHint] = useState(false)
  const [evaluation, setEvaluation] = useState<{
    hasKeyword: boolean
    similarityPercent: number
    message: string
  } | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 1. Tải thông tin học phần và toàn bộ thẻ
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

      try {
        const cardsData = await fetchAllCards(supabase, setId)
        if (cardsData && cardsData.length > 0) {
          setAllCards(cardsData)

          // Khôi phục tiến độ đã lưu
          try {
            const session = await getStudySession(setId)
            if (session && session.last_mode === 'translate') {
              const bIdx = session.last_batch_index ?? 0
              const cIdx = session.last_card_index ?? 0
              setCurrentBatchIndex(bIdx)
              loadBatchExercises(cardsData, bIdx, setData.title, cIdx)
            } else {
              loadBatchExercises(cardsData, 0, setData.title, 0)
            }
          } catch (e) {
            loadBatchExercises(cardsData, 0, setData.title, 0)
          }
        }
      } catch (err: any) {
        console.error('Lỗi khi nạp dữ liệu thẻ:', err)
      }

      setLoading(false)
    }

    loadData()
  }, [setId])

  // 2. Sinh câu dài bằng AI theo từng đợt (batch 10 từ)
  const loadBatchExercises = async (
    cardsList: CardType[],
    batchIdx: number,
    title?: string,
    initialCardIdx = 0
  ) => {
    setLoadingAI(true)
    setAiError(null)
    setIsSubmitted(false)
    setUserTranslation('')
    setEvaluation(null)
    setShowHints(false)
    setShowPinyinHint(false)
    setIsCompleted(false)

    const start = batchIdx * BATCH_SIZE
    const end = start + BATCH_SIZE
    const activeBatchCards = cardsList.slice(start, end)

    if (activeBatchCards.length === 0) {
      setLoadingAI(false)
      return
    }

    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: activeBatchCards,
          setTitle: title || set?.title,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.exercises || data.exercises.length === 0) {
        throw new Error(data.error || 'Không thể tạo bài tập dịch câu từ AI.')
      }

      setExercises(data.exercises)
      const validIndex = Math.min(initialCardIdx, data.exercises.length - 1)
      setCurrentIndex(Math.max(0, validIndex))
    } catch (err: any) {
      console.error('Lỗi tạo bài tập AI:', err)
      setAiError(err.message || 'Lỗi khi kết nối với mô hình AI. Vui lòng bấm thử lại!')
    } finally {
      setLoadingAI(false)
    }
  }

  // 3. Xử lý chuyển chặng (Batch)
  const handleSelectBatch = (batchIdx: number) => {
    setCurrentBatchIndex(batchIdx)
    loadBatchExercises(allCards, batchIdx, set?.title, 0)
    saveStudySession({ setId, mode: 'translate', cardIndex: 0, batchIndex: batchIdx })
  }

  // Chèn nhanh từ khóa vào vị trí con trỏ trong ô nhập
  const handleInsertKeyword = (keyword: string) => {
    if (!textareaRef.current) {
      setUserTranslation((prev) => prev + keyword)
      return
    }
    const elem = textareaRef.current
    const start = elem.selectionStart
    const end = elem.selectionEnd
    const text = elem.value
    const newText = text.substring(0, start) + keyword + text.substring(end)
    setUserTranslation(newText)
    setTimeout(() => {
      elem.focus()
      elem.setSelectionRange(start + keyword.length, start + keyword.length)
    }, 0)
  }

  // 4. Kiểm tra & chấm điểm bản dịch
  const handleSubmitTranslation = () => {
    if (!userTranslation.trim() || isSubmitted || !exercises[currentIndex]) return

    const currentEx = exercises[currentIndex]
    const userText = userTranslation.trim().replace(/\s+/g, '')
    const targetText = currentEx.chineseSentence.trim().replace(/\s+/g, '')

    // Kiểm tra xem câu của người dùng có chứa từ khóa không
    const hasKeyword = userText.includes(currentEx.keyword.trim().replace(/\s+/g, ''))

    // Tính mức độ tương đồng
    const dist = calculateLevenshteinDistance(userText, targetText)
    const maxLen = Math.max(userText.length, targetText.length)
    const similarity = maxLen > 0 ? Math.round(((maxLen - dist) / maxLen) * 100) : 0

    let message = ''
    if (similarity >= 85) {
      message = 'Bản dịch xuất sắc! Câu văn rất chuẩn xác và tự nhiên.'
    } else if (hasKeyword && similarity >= 50) {
      message = 'Khá tốt! Bạn đã sử dụng chính xác từ khóa trong câu.'
    } else if (hasKeyword) {
      message = 'Đã dùng đúng từ khóa, nhưng cấu trúc câu có thể trau chuốt thêm theo câu mẫu.'
    } else {
      message = `Lưu ý: Bản dịch chưa chứa từ khóa bắt buộc "${currentEx.keyword}". Hãy tham khảo câu mẫu bên dưới!`
    }

    setEvaluation({
      hasKeyword,
      similarityPercent: Math.max(0, similarity),
      message,
    })
    setIsSubmitted(true)

    if (hasKeyword && similarity >= 50) {
      playSuccessChime()
    } else {
      playRetryBeep()
    }
  }

  // 5. Chuyển sang câu tiếp theo
  const handleNextExercise = () => {
    if (currentIndex < exercises.length - 1) {
      const nextIdx = currentIndex + 1
      setCurrentIndex(nextIdx)
      setUserTranslation('')
      setIsSubmitted(false)
      setEvaluation(null)
      setShowHints(false)
      setShowPinyinHint(false)
      saveStudySession({ setId, mode: 'translate', cardIndex: nextIdx, batchIndex: currentBatchIndex })
    } else {
      setIsCompleted(true)
    }
  }

  const handleRetryExercise = () => {
    setIsSubmitted(false)
    setEvaluation(null)
    textareaRef.current?.focus()
  }

  const totalBatches = Math.ceil(allCards.length / BATCH_SIZE)
  const currentEx = exercises[currentIndex]

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="inline-block size-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-muted-foreground">Đang nạp dữ liệu học phần...</p>
      </div>
    )
  }

  if (!set || allCards.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Không tìm thấy từ vựng nào trong học phần này.</p>
        <Link href={`/sets/${setId}`} className={buttonVariants({ className: 'mt-4' })}>
          Quay lại học phần
        </Link>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 sm:py-8 px-4 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/sets/${setId}`}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Languages className="size-4" />
              </span>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                Luyện Dịch Câu Dài Việt $\to$ Trung
              </h1>
            </div>
            <p className="text-xs text-muted-foreground truncate max-w-md">
              {set.title} • Kiểm soát độ khó $\le$ cấp bậc HSK
            </p>
          </div>
        </div>

        {/* Chuyển chặng (Batch Selector) */}
        {totalBatches > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1">
            <span className="text-xs text-muted-foreground shrink-0">Chặng:</span>
            {Array.from({ length: totalBatches }).map((_, idx) => (
              <Button
                key={idx}
                size="sm"
                variant={currentBatchIndex === idx ? 'default' : 'outline'}
                onClick={() => handleSelectBatch(idx)}
                className={`text-xs px-2.5 h-7 shrink-0 ${
                  currentBatchIndex === idx
                    ? 'bg-amber-600 hover:bg-amber-700 text-white font-bold'
                    : ''
                }`}
              >
                {idx + 1} ({idx * BATCH_SIZE + 1}-{Math.min((idx + 1) * BATCH_SIZE, allCards.length)})
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Đang gọi AI hoặc có lỗi */}
      {loadingAI ? (
        <div className="py-20 text-center space-y-4">
          <div className="relative size-16 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping" />
            <div className="size-14 rounded-full border-4 border-amber-500 border-t-transparent animate-spin flex items-center justify-center bg-amber-50/50 dark:bg-amber-950/20">
              <Sparkles className="size-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">AI đang sáng tác câu dài ngữ cảnh...</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Đảm bảo mỗi câu chứa từ khóa và toàn bộ từ vựng phụ đều ở mức ngang hoặc dưới cấp HSK của từ khóa.
            </p>
          </div>
        </div>
      ) : aiError ? (
        <Card className="border-destructive/30 bg-destructive/5 p-6 text-center space-y-4">
          <AlertCircle className="size-10 text-destructive mx-auto" />
          <div>
            <h3 className="font-bold text-destructive">Không thể tạo câu dịch AI</h3>
            <p className="text-xs text-muted-foreground mt-1">{aiError}</p>
          </div>
          <Button
            onClick={() => loadBatchExercises(allCards, currentBatchIndex, set.title, currentIndex)}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <RotateCcw className="size-4 mr-2" /> Thử lại với AI
          </Button>
        </Card>
      ) : isCompleted ? (
        /* Màn hình hoàn thành chặng */
        <Card className="border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-card p-8 text-center space-y-6">
          <div className="size-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
            <Trophy className="size-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Hoàn thành chặng {currentBatchIndex + 1}!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Bạn đã luyện dịch thành công toàn bộ các câu dài trong chặng này.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsCompleted(false)
                setCurrentIndex(0)
                setUserTranslation('')
                setIsSubmitted(false)
              }}
            >
              <RotateCcw className="size-4 mr-2" /> Luyện lại chặng này
            </Button>

            {currentBatchIndex < totalBatches - 1 && (
              <Button
                onClick={() => handleSelectBatch(currentBatchIndex + 1)}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Sang chặng tiếp theo <ArrowRight className="size-4 ml-2" />
              </Button>
            )}

            <Link href={`/sets/${setId}`} className={buttonVariants({ variant: 'ghost' })}>
              Về trang học phần
            </Link>
          </div>
        </Card>
      ) : currentEx ? (
        /* Workspace bài tập luyện dịch */
        <div className="space-y-6">
          {/* Thanh tiến độ câu */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>
                Câu {currentIndex + 1} / {exercises.length}
              </span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                Chặng {currentBatchIndex + 1} ({currentBatchIndex * BATCH_SIZE + 1} - {Math.min((currentBatchIndex + 1) * BATCH_SIZE, allCards.length)})
              </span>
            </div>
            <Progress value={((currentIndex + 1) / exercises.length) * 100} className="h-2" />
          </div>

          {/* Khung đề bài câu tiếng Việt & Từ khóa */}
          <Card className="border-border/80 bg-card/80 backdrop-blur-xs shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent px-5 py-3 border-b border-border/60 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 font-bold text-xs bg-amber-500/10">
                  {currentEx.hskLevel || 'HSK'}
                </Badge>
                <span className="text-xs text-muted-foreground">Độ khó các từ khác: $\le$ {currentEx.hskLevel}</span>
              </div>

              {/* Huy hiệu từ khóa bắt buộc */}
              <div className="flex items-center gap-2 bg-background/80 px-3 py-1 rounded-full border border-border/60 shadow-xs">
                <span className="text-[11px] text-muted-foreground">Từ khóa:</span>
                <span className="font-bold text-foreground text-sm tracking-wide">{currentEx.keyword}</span>
                {currentEx.keywordPinyin && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-mono">({currentEx.keywordPinyin})</span>
                )}
                <button
                  onClick={() => speakMultilingualText(currentEx.keyword)}
                  className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition"
                  title="Phát âm từ khóa"
                >
                  <Volume2 className="size-3.5" />
                </button>
              </div>
            </div>

            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Dịch câu sau sang tiếng Trung:
                </p>
                <p className="text-lg sm:text-xl font-medium text-foreground leading-relaxed bg-muted/30 p-4 rounded-xl border border-border/50 select-text">
                  "{currentEx.vietnameseSentence}"
                </p>
              </div>

              {/* Nút hỗ trợ & Chèn từ khóa */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleInsertKeyword(currentEx.keyword)}
                    disabled={isSubmitted}
                    className="h-8 text-xs border-dashed border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
                  >
                    <PlusCircle className="size-3.5 mr-1" />
                    Chèn "{currentEx.keyword}"
                  </Button>

                  {currentEx.hints && currentEx.hints.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowHints(!showHints)}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Lightbulb className="size-3.5 mr-1 text-amber-500" />
                      {showHints ? 'Ẩn từ vựng gợi ý' : 'Xem gợi ý từ vựng'}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPinyinHint(!showPinyinHint)}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <HelpCircle className="size-3.5 mr-1" />
                    {showPinyinHint ? 'Ẩn Pinyin gợi ý' : 'Gợi ý Pinyin'}
                  </Button>
                </div>

                <span className="text-[11px] text-muted-foreground italic">
                  Nghĩa từ khóa: {currentEx.keywordDefinition}
                </span>
              </div>

              {/* Khối gợi ý từ vựng phụ trong câu */}
              {showHints && currentEx.hints && currentEx.hints.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2 animate-in fade-in duration-200">
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Lightbulb className="size-3.5 text-amber-600" />
                    Gợi ý từ vựng trong câu (Độ khó $\le$ {currentEx.hskLevel}):
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {currentEx.hints.map((hint, hIdx) => (
                      <div
                        key={hIdx}
                        onClick={() => !isSubmitted && handleInsertKeyword(hint.word)}
                        className="p-2 rounded-lg bg-background/90 border border-border/60 flex items-center justify-between cursor-pointer hover:border-amber-500/60 transition group"
                        title="Bấm để chèn từ này vào câu"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground group-hover:text-amber-600 transition">
                            {hint.word}
                          </span>
                          <span className="text-muted-foreground font-mono text-[11px]">({hint.pinyin})</span>
                        </div>
                        <span className="text-muted-foreground text-[11px] truncate max-w-[120px]">
                          {hint.meaning}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Khối gợi ý Pinyin câu */}
              {showPinyinHint && (
                <div className="p-3 rounded-xl bg-muted/50 border border-border/60 text-xs font-mono text-muted-foreground animate-in fade-in">
                  <span className="font-bold font-sans text-foreground">Pinyin gợi ý: </span>
                  {currentEx.chinesePinyin}
                </div>
              )}

              {/* Ô gõ bản dịch của người dùng */}
              <div className="space-y-2 pt-2">
                <Textarea
                  ref={textareaRef}
                  value={userTranslation}
                  onChange={(e) => setUserTranslation(e.target.value)}
                  disabled={isSubmitted}
                  placeholder="Gõ bản dịch tiếng Trung (chữ Hán) của bạn tại đây... (Ví dụ có thể gõ pinyin trên bàn phím để chọn chữ Hán)"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      handleSubmitTranslation()
                    }
                  }}
                  className="text-base sm:text-lg resize-none font-medium border-2 focus-visible:border-amber-500 rounded-xl"
                />

                {!isSubmitted && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      Mẹo: Nhấn <strong>Ctrl + Enter</strong> để nộp bài
                    </span>
                    <Button
                      onClick={handleSubmitTranslation}
                      disabled={!userTranslation.trim()}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 rounded-xl shadow-xs"
                    >
                      <Send className="size-4 mr-1.5" /> Kiểm tra đáp án
                    </Button>
                  </div>
                )}
              </div>

              {/* Khối kết quả đánh giá & Phân tích đáp án */}
              {isSubmitted && evaluation && (
                <div className="space-y-4 pt-4 border-t border-border/80 animate-in fade-in duration-300">
                  {/* Banner trạng thái */}
                  <div
                    className={`p-4 rounded-xl border flex items-start gap-3 ${
                      evaluation.hasKeyword
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100'
                    }`}
                  >
                    {evaluation.hasKeyword ? (
                      <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <p className="text-sm font-bold">{evaluation.message}</p>
                      <p className="text-xs text-muted-foreground">
                        Mức độ tương đồng với câu chuẩn: <strong>{evaluation.similarityPercent}%</strong> •{' '}
                        {evaluation.hasKeyword ? 'Đã chứa từ khóa bắt buộc ✓' : 'Chưa chứa từ khóa ✗'}
                      </p>
                    </div>
                  </div>

                  {/* Câu tiếng Trung chuẩn mẫu & Pinyin */}
                  <div className="p-4 rounded-xl bg-card border border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Câu tiếng Trung mẫu chuẩn:
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => speakMultilingualText(currentEx.chineseSentence)}
                        className="h-7 text-xs text-amber-700 dark:text-amber-400 border-amber-500/30"
                      >
                        <Volume2 className="size-3.5 mr-1" /> Nghe đọc cả câu
                      </Button>
                    </div>

                    <p className="text-xl sm:text-2xl font-bold tracking-wide text-foreground">
                      {currentEx.chineseSentence}
                    </p>

                    <p className="text-xs sm:text-sm font-mono text-amber-600 dark:text-amber-400">
                      {currentEx.chinesePinyin}
                    </p>
                  </div>

                  {/* Phân tích ngữ pháp (Grammar Tip) */}
                  {currentEx.grammarTip && (
                    <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-1">
                      <p className="font-bold text-foreground flex items-center gap-1.5">
                        <BookOpen className="size-3.5 text-amber-600" /> Phân tích cấu trúc ngữ pháp:
                      </p>
                      <p className="text-muted-foreground leading-relaxed">{currentEx.grammarTip}</p>
                    </div>
                  )}

                  {/* Nút hành động sau khi nộp */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button variant="outline" size="sm" onClick={handleRetryExercise}>
                      <RotateCcw className="size-3.5 mr-1.5" /> Luyện lại câu này
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleNextExercise}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5"
                    >
                      {currentIndex < exercises.length - 1 ? (
                        <>
                          Câu tiếp theo <ArrowRight className="size-4 ml-1.5" />
                        </>
                      ) : (
                        <>
                          Xem kết quả chặng <Trophy className="size-4 ml-1.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
