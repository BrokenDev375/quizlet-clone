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
      .slice(0, 10)
      .map((c: any, i: number) => `${i + 1}. "${c.term}" (Nghĩa: ${c.definition})`)
      .join('\n')

    const prompt = `
Bạn là một chuyên gia sư phạm ngữ pháp ${isZh ? 'Tiếng Trung (HSK)' : 'Tiếng Anh (IELTS/TOEIC)'}.
Chủ đề học phần: "${setTitle || 'Tổng hợp'}"
Danh sách từ vựng trọng tâm:
${wordList}

YÊU CẦU ĐẶC BIỆT:
1. Hãy tạo ra từ 4 đến 6 bài tập SẮP XẾP TRẬT TỰ TỪ THÀNH CÂU (Sentence Unscramble).
2. TUYỆT ĐỐI KHÔNG ĐƯỢC TẠO CÁC CÂU GIỐNG NHAU HOẶC RẬP KHUÔN! Mỗi câu PHẢI dùng một CẤU TRÚC NGỮ PHÁP HOÀN TOÀN KHÁC BIỆT:
   - Câu 1: Câu trần thuật miêu tả sinh động trong đời sống.
   - Câu 2: Câu hỏi giao tiếp tự nhiên hoặc câu mời lịch sự.
   - Câu 3: Câu phức có liên từ (Because, Although, If / 因为...所以..., 虽然...但是...).
   - Câu 4: Câu có trạng từ chỉ thời gian, nơi chốn hoặc cấu trúc nhấn mạnh.
   - Câu 5: Câu so sánh hoặc cảm thán.
3. Mỗi câu dài từ 5 đến 9 từ.
4. "scrambledWords" là mảng chứa các từ bị XÁO TRỘN ngẫu nhiên để học sinh ghép lại. ${isZh ? '(Lưu ý: Tiếng Trung tách theo từng từ/cụm từ có nghĩa, ví dụ: ["昨天", "我", "买", "了", "一个", "苹果"])' : '(Ví dụ: ["yesterday", "bought", "She", "fresh", "apple", "a"])'}
5. "hint" giải thích rõ cấu trúc ngữ pháp đang được áp dụng trong câu đó.

JSON TRẢ VỀ:
{
  "exercises": [
    {
      "title": "Thử thách ngữ pháp #1 (Câu trần thuật)",
      "targetSentence": "${isZh ? '昨天 我 买 了 一个 苹果' : 'She bought a fresh apple yesterday'}",
      "scrambledWords": ["yesterday", "bought", "She", "fresh", "apple", "a"],
      "translation": "Bản dịch tiếng Việt chuẩn xác",
      "hint": "Cấu trúc: Chủ ngữ + Động từ quá khứ + Tân ngữ + Thời gian"
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
