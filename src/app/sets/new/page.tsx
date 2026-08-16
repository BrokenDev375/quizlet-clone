'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { pinyin } from 'pinyin-pro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { packCardDefinition } from '@/lib/quiz/card-serialization'
import { 
  Plus, 
  Trash2, 
  Sparkles, 
  FileText, 
  Globe, 
  Lock, 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  Wand2,
} from 'lucide-react'
import Link from 'next/link'

interface CardItem {
  id: string
  term: string
  phonetic?: string
  definition: string
  example_sentence?: string
}

export default function NewSetPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [cards, setCards] = useState<CardItem[]>([
    { id: '1', term: '', phonetic: '', definition: '', example_sentence: '' },
    { id: '2', term: '', phonetic: '', definition: '', example_sentence: '' },
    { id: '3', term: '', phonetic: '', definition: '', example_sentence: '' },
  ])
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?next=/sets/new')
      } else {
        setUser(user)
      }
    }
    checkAuth()
  }, [])

  const handleAddCard = () => {
    setCards([
      ...cards,
      { id: Math.random().toString(36).substring(2, 9), term: '', phonetic: '', definition: '', example_sentence: '' },
    ])
  }

  const handleRemoveCard = (index: number) => {
    if (cards.length <= 2) {
      alert('Một bộ thẻ cần tối thiểu 2 thẻ')
      return
    }
    setCards(cards.filter((_, i) => i !== index))
  }

  const handleCardChange = (index: number, field: keyof CardItem, value: string) => {
    const updated = [...cards]
    updated[index] = { ...updated[index], [field]: value }

    // Tự động sinh Pinyin tiếng Trung nếu người dùng gõ chữ Hán
    if (field === 'term' && value.trim()) {
      if (/[\u4e00-\u9fa5]/.test(value)) {
        try {
          const autoPinyin = pinyin(value.trim())
          if (autoPinyin) {
            updated[index].phonetic = autoPinyin
          }
        } catch (e) {
          // ignore
        }
      }
    }

    setCards(updated)
  }

  const handleAutoPinyinAll = () => {
    const updated = cards.map((c) => {
      if (c.term && /[\u4e00-\u9fa5]/.test(c.term)) {
        try {
          return { ...c, phonetic: pinyin(c.term.trim()) }
        } catch (e) {
          return c
        }
      }
      return c
    })
    setCards(updated)
  }

  const handleImport = () => {
    if (!importText.trim()) return

    const lines = importText.split('\n')
    const parsedCards: CardItem[] = []

    lines.forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed) return

      let parts: string[] = []
      if (trimmed.includes('\t')) {
        parts = trimmed.split('\t')
      } else if (trimmed.includes(' - ')) {
        parts = trimmed.split(' - ')
      } else if (trimmed.includes(',')) {
        parts = trimmed.split(',')
      } else {
        parts = [trimmed, '']
      }

      if (parts.length >= 2) {
        const term = parts[0]?.trim() || ''
        let phonetic = parts.length >= 4 ? parts[1]?.trim() : ''
        const definition = parts.length >= 4 ? parts[2]?.trim() : parts[1]?.trim() || ''
        const example_sentence = parts.length >= 4 ? parts[3]?.trim() : parts[2]?.trim() || ''

        // Tự động sinh Pinyin nếu thiếu
        if (!phonetic && /[\u4e00-\u9fa5]/.test(term)) {
          try {
            phonetic = pinyin(term)
          } catch (e) {}
        }

        parsedCards.push({
          id: Math.random().toString(36).substring(2, 9),
          term,
          phonetic,
          definition,
          example_sentence,
        })
      }
    })

    if (parsedCards.length > 0) {
      setCards([...cards.filter((c) => c.term.trim() || c.definition.trim()), ...parsedCards])
      setImportText('')
      setImportOpen(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề cho bộ thẻ')
      return
    }

    const validCards = cards.filter((c) => c.term.trim() && c.definition.trim())
    if (validCards.length < 2) {
      setErrorMsg('Vui lòng nhập đầy đủ thuật ngữ và định nghĩa cho ít nhất 2 thẻ')
      return
    }

    if (!user) {
      router.push('/login?next=/sets/new')
      return
    }

    setLoading(true)

    try {
      // 1. Insert Set
      const { data: setData, error: setError } = await supabase
        .from('sets')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          is_public: isPublic,
          owner_id: user.id,
        })
        .select()
        .single()

      if (setError) throw setError

      // 2. Insert Cards
      const cardPayload = validCards.map((c, idx) => ({
        set_id: setData.id,
        term: c.term.trim(),
        phonetic: c.phonetic?.trim() || null,
        definition: c.definition.trim(),
        example_sentence: c.example_sentence?.trim() || null,
        position: idx,
      }))

      let { error: cardsError } = await supabase
        .from('cards')
        .insert(cardPayload)

      if (cardsError) {
        console.warn('Direct column insert failed, using packed definition fallback:', cardsError.message)
        const packedCards = validCards.map((c, idx) => ({
          set_id: setData.id,
          term: c.term.trim(),
          definition: packCardDefinition(c.definition, c.phonetic, c.example_sentence),
          position: idx,
        }))
        const fallbackRes = await supabase.from('cards').insert(packedCards)
        cardsError = fallbackRes.error
      }

      if (cardsError) throw cardsError

      router.push(`/sets/${setData.id}`)
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu bộ thẻ, vui lòng thử lại.')
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="rounded-full size-9"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Tạo học phần mới</h1>
              <p className="text-xs text-muted-foreground">Tự động sinh Pinyin tiếng Trung, hỗ trợ phiên âm IPA và câu ví dụ</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoPinyinAll}
              className="gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
              title="Tự động tạo Pinyin cho toàn bộ chữ Hán"
            >
              <Wand2 className="size-3.5" /> Tự sinh Pinyin
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(!importOpen)}
              className="gap-1.5 text-xs flex-1 sm:flex-initial"
            >
              <FileText className="size-3.5" /> Nhập nhanh (CSV)
            </Button>

            <Button
              type="submit"
              disabled={loading}
              className="gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-medium text-xs flex-1 sm:flex-initial"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Tạo học phần
            </Button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2 text-sm">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Bulk Import Panel */}
        {importOpen && (
          <Card className="border-indigo-500/30 bg-indigo-500/5 transition">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Nhập dữ liệu nhanh</span>
                <span className="text-xs text-muted-foreground">Định dạng: Từ vựng - Định nghĩa (hoặc Từ - Phiên âm - Định nghĩa - Ví dụ)</span>
              </div>
              <Textarea
                placeholder={`Hello - Xin chào\n你好 - Xin chào (Hệ thống tự điền Pinyin: nǐ hǎo)\nSerendipity - /ˌser.ənˈdɪp.ə.ti/ - Sự tình cờ may mắn - It was pure [serendipity]`}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={4}
                className="bg-background font-mono text-xs"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setImportOpen(false)}>
                  Hủy
                </Button>
                <Button type="button" size="sm" onClick={handleImport}>
                  Nhập vào bộ thẻ
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Set metadata */}
        <div className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Nhập tiêu đề (VD: HSK 1 Tiếng Trung, 3000 Từ Vựng Tiếng Anh...)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold h-12 px-4 bg-card/60"
              required
            />
          </div>
          <div>
            <Textarea
              placeholder="Thêm mô tả cho học phần này (không bắt buộc)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="bg-card/60"
            />
          </div>

          <div className="flex items-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                isPublic
                  ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}
            >
              {isPublic ? (
                <>
                  <Globe className="size-3.5" /> Công khai (Mọi người có thể xem & học)
                </>
              ) : (
                <>
                  <Lock className="size-3.5" /> Riêng tư (Chỉ mình bạn xem được)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card Editor List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Danh sách thẻ ({cards.length})</h2>
            <span className="text-xs text-muted-foreground">Tối thiểu 2 thẻ</span>
          </div>

          {cards.map((card, index) => (
            <Card key={card.id} className="border-border/80 bg-card/60 hover:border-indigo-500/40 transition">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                    Thẻ {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCard(index)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded-md transition"
                    title="Xóa thẻ"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* 1. Thuật ngữ */}
                  <div className="space-y-1.5 md:col-span-4">
                    <label className="text-xs uppercase font-semibold tracking-wider text-muted-foreground h-5 flex items-center">
                      Thuật ngữ / Từ vựng
                    </label>
                    <Input
                      placeholder="VD: 你好 hoặc Apple..."
                      value={card.term}
                      onChange={(e) => handleCardChange(index, 'term', e.target.value)}
                      className="h-10 bg-background font-medium"
                      required
                    />
                  </div>

                  {/* 2. Phiên âm IPA / Pinyin */}
                  <div className="space-y-1.5 md:col-span-4">
                    <label className="text-xs uppercase font-semibold tracking-wider text-indigo-600 dark:text-indigo-400 h-5 flex items-center justify-between">
                      <span className="truncate">Phiên âm (Pinyin/IPA)</span>
                      <span className="text-[10px] text-muted-foreground/80 font-normal lowercase shrink-0">
                        (tự sinh)
                      </span>
                    </label>
                    <Input
                      placeholder="VD: nǐ hǎo hoặc /ˈæp.əl/..."
                      value={card.phonetic || ''}
                      onChange={(e) => handleCardChange(index, 'phonetic', e.target.value)}
                      className="h-10 bg-background text-indigo-600 dark:text-indigo-400 font-mono text-sm font-semibold border-indigo-500/30"
                    />
                  </div>

                  {/* 3. Định nghĩa */}
                  <div className="space-y-1.5 md:col-span-4">
                    <label className="text-xs uppercase font-semibold tracking-wider text-muted-foreground h-5 flex items-center">
                      Định nghĩa / Ý nghĩa
                    </label>
                    <Input
                      placeholder="VD: Xin chào hoặc Quả táo..."
                      value={card.definition}
                      onChange={(e) => handleCardChange(index, 'definition', e.target.value)}
                      className="h-10 bg-background font-medium"
                      required
                    />
                  </div>
                </div>

                {/* 4. Câu ví dụ tùy chọn */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
                      Câu ví dụ ngữ cảnh (Tùy chọn - Dùng đục lỗ khi thi)
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      Mẹo: Dùng [từ] để chỉ định ô đục lỗ (VD: 老师，[你好]！)
                    </span>
                  </div>
                  <Input
                    placeholder="VD: 老师，[你好]！ hoặc I eat an [apple] every day"
                    value={card.example_sentence || ''}
                    onChange={(e) => handleCardChange(index, 'example_sentence', e.target.value)}
                    className="bg-background text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={handleAddCard}
            className="w-full h-12 border-dashed border-2 hover:border-indigo-500 hover:bg-indigo-500/5 text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 gap-2"
          >
            <Plus className="size-4" /> Thêm thẻ mới
          </Button>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={loading}
            size="lg"
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold shadow-lg shadow-indigo-500/25 px-8"
          >
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            Hoàn tất & Tạo học phần
          </Button>
        </div>
      </form>
    </div>
  )
}
