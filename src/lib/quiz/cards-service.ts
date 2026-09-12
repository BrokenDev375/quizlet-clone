import { SupabaseClient } from '@supabase/supabase-js'
import { unpackCardContent, packCardDefinition, EnrichedCard } from './card-serialization'

/**
 * Tải toàn bộ thẻ của một bộ học (kể cả trên 1.000 thẻ)
 * Sử dụng phân trang tự động (.range) để vượt qua giới hạn max-rows = 1000 của Supabase/PostgREST
 */
export async function fetchAllCards(
  supabase: SupabaseClient<any, any, any>,
  setId: string
): Promise<EnrichedCard[]> {
  const PAGE_SIZE = 1000
  let allCards: any[] = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('set_id', setId)
      .order('position', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('Lỗi khi fetch cards (phân trang):', error)
      throw error
    }

    if (data && data.length > 0) {
      allCards = allCards.concat(data)
      if (data.length < PAGE_SIZE) {
        hasMore = false
      } else {
        from += PAGE_SIZE
      }
    } else {
      hasMore = false
    }
  }

  return allCards.map(unpackCardContent)
}

export interface RawCardInput {
  term: string
  definition: string
  phonetic?: string | null
  example_sentence?: string | null
  position?: number
  image_url?: string | null
}

/**
 * Chèn số lượng lớn thẻ vào Supabase theo từng đợt (chunks)
 * Tránh lỗi quá tải kích thước payload hoặc timeout kết nối mạng khi thêm hàng nghìn thẻ
 */
export async function insertCardsInBatches(
  supabase: SupabaseClient<any, any, any>,
  setId: string,
  cards: RawCardInput[],
  batchSize = 500
): Promise<void> {
  if (!cards || cards.length === 0) return

  for (let i = 0; i < cards.length; i += batchSize) {
    const chunk = cards.slice(i, i + batchSize)

    // Thử insert trực tiếp với các cột mở rộng (phonetic, example_sentence)
    const directPayload = chunk.map((c, idx) => ({
      set_id: setId,
      term: c.term.trim(),
      phonetic: c.phonetic?.trim() || null,
      definition: c.definition.trim(),
      example_sentence: c.example_sentence?.trim() || null,
      position: typeof c.position === 'number' ? c.position : i + idx,
      image_url: c.image_url ?? null,
    }))

    let { error: insertError } = await supabase.from('cards').insert(directPayload)

    // Fallback: Nếu cơ sở dữ liệu Supabase chưa có cột phonetic/example_sentence
    if (insertError) {
      console.warn(
        `Insert đợt ${Math.floor(i / batchSize) + 1} lỗi cột trực tiếp, chuyển sang đóng gói definition:`,
        insertError.message
      )
      const packedPayload = chunk.map((c, idx) => ({
        set_id: setId,
        term: c.term.trim(),
        definition: packCardDefinition(c.definition, c.phonetic, c.example_sentence),
        position: typeof c.position === 'number' ? c.position : i + idx,
        image_url: c.image_url ?? null,
      }))

      const fallbackRes = await supabase.from('cards').insert(packedPayload)
      if (fallbackRes.error) {
        throw fallbackRes.error
      }
    }
  }
}

/**
 * Tải tiến độ học tập (study_progress) an toàn theo batch
 * Tránh lỗi 414 URI Too Long khi một bộ học có hàng nghìn ID thẻ
 */
export async function fetchStudyProgressForCards(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  cardIds: string[]
): Promise<Record<string, any>> {
  const map: Record<string, any> = {}
  if (!userId || !cardIds || cardIds.length === 0) return map

  const CHUNK_SIZE = 200
  for (let i = 0; i < cardIds.length; i += CHUNK_SIZE) {
    const chunk = cardIds.slice(i, i + CHUNK_SIZE)
    const { data, error } = await supabase
      .from('study_progress')
      .select('*')
      .eq('user_id', userId)
      .in('card_id', chunk)

    if (error) {
      console.warn('Lỗi fetch study_progress chunk:', error.message)
      break
    }

    if (data) {
      data.forEach((row: any) => {
        map[row.card_id] = row
      })
    }
  }

  return map
}

