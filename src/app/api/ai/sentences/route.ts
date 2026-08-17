import { NextResponse } from 'next/server'
import { callGeminiJSON } from '@/lib/ai/gemini'
import { isChineseText } from '@/lib/quiz/sentence-templates'

interface SentenceRequestItem {
  id?: string
  term: string
  definition: string
  example_sentence?: string
}

export async function POST(req: Request) {
  try {
    const { cards, setTitle } = (await req.json()) as {
      cards: SentenceRequestItem[]
      setTitle?: string
    }

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json(
        { error: 'Danh sách thẻ từ vựng không hợp lệ' },
        { status: 400 }
      )
    }

    const sampleCards = cards.slice(0, 20)
    const isZh = sampleCards.some((c) => isChineseText(c.term))
    const langLabel = isZh ? 'Tiếng Trung (chữ Hán giản thể kèm pinyin nếu cần)' : 'Tiếng Anh'

    const wordListText = sampleCards
      .map((c, i) => `${i + 1}. [${c.term}]: nghĩa là "${c.definition}"`)
      .join('\n')

    const prompt = `
Bạn là chuyên gia sư phạm ngôn ngữ ${langLabel}.
Chủ đề học phần: "${setTitle || 'Giao tiếp đời sống'}"

Nhiệm vụ: Hãy sáng tác cho mỗi từ vựng trong danh sách dưới đây đúng 1 CÂU VÍ DỤ NGỮ CẢNH ĐỜI SỐNG THỰC TẾ, tự nhiên, sinh động và chuẩn ngữ pháp.
QUAN TRỌNG:
1. Mỗi câu phải đặt từ vựng vào tình huống sử dụng thực tế nhất (Ví dụ: "thủ tục" -> làm thủ tục ở sân bay/ngân hàng; "bác sĩ" -> tình huống khám bệnh; "máy bay" -> chuyến bay/sân bay; "hộ chiếu" -> xuất nhập cảnh...).
2. TUYỆT ĐỐI KHÔNG dùng các mẫu câu chung chung ngô nghê lặp lại như "Tôi mỗi ngày đều học...", "Tôi thích...", "Đây là...".
3. Câu văn phải chứa chính xác từ vựng đó để có thể đục lỗ.
4. Tách rõ: prefix (phần câu trước từ), suffix (phần câu sau từ), sentence (câu hoàn chỉnh) và translation (dịch tiếng Việt).

Danh sách từ vựng:
${wordListText}

Trả về DUY NHẤT một chuỗi JSON hợp lệ theo đúng cấu trúc sau (không thêm markdown ngoài JSON):
{
  "sentences": [
    {
      "term": "từ vựng gốc",
      "sentence": "câu hoàn chỉnh chứa từ",
      "prefix": "phần đứng trước từ trong câu",
      "suffix": "phần đứng sau từ trong câu",
      "translation": "bản dịch tiếng Việt tự nhiên và chuẩn xác"
    }
  ]
}
`

    const response = await callGeminiJSON<{
      sentences: {
        term: string
        sentence: string
        prefix: string
        suffix: string
        translation: string
      }[]
    }>(prompt)

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error generating contextual sentences via Gemini:', error)
    return NextResponse.json(
      { error: error.message || 'Lỗi khi tạo câu ví dụ bằng Gemini AI' },
      { status: 500 }
    )
  }
}
