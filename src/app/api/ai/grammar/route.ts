import { NextRequest, NextResponse } from 'next/server'
import { callGeminiJSON, GeminiGrammarResponse } from '@/lib/ai/gemini'
import { isChineseText } from '@/lib/quiz/sentence-templates'

export async function POST(req: NextRequest) {
  try {
    const { cards, setTitle } = await req.json()

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ error: 'Danh sách thẻ không hợp lệ' }, { status: 400 })
    }

    const isZh = cards.some((c: any) => isChineseText(c.term))
    const wordList = cards
      .slice(0, 8)
      .map((c: any) => `- "${c.term}" (${c.definition})`)
      .join('\n')

    const prompt = `
Bạn là giáo viên ngữ pháp. Hãy tạo các câu ví dụ mẫu chuẩn ngữ pháp (mỗi câu 5-8 từ) chứa các từ vựng sau để học sinh luyện sắp xếp trật tự từ:
${wordList}

YÊU CẦU:
1. Tạo 4-6 bài tập sắp xếp câu.
2. Ngôn ngữ: ${isZh ? 'Tiếng Trung (Hán tự)' : 'Tiếng Anh'}, kèm bản dịch tiếng Việt và các từ bị xáo trộn (scrambledWords).

JSON TRẢ VỀ:
{
  "exercises": [
    {
      "title": "Thử thách ngữ pháp #1",
      "targetSentence": "Câu hoàn chỉnh chuẩn ngữ pháp",
      "scrambledWords": ["từ_3", "từ_1", "từ_4", "từ_2"],
      "translation": "Bản dịch tiếng Việt",
      "hint": "Gợi ý ngữ pháp"
    }
  ]
}
`

    const result = await callGeminiJSON<GeminiGrammarResponse>(prompt)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Gemini AI grammar error:', error)
    return NextResponse.json(
      { error: error.message || 'Lỗi khi gọi Gemini AI' },
      { status: 500 }
    )
  }
}
