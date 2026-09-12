import { NextResponse } from 'next/server'
import { callGeminiJSON } from '@/lib/ai/gemini'
import { isChineseText } from '@/lib/quiz/sentence-templates'

export interface TranslateRequestItem {
  id?: string
  term: string
  phonetic?: string
  definition: string
  example_sentence?: string
}

export interface TranslateExercise {
  id: string
  keyword: string
  keywordPinyin?: string
  keywordDefinition: string
  hskLevel: string
  vietnameseSentence: string
  chineseSentence: string
  chinesePinyin: string
  hints: {
    word: string
    pinyin: string
    meaning: string
  }[]
  grammarTip?: string
}

export async function POST(req: Request) {
  try {
    const { cards, setTitle } = (await req.json()) as {
      cards: TranslateRequestItem[]
      setTitle?: string
    }

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json(
        { error: 'Danh sách từ vựng không hợp lệ' },
        { status: 400 }
      )
    }

    // Giới hạn 10 thẻ mỗi lượt để đảm bảo AI xử lý nhanh, sâu và không timeout
    const batchCards = cards.slice(0, 10)
    const isZh = batchCards.some((c) => isChineseText(c.term))
    const langNote = isZh ? 'Tiếng Trung Quốc (chữ Hán giản thể kèm pinyin)' : 'Ngoại ngữ'

    const wordListText = batchCards
      .map((c, i) => `${i + 1}. [${c.term}] (Pinyin: ${c.phonetic || 'tự nhận diện'}, Nghĩa: "${c.definition}")`)
      .join('\n')

    const prompt = `
Bạn là chuyên gia sư phạm và giảng dạy ${langNote}.
Chủ đề học phần: "${setTitle || 'Giao tiếp & Đời sống'}"

Nhiệm vụ: Hãy sáng tác cho MỖI từ khóa trong danh sách dưới đây một BÀI TẬP DỊCH CÂU DÀI TỪ TIẾNG VIỆT QUA TIẾNG TRUNG.

YÊU CẦU BẮT BUỘC VÀ QUAN TRỌNG NHẤT:
1. ĐỘ DÀI VÀ TỰ NHIÊN CỦA CÂU:
   - Câu tiếng Trung phải là một CÂU DÀI hoàn chỉnh (khoảng 12 đến 25 chữ Hán), diễn đạt tự nhiên, có ngữ cảnh thực tế đời sống, công việc hoặc học tập.
   - Tránh tuyệt đối các câu ngắn cụt lủn (như "Tôi có một...", "Đây là...") hoặc câu sáo rỗng.

2. CHỨA TỪ KHÓA:
   - Mỗi câu tiếng Trung BẮT BUỘC phải chứa chính xác từ khóa đó.

3. KIỂM SOÁT CẤP ĐỘ HSK (HSK LEVEL CONTROL - RẤT QUAN TRỌNG):
   - Hãy xác định cấp độ HSK ước lượng của từ khóa (từ HSK 1 đến HSK 6).
   - QUY TẮC BẤT DI BẤT DỊCH: Toàn bộ các từ ngữ và cấu trúc ngữ pháp KHÁC trong câu (ngoài từ khóa) phải ở mức VỪA PHẢI, NGANG BẰNG HOẶC DƯỚI CẤP BẬC HSK của từ khóa đó!
   - Ví dụ:
     + Nếu từ khóa thuộc HSK 2: Cả câu chỉ được dùng từ vựng và ngữ pháp của HSK 1 và HSK 2. Tuyệt đối không đưa từ HSK 4, 5, 6 vào khiến người học bị quá tải!
     + Nếu từ khóa thuộc HSK 4: Các từ khác chỉ được tối đa ở mức HSK 4 (ưu tiên HSK 1-3).

4. BẢN DỊCH TIẾNG VIỆT:
   - Câu tiếng Việt tương ứng phải tự nhiên, mượt mà, chuẩn văn phong tiếng Việt nhưng vẫn sát nghĩa để người học đọc câu tiếng Việt là có thể tư duy dịch sang tiếng Trung.

5. GỢI Ý TỪ VỰNG (HINTS) & NGỮ PHÁP (GRAMMAR TIP):
   - Cung cấp 2 đến 4 từ vựng phụ quan trọng trong câu (kèm pinyin và nghĩa tiếng Việt) để hỗ trợ người học nếu quên từ.
   - Cung cấp một mẹo ngữ pháp ngắn gọn (grammarTip) giải thích cấu trúc chính dùng trong câu.

Danh sách từ vựng:
${wordListText}

Trả về DUY NHẤT một chuỗi JSON hợp lệ theo đúng cấu trúc sau (không thêm bất kỳ văn bản nào ngoài JSON):
{
  "exercises": [
    {
      "keyword": "từ khóa gốc",
      "keywordPinyin": "pinyin của từ khóa",
      "keywordDefinition": "nghĩa của từ khóa",
      "hskLevel": "HSK 1" (hoặc HSK 2, HSK 3, HSK 4, HSK 5, HSK 6),
      "vietnameseSentence": "Câu tiếng Việt dài hoàn chỉnh cần dịch",
      "chineseSentence": "Câu tiếng Trung mẫu dài 12-25 chữ chứa từ khóa và từ vựng <= cấp HSK",
      "chinesePinyin": "Pinyin đầy đủ có dấu cho cả câu tiếng Trung",
      "hints": [
        { "word": "từ phụ trong câu", "pinyin": "pīnyīn", "meaning": "nghĩa tiếng Việt" }
      ],
      "grammarTip": "Giải thích ngắn gọn cấu trúc ngữ pháp dùng trong câu"
    }
  ]
}
`

    const response = await callGeminiJSON<{
      exercises: {
        keyword: string
        keywordPinyin?: string
        keywordDefinition: string
        hskLevel: string
        vietnameseSentence: string
        chineseSentence: string
        chinesePinyin: string
        hints: {
          word: string
          pinyin: string
          meaning: string
        }[]
        grammarTip?: string
      }[]
    }>(prompt)

    // Gán id cho từng bài tập
    const exercisesWithId: TranslateExercise[] = (response.exercises || []).map((ex, idx) => ({
      ...ex,
      id: batchCards[idx]?.id || `trans_${idx}_${Date.now()}`,
    }))

    return NextResponse.json({ exercises: exercisesWithId })
  } catch (error: any) {
    console.error('Error generating sentence translation via Gemini:', error)
    return NextResponse.json(
      { error: error.message || 'Lỗi khi tạo câu dịch bằng Gemini AI' },
      { status: 500 }
    )
  }
}
