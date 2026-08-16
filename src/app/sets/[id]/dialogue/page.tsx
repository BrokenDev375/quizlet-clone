'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FlashcardSet, Card as CardType } from '@/types/database.types'
import {
  generateDialogueFromCards,
  DialogueLine,
} from '@/lib/quiz/advanced-skills'
import { speakMultilingualText } from '@/lib/quiz/sentence-templates'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  Volume2,
  ArrowLeft,
  Eye,
  EyeOff,
  User,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Play,
} from 'lucide-react'

export default function DialoguePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const setId = resolvedParams.id

  const [set, setSet] = useState<FlashcardSet | null>(null)
  const [cards, setCards] = useState<(CardType & { phonetic?: string; example_sentence?: string })[]>([])
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([])
  const [activeLineId, setActiveLineId] = useState<string | null>(null)
  const [showTranslations, setShowTranslations] = useState(true)
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
        const lines = generateDialogueFromCards(cardsData)
        setDialogueLines(lines)
      }

      setLoading(false)
    }

    loadData()
  }, [setId])

  const handlePlayLine = (line: DialogueLine) => {
    setActiveLineId(line.id)
    speakMultilingualText(line.text)
  }

  const handlePlayAll = async () => {
    for (let i = 0; i < dialogueLines.length; i++) {
      const line = dialogueLines[i]
      setActiveLineId(line.id)
      speakMultilingualText(line.text)
      await new Promise((res) => setTimeout(res, 2800))
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="size-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">Đang khởi tạo phòng Hội thoại...</p>
      </div>
    )
  }

  if (!set || cards.length === 0) {
    return (
      <div className="container max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <MessageSquare className="size-12 text-muted-foreground mx-auto" />
        <h2 className="text-xl font-bold">Học phần này chưa có thẻ nào để tạo hội thoại</h2>
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
    <div className="container max-w-3xl mx-auto py-6 px-4 space-y-6">
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
            <h1 className="text-2xl font-bold tracking-tight">Hội thoại thực tế</h1>
            <p className="text-xs text-muted-foreground">Học phần: {set.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTranslations(!showTranslations)}
            className="text-xs gap-1.5"
          >
            {showTranslations ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {showTranslations ? 'Ẩn dịch nghĩa' : 'Hiện dịch nghĩa'}
          </Button>

          <Button
            size="sm"
            onClick={handlePlayAll}
            className="text-xs gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-medium shadow-md shadow-indigo-500/20"
          >
            <Play className="size-3.5" /> Nghe toàn bộ
          </Button>
        </div>
      </div>

      {/* Dialogue Chat Stream */}
      <div className="space-y-4 pt-2">
        {dialogueLines.map((line) => {
          const isSpeakerA = line.speaker === 'A'
          const isActive = activeLineId === line.id

          return (
            <div
              key={line.id}
              className={`flex items-start gap-3 transition-all duration-300 ${
                isSpeakerA ? 'justify-start' : 'justify-end flex-row-reverse'
              }`}
            >
              {/* Avatar */}
              <div
                className={`size-10 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-md border ${
                  isSpeakerA
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-600'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                }`}
              >
                {line.avatar}
              </div>

              {/* Chat Bubble */}
              <div className={`max-w-md space-y-1.5 ${isSpeakerA ? 'text-left' : 'text-right'}`}>
                <span className="text-[11px] font-bold text-muted-foreground block px-1">
                  {line.speakerName}
                </span>

                <div
                  className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-left space-y-2 ${
                    isSpeakerA
                      ? isActive
                        ? 'bg-blue-500/15 border-blue-500 ring-2 ring-blue-500/30'
                        : 'bg-card hover:bg-muted/60 border-border/80'
                      : isActive
                      ? 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/30'
                      : 'bg-indigo-500/5 hover:bg-indigo-500/10 border-indigo-500/20'
                  }`}
                  onClick={() => handlePlayLine(line)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-base sm:text-lg font-bold text-foreground leading-snug">
                      {line.text}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePlayLine(line)
                      }}
                      className="p-1 rounded-full hover:bg-background/80 text-indigo-600 dark:text-indigo-400 shrink-0 transition"
                      title="Phát âm câu này"
                    >
                      <Volume2 className="size-4" />
                    </button>
                  </div>

                  {line.phonetic && (
                    <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
                      {line.phonetic}
                    </p>
                  )}

                  {showTranslations && (
                    <p className="text-xs text-muted-foreground border-t border-border/40 pt-1.5">
                      {line.translation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
