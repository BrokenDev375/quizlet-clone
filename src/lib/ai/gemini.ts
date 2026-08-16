/**
 * Google Gemini AI Client for Generating Reading Passages, Dialogues, and Grammar Exercises
 */

export interface GeminiReadingResponse {
  title: string
  genre: string
  content: string
  translation: string
  questions: {
    question: string
    options: string[]
    correctIndex: number
    explanation: string
  }[]
}

export interface GeminiDialogueResponse {
  lines: {
    speaker: 'A' | 'B'
    speakerName: string
    avatar: string
    text: string
    translation: string
    highlightWord?: string
    phonetic?: string
  }[]
}

export interface GeminiGrammarResponse {
  exercises: {
    title: string
    targetSentence: string
    scrambledWords: string[]
    translation: string
    hint: string
  }[]
}

/**
 * Hàm phân tích và tự động phục hồi JSON an toàn (Chống lỗi Unterminated string / Cắt ngắn)
 */
export function safeParseJSON<T>(rawText: string): T {
  let cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/gi, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch (initialErr: any) {
    console.warn('JSON parse warning, running safe recovery:', initialErr.message)

    // Thử làm sạch các dấu ngoặc kép lồng nhau hoặc ký tự điều khiển
    try {
      // Tìm khối JSON hợp lệ từ ký tự { đầu tiên đến ký tự } cuối cùng
      const startIdx = cleaned.indexOf('{')
      const endIdx = cleaned.lastIndexOf('}')

      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const extracted = cleaned.substring(startIdx, endIdx + 1)
        return JSON.parse(extracted) as T
      }
    } catch (secondErr) {}

    throw new Error('Dữ liệu JSON từ AI bị lỗi định dạng. Vui lòng bấm thử lại!')
  }
}

/**
 * Gọi Google Gemini API với cơ chế tự động thử lại (Retry) & chuyển đổi Model khi bị 503 High Demand
 */
export async function callGeminiJSON<T>(prompt: string): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong .env.local')
  }

  // Danh sách các model Gemini thế hệ mới để luân chuyển tự động (Tận dụng Flash-Lite 500 RPD)
  const models = [
    'gemini-3.5-flash-lite', // 500 RPD, 15 RPM - Tốc độ cực nhanh & Hạn mức cao nhất
    'gemini-3.1-flash-lite', // 500 RPD, 15 RPM - Dự phòng 500 lượt/ngày
    'gemini-3.7-flash',      // 20 RPD, 5 RPM
    'gemini-3.6-flash',      // 20 RPD, 5 RPM
    'gemini-3.5-flash',      // 20 RPD, 5 RPM
  ]
  let lastError: any = null

  for (let attempt = 0; attempt < 2; attempt++) {
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.6,
              topP: 0.95,
              maxOutputTokens: 8192, // Tăng tối đa để không bao giờ bị cắt cụt JSON
              responseMimeType: 'application/json',
            },
          }),
        })

        if (!response.ok) {
          const status = response.status
          const errorText = await response.text()
          console.warn(`Gemini model ${model} returned status ${status}:`, errorText)

          // Nếu gặp lỗi 503 (High Demand) hoặc 429 (Rate Limit) -> Thử model tiếp theo
          if (status === 503 || status === 429) {
            lastError = new Error('Máy chủ AI đang có lượng truy cập cao. Hệ thống đang chuyển model dự phòng...')
            await new Promise((r) => setTimeout(r, 800))
            continue
          }

          lastError = new Error(`Lỗi Gemini API (${status})`)
          continue
        }

        const data = await response.json()
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text

        if (!rawText) {
          throw new Error('Gemini không trả về nội dung hợp lệ')
        }

        return safeParseJSON<T>(rawText)
      } catch (err: any) {
        lastError = err
      }
    }

    // Đợi 1 giây trước khi thử lại vòng 2 nếu tất cả model bị bận
    await new Promise((r) => setTimeout(r, 1200))
  }

  throw lastError || new Error('Không thể kết nối với Gemini AI. Vui lòng bấm thử lại sau vài giây!')
}
