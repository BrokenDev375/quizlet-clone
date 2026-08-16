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
 * Gọi Google Gemini API với prompt có cấu trúc JSON
 */
export async function callGeminiJSON<T>(prompt: string): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong .env.local')
  }

  // Thử các model mới nhất của Google Gemini
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash']
  let lastError: any = null

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
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.warn(`Gemini model ${model} failed:`, errorText)
        lastError = new Error(`Gemini API error: ${response.status} - ${errorText}`)
        continue
      }

      const data = await response.json()
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text

      if (!rawText) {
        throw new Error('Gemini không trả về nội dung hợp lệ')
      }

      // Xử lý làm sạch JSON nếu có markdown formatting
      const cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*$/gi, '')
        .trim()

      return JSON.parse(cleaned) as T
    } catch (err) {
      lastError = err
    }
  }

  throw lastError || new Error('Không thể kết nối với Gemini AI')
}
