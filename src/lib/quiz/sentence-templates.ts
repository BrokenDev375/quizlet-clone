/**
 * Hệ thống sinh câu ngữ cảnh tiếng Anh & tiếng Trung (Bilingual English & Chinese Contextual Cloze Engine)
 */

export interface ClozeSentence {
  prefix: string
  suffix: string
  fullSentence: string
  hint: string
  isChinese: boolean
}

/**
 * Kiểm tra xem chuỗi có chứa chữ Hán (tiếng Trung) hay không
 */
export function isChineseText(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text || '')
}

/**
 * Khởi tạo & nạp danh sách giọng đọc sẵn cho trình duyệt di động (iOS Safari & Android Chrome)
 */
let cachedVoices: SpeechSynthesisVoice[] = []

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return []
  if (cachedVoices.length > 0) return cachedVoices
  cachedVoices = window.speechSynthesis.getVoices()
  return cachedVoices
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices()
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoices = window.speechSynthesis.getVoices()
    }
  }

  // Mở khóa SpeechSynthesis & AudioContext trên lần chạm đầu tiên của người dùng di động (iOS Audio Unlock)
  const unlockMobileAudio = () => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume()
      }
    } catch (e) {}
    window.removeEventListener('touchstart', unlockMobileAudio)
    window.removeEventListener('click', unlockMobileAudio)
  }

  window.addEventListener('touchstart', unlockMobileAudio, { once: true, passive: true })
  window.addEventListener('click', unlockMobileAudio, { once: true, passive: true })
}

/**
 * Phát âm Text-to-Speech đa ngôn ngữ tối ưu 100% cho điện thoại (iOS Safari & Android Chrome)
 */
export function speakMultilingualText(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return

  try {
    // 1. Đảm bảo trạng thái không bị kẹt (resume)
    window.speechSynthesis.resume()
    window.speechSynthesis.cancel()

    const cleanText = text.trim()
    const isZh = isChineseText(cleanText)
    const utterance = new SpeechSynthesisUtterance(cleanText)

    const voices = loadVoices()

    if (isZh) {
      utterance.lang = 'zh-CN'
      utterance.rate = 0.85 // Tốc độ chuẩn cho học tập
      // Ưu tiên chọn voice tiếng Trung chuẩn trên thiết bị
      const zhVoice = voices.find(
        (v) =>
          v.lang.startsWith('zh') ||
          v.name.includes('Chinese') ||
          v.name.includes('Ting-Ting') ||
          v.name.includes('Sin-Ji') ||
          v.name.includes('Mei-Jia')
      )
      if (zhVoice) utterance.voice = zhVoice
    } else {
      utterance.lang = 'en-US'
      utterance.rate = 0.95
      // Ưu tiên chọn voice tiếng Anh chuẩn trên thiết bị
      const enVoice = voices.find(
        (v) =>
          (v.lang.startsWith('en') || v.name.includes('English') || v.name.includes('Samantha') || v.name.includes('Google')) &&
          !v.name.includes('zh')
      )
      if (enVoice) utterance.voice = enVoice
    }

    utterance.volume = 1.0

    // Phát âm với timeout nhỏ để iOS WebKit không hủy request
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance)
      } catch (err) {
        console.warn('Speech synthesis speak error:', err)
      }
    }, 15)
  } catch (err) {
    console.warn('Multilingual speech error:', err)
  }
}

/**
 * Tạo gợi ý ký tự thông minh hỗ trợ cả tiếng Anh (chữ cái) và tiếng Trung (chữ Hán / Pinyin)
 */
export function generateSmartLetterHint(term: string): string {
  const clean = term.trim()
  const isZh = isChineseText(clean)

  if (isZh) {
    // Gợi ý cho tiếng Trung (Hán tự)
    if (clean.length === 1) return `1 chữ Hán`
    if (clean.length === 2) return `${clean[0]} _ (2 chữ Hán)`
    const middle = ' _ '.repeat(clean.length - 2)
    return `${clean[0]}${middle}${clean[clean.length - 1]} (${clean.length} chữ Hán)`
  }

  // Gợi ý cho tiếng Anh / chữ Latin
  if (clean.length <= 2) return `${clean.length} ký tự`
  if (clean.length <= 4) return `${clean[0]} _ _ ${clean[clean.length - 1]}`
  const middle = ' _ '.repeat(clean.length - 2)
  return `${clean[0]}${middle}${clean[clean.length - 1]} (${clean.length} chữ cái)`
}

/**
 * Sinh câu điền từ ngữ cảnh thông minh (Contextual Cloze) từ mẫu câu có sẵn hoặc template
 */
export function generateContextualCloze(
  term: string,
  definition: string,
  existingSentence?: string | null
): ClozeSentence {
  const cleanTerm = term.trim()
  const isZh = isChineseText(cleanTerm)

  // 1. Nếu có câu ví dụ tự nhập
  if (existingSentence && existingSentence.trim()) {
    const raw = existingSentence.trim()
    const bracketMatch = raw.match(/\[(.*?)\]/)

    if (bracketMatch && bracketMatch[1]) {
      const parts = raw.split(/\[.*?\]/)
      return {
        prefix: parts[0] || '',
        suffix: parts[1] || '',
        fullSentence: raw.replace(/\[|\]/g, ''),
        hint: `Điền từ thích hợp nghĩa: "${definition}"`,
        isChinese: isZh,
      }
    }

    if (raw.toLowerCase().includes(cleanTerm.toLowerCase())) {
      const regex = new RegExp(cleanTerm, 'i')
      const parts = raw.split(regex)
      return {
        prefix: parts[0] || '',
        suffix: parts.slice(1).join(cleanTerm) || '',
        fullSentence: raw,
        hint: `Nghĩa: "${definition}"`,
        isChinese: isZh,
      }
    }
  }

  // 2. Mẫu câu tiếng Trung
  if (isZh) {
    return {
      prefix: '我 每天 都 在 学习 ',
      suffix: '。',
      fullSentence: `我 每天 都 在 学习 ${cleanTerm}。`,
      hint: `Chữ Hán mang nghĩa: "${definition}"`,
      isChinese: true,
    }
  }

  // 3. Mẫu câu tiếng Anh
  return {
    prefix: 'Learning ',
    suffix: ' is very important for everyday communication.',
    fullSentence: `Learning ${cleanTerm} is very important for everyday communication.`,
    hint: `Meaning: "${definition}"`,
    isChinese: false,
  }
}

export const generateContextClozeSentence = generateContextualCloze

