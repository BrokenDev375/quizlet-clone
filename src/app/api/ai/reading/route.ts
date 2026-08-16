import { NextRequest, NextResponse } from 'next/server'
import { callGeminiJSON, GeminiReadingResponse } from '@/lib/ai/gemini'
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
      .map((c: any) => `- ${c.term} (Nghĩa: ${c.definition})`)
      .join('\n')

    const languageInstruction = isZh
      ? 'Viết đoạn văn và câu hỏi bằng TIẾNG TRUNG (Hán tự chuẩn), kèm bản dịch tiếng Việt.'
      : 'Write the passage and questions in natural, engaging ENGLISH, with accurate Vietnamese translations.'

    const prompt = `
Bạn là một chuyên gia sư phạm ngôn ngữ và tác giả viết truyện giáo dục song ngữ.
Chủ đề học phần: "${setTitle || 'Tổng hợp'}"
Danh sách từ vựng trọng tâm cần lồng ghép:
${wordList}

YÊU CẦU:
1. Hãy sáng tác MỘT BÀI ĐỌC HIỂU (Reading Passage) sinh động, tự nhiên 100%, có cốt truyện hoặc bối cảnh đời sống/công sở hấp dẫn dài khoảng 120-180 từ.
2. BẮT BUỘC phải lồng ghép một cách tự nhiên và chính xác các từ vựng trong danh sách trên.
3. Tạo một bản dịch nghĩa tiếng Việt chuẩn xác cho toàn bộ đoạn văn.
4. Tạo 4 CÂU HỎI TRẮC NGHIỆM ĐỌC HIỂU (mỗi câu có 4 lựa chọn A, B, C, D, chỉ rõ index đúng 0-3 và lời giải thích ngắn gọn).
5. QUY TẮC JSON: Không dùng dấu ngoặc kép " bên trong các câu hay câu hỏi (dùng dấu ngoặc đơn ' hoặc dấu 【】 để không gây lỗi JSON).
${languageInstruction}

ĐỊNH DẠNG JSON TRẢ VỀ:
{
  "title": "Tiêu đề bài đọc hấp dẫn",
  "genre": "Thể loại (VD: Đời sống thực tế / Công sở & Học tập / Truyện ngắn)",
  "content": "Nội dung bài đọc",
  "translation": "Bản dịch tiếng Việt toàn bài",
  "questions": [
    {
      "question": "Nội dung câu hỏi đọc hiểu",
      "options": ["Lựa chọn 1", "Lựa chọn 2", "Lựa chọn 3", "Lựa chọn 4"],
      "correctIndex": 0,
      "explanation": "Giải thích chi tiết tại sao đúng"
    }
  ]
}
`

    const result = await callGeminiJSON<GeminiReadingResponse>(prompt)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Gemini AI reading error:', error)
    return NextResponse.json(
      { error: error.message || 'Lỗi khi gọi Gemini AI' },
      { status: 500 }
    )
  }
}
