'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2, Globe, Lock, ArrowLeft, Loader2, AlertCircle } from 'lucide-react'

interface CardItem {
  id?: string
  term: string
  definition: string
  example_sentence?: string
}

export default function EditSetPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const setId = resolvedParams.id

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [cards, setCards] = useState<CardItem[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/login?next=/sets/${setId}/edit`)
        return
      }

      // Fetch Set
      const { data: setData, error: setError } = await supabase
        .from('sets')
        .select('*')
        .eq('id', setId)
        .single()

      if (setError || !setData) {
        setErrorMsg('Không tìm thấy học phần.')
        setInitialLoading(false)
        return
      }

      if (setData.owner_id !== user.id) {
        setErrorMsg('Bạn không có quyền chỉnh sửa học phần này.')
        setInitialLoading(false)
        return
      }

      setTitle(setData.title)
      setDescription(setData.description || '')
      setIsPublic(setData.is_public)

      // Fetch Cards
      const { data: cardsData } = await supabase
        .from('cards')
        .select('*')
        .eq('set_id', setId)
        .order('position', { ascending: true })

      if (cardsData) {
        setCards(cardsData)
      }

      setInitialLoading(false)
    }

    loadData()
  }, [setId])

  const handleAddCard = () => {
    setCards([
      ...cards,
      { term: '', definition: '', example_sentence: '' },
    ])
  }

  const handleRemoveCard = (index: number) => {
    if (cards.length <= 2) {
      alert('Một học phần cần tối thiểu 2 thẻ')
      return
    }
    setCards(cards.filter((_, i) => i !== index))
  }

  const handleCardChange = (index: number, field: keyof CardItem, value: string) => {
    const updated = [...cards]
    updated[index] = { ...updated[index], [field]: value }
    setCards(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề cho học phần')
      return
    }

    const validCards = cards.filter((c) => c.term.trim() && c.definition.trim())
    if (validCards.length < 2) {
      setErrorMsg('Vui lòng nhập đầy đủ thuật ngữ và định nghĩa cho ít nhất 2 thẻ')
      return
    }

    setLoading(true)

    try {
      // 1. Update set metadata
      const { error: updateSetError } = await supabase
        .from('sets')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          is_public: isPublic,
          updated_at: new Date().toISOString(),
        })
        .eq('id', setId)

      if (updateSetError) throw updateSetError

      // 2. Refresh cards: Delete all existing and re-insert
      const { error: deleteCardsError } = await supabase
        .from('cards')
        .delete()
        .eq('set_id', setId)

      if (deleteCardsError) throw deleteCardsError

      const cardPayload = validCards.map((c, idx) => ({
        set_id: setId,
        term: c.term.trim(),
        definition: c.definition.trim(),
        example_sentence: c.example_sentence?.trim() || null,
        position: idx,
      }))

      let { error: insertCardsError } = await supabase
        .from('cards')
        .insert(cardPayload)

      if (insertCardsError && insertCardsError.message?.includes('example_sentence')) {
        // Graceful fallback if column not yet added
        const fallbackCards = cardPayload.map(({ example_sentence, ...rest }) => rest)
        const fallbackRes = await supabase.from('cards').insert(fallbackCards)
        insertCardsError = fallbackRes.error
      }

      if (insertCardsError) throw insertCardsError

      router.push(`/sets/${setId}`)
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi cập nhật học phần')
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="inline-block size-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Đang tải dữ liệu chỉnh sửa...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href={`/sets/${setId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="size-4" />
          Hủy & quay lại học phần
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Chỉnh sửa học phần</h1>
            <p className="text-xs text-muted-foreground">Cập nhật thuật ngữ, định nghĩa và câu ví dụ</p>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-medium shadow-md shadow-indigo-500/20"
          >
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            Lưu thay đổi
          </Button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2 text-sm">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Set Details */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Tiêu đề
            </label>
            <Input
              type="text"
              placeholder="Nhập tiêu đề..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold h-12 bg-card/60"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Mô tả (không bắt buộc)
            </label>
            <Textarea
              placeholder="Thêm mô tả..."
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

        {/* Cards */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Danh sách thẻ ({cards.length})</h2>

          {cards.map((card, index) => (
            <Card key={index} className="border-border/80 bg-card/60 hover:border-indigo-500/40 transition">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
                      Thuật ngữ / Từ vựng (Tiếng Anh, Tiếng Trung...)
                    </label>
                    <Input
                      placeholder="VD: Serendipity hoặc 你好..."
                      value={card.term}
                      onChange={(e) => handleCardChange(index, 'term', e.target.value)}
                      className="bg-background"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
                      Định nghĩa / Ý nghĩa
                    </label>
                    <Input
                      placeholder="VD: Sự tình cờ may mắn hoặc Xin chào..."
                      value={card.definition}
                      onChange={(e) => handleCardChange(index, 'definition', e.target.value)}
                      className="bg-background"
                      required
                    />
                  </div>
                </div>

                {/* Câu ví dụ tùy chọn */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
                      Câu ví dụ ngữ cảnh (Tùy chọn - Dùng đục lỗ khi thi)
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      Mẹo: Dùng [từ] để chỉ định ô đục lỗ (VD: 老师，[你好]！)
                    </span>
                  </div>
                  <Input
                    placeholder="VD: It was pure [serendipity]... hoặc 老师，[你好]！"
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
            className="w-full py-6 border-dashed border-2 border-border hover:border-indigo-500 hover:text-indigo-600 font-semibold gap-2 transition"
          >
            <Plus className="size-5" /> Thêm thẻ mới
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
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </div>
  )
}
