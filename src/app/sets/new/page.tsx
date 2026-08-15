'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
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
  HelpCircle
} from 'lucide-react'
import Link from 'next/link'

interface CardItem {
  id: string
  term: string
  definition: string
}

export default function NewSetPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [cards, setCards] = useState<CardItem[]>([
    { id: '1', term: '', definition: '' },
    { id: '2', term: '', definition: '' },
    { id: '3', term: '', definition: '' },
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
      { id: Math.random().toString(36).substring(2, 9), term: '', definition: '' },
    ])
  }

  const handleRemoveCard = (index: number) => {
    if (cards.length <= 2) {
      alert('Một bộ thẻ cần tối thiểu 2 thẻ')
      return
    }
    setCards(cards.filter((_, i) => i !== index))
  }

  const handleCardChange = (index: number, field: 'term' | 'definition', value: string) => {
    const updated = [...cards]
    updated[index][field] = value
    setCards(updated)
  }

  const handleImport = () => {
    if (!importText.trim()) return

    const lines = importText.split('\n')
    const parsedCards: CardItem[] = []

    lines.forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed) return

      // Support Tab, Comma, or " - " separator
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

      const term = parts[0]?.trim() || ''
      const definition = parts.slice(1).join(' - ').trim() || ''

      if (term || definition) {
        parsedCards.push({
          id: Math.random().toString(36).substring(2, 9),
          term,
          definition,
        })
      }
    })

    if (parsedCards.length > 0) {
      setCards(parsedCards)
      setImportOpen(false)
      setImportText('')
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
        definition: c.definition.trim(),
        position: idx,
      }))

      const { error: cardsError } = await supabase
        .from('cards')
        .insert(cardPayload)

      if (cardsError) throw cardsError

      router.push(`/sets/${setData.id}`)
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu bộ thẻ, vui lòng thử lại.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="size-4" />
          Quay lại thư viện
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Header and actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Tạo học phần mới</h1>
            <p className="text-sm text-muted-foreground mt-1">Tạo các thẻ ghi nhớ để ôn tập và kiểm tra kiến thức</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportOpen(!importOpen)}
              className="gap-1.5"
            >
              <FileText className="size-4" />
              Import dữ liệu
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-medium px-6 shadow-md shadow-indigo-500/20"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                'Tạo học phần'
              )}
            </Button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2.5">
            <AlertCircle className="size-5 shrink-0" />
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Import dialog drawer */}
        {importOpen && (
          <Card className="border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="size-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-semibold">Nhập nhanh từ danh sách văn bản</h3>
                </div>
                <Button variant="ghost" size="xs" onClick={() => setImportOpen(false)}>Đóng</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Dán danh sách từ vựng. Định dạng hỗ trợ: mỗi dòng một thẻ, phân cách giữa thuật ngữ và định nghĩa bằng dấu gạch ngang (VD: <code className="bg-muted px-1.5 py-0.5 rounded">Apple - Quả táo</code>) hoặc phím Tab.
              </p>
              <Textarea
                rows={5}
                placeholder={"Dog - Con chó\nCat - Con mèo\nBook - Quyển sách"}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="font-mono text-sm bg-background"
              />
              <div className="flex justify-end gap-2">
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
              placeholder="Nhập tiêu đề (VD: 3000 Từ Vựng Tiếng Anh Thông Dụng, Sinh học 12...)"
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
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4">
                  <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                    {index + 1}
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
                      Thuật ngữ / Từ vựng
                    </label>
                    <Input
                      placeholder="Nhập thuật ngữ..."
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
                      placeholder="Nhập định nghĩa..."
                      value={card.definition}
                      onChange={(e) => handleCardChange(index, 'definition', e.target.value)}
                      className="bg-background"
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add Card Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleAddCard}
            className="w-full py-6 border-dashed border-2 border-border hover:border-indigo-500 hover:text-indigo-600 font-semibold gap-2 transition"
          >
            <Plus className="size-5" />
            + THÊM THẺ MỚI
          </Button>
        </div>

        {/* Bottom Save Action */}
        <div className="flex justify-end pt-4 border-t border-border">
          <Button
            type="submit"
            disabled={loading}
            size="lg"
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold px-8 shadow-lg shadow-indigo-500/25"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              'Hoàn tất và lưu học phần'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
