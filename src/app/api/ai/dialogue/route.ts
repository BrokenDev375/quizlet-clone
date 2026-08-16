import { NextRequest, NextResponse } from 'next/server'
import { callGeminiJSON, GeminiDialogueResponse } from '@/lib/ai/gemini'
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
Bạn là chuyên gia ngôn ngữ. Hãy tạo một đoạn HỘI THOẠI THỰC TẾ giữa 2 nhân vật (Người A và Người B) theo chủ đề "${setTitle}".
Các từ vựng cần sử dụng:
${wordList}

YÊU CẦU:
1. Cuộc trò chuyện dài 6 đến 8 lượt thoại tự nhiên, sinh động, hóm hỉnh.
2. Ngôn ngữ: ${isZh ? 'Tiếng Trung (Hán tự)' : 'Tiếng Anh'}, có kèm bản dịch tiếng Việt cho từng câu.

JSON TRẢ VỀ:
{
  "lines": [
    {
      "speaker": "A",
      "speakerName": "${isZh ? 'Tiểu Minh (A)' : 'Alex (A)'}",
      "avatar": "👨‍💼",
      "text": "Câu nói của A",
      "translation": "Bản dịch tiếng Việt",
      "highlightWord": "Từ vựng được dùng",
      "phonetic": "Phiên âm nếu có"
    }
  ]
}
`

    const result = await callGeminiJSON<GeminiDialogueResponse>(prompt)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Gemini AI dialogue error:', error)
    return NextResponse.json(
      { error: error.message || 'Lỗi khi gọi Gemini AI' },
      { status: 500 }
    )
  }
}
