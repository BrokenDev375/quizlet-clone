/**
 * Tiện ích mã hóa & giải mã thông tin thẻ (Phonetic & Example Sentence)
 * Tương thích 100% cả khi cơ sở dữ liệu Supabase chưa có cột example_sentence / phonetic
 */

import { Card as CardType } from '@/types/database.types'

export type EnrichedCard = CardType & {
  phonetic?: string
  example_sentence?: string
}

/**
 * Giải mã definition để trích xuất phonetic và example_sentence nếu được lưu kết hợp
 */
export function unpackCardContent(card: any): EnrichedCard {
  let cleanDef = card.definition || ''
  let phonetic = card.phonetic || ''
  let example = card.example_sentence || ''

  // Trích xuất [pinyin: ...] hoặc [phonetic: ...]
  const pinyinMatch = cleanDef.match(/\[pinyin:\s*([\s\S]*?)\]/i) || cleanDef.match(/\[phonetic:\s*([\s\S]*?)\]/i)
  if (pinyinMatch) {
    if (!phonetic) phonetic = pinyinMatch[1].trim()
    cleanDef = cleanDef.replace(pinyinMatch[0], '').trim()
  }

  // Trích xuất [example: ...] hoặc [vd: ...]
  const exampleMatch = cleanDef.match(/\[example:\s*([\s\S]*?)\]/i) || cleanDef.match(/\[vd:\s*([\s\S]*?)\]/i)
  if (exampleMatch) {
    if (!example) example = exampleMatch[1].trim()
    cleanDef = cleanDef.replace(exampleMatch[0], '').trim()
  }

  return {
    ...card,
    id: card.id || '',
    set_id: card.set_id || '',
    term: card.term || '',
    position: typeof card.position === 'number' ? card.position : 0,
    image_url: card.image_url ?? null,
    created_at: card.created_at || '',
    definition: cleanDef.trim(),
    phonetic: phonetic.trim() || undefined,
    example_sentence: example.trim() || undefined,
  }
}

/**
 * Đóng gói definition kèm phonetic và example_sentence để lưu trữ bền vững
 */
export function packCardDefinition(
  rawDefinition: string,
  phonetic?: string | null,
  exampleSentence?: string | null
): string {
  let packed = rawDefinition.trim()

  if (exampleSentence && exampleSentence.trim()) {
    packed += `\n[example: ${exampleSentence.trim()}]`
  }

  if (phonetic && phonetic.trim()) {
    packed += `\n[pinyin: ${phonetic.trim()}]`
  }

  return packed
}
