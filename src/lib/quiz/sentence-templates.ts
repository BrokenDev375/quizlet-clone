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
 * Phát âm Text-to-Speech tự động nhận diện tiếng Anh (en-US) hoặc tiếng Trung (zh-CN)
 */
export function speakMultilingualText(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text.trim())

  if (isChineseText(text)) {
    utterance.lang = 'zh-CN'
    utterance.rate = 0.85 // Tiếng Trung phát âm tốc độ chuẩn học tập
  } else {
    utterance.lang = 'en-US'
    utterance.rate = 0.95
  }

  window.speechSynthesis.speak(utterance)
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
 * Sinh câu ngữ cảnh đục lỗ:
 * 1. Ưu tiên lấy từ `exampleSentence` do người dùng nhập (nếu có dấu [từ] hoặc chứa từ).
 * 2. Nếu không có câu ví dụ riêng: Sử dụng mẫu câu ngữ cảnh học thuật chuẩn xác (không bao giờ lệch nghĩa).
 */
export function generateContextClozeSentence(
  term: string,
  definition: string,
  customExample?: string | null
): ClozeSentence {
  const cleanTerm = term.trim()
  const isZh = isChineseText(cleanTerm)

  // 1. NẾU CÓ CÂU VÍ DỤ TỰ NHẬP
  if (customExample && customExample.trim()) {
    const ex = customExample.trim()

    // Trường hợp 1: Có chứa cú pháp [từ_cần_điền]
    const bracketMatch = ex.match(/^(.*?)\[(.*?)\](.*)$/)
    if (bracketMatch) {
      const prefix = bracketMatch[1]
      const target = bracketMatch[2]
      const suffix = bracketMatch[3]
      return {
        prefix,
        suffix,
        fullSentence: `${prefix}${target}${suffix}`,
        hint: definition,
        isChinese: isZh,
      }
    }

    // Trường hợp 2: Câu có chứa từ vựng (không cần ngoặc vuông)
    const lowerEx = ex.toLowerCase()
    const lowerTerm = cleanTerm.toLowerCase()
    const termIndex = lowerEx.indexOf(lowerTerm)

    if (termIndex !== -1) {
      const prefix = ex.substring(0, termIndex)
      const suffix = ex.substring(termIndex + cleanTerm.length)
      return {
        prefix,
        suffix,
        fullSentence: ex,
        hint: definition,
        isChinese: isZh,
      }
    }
  }

  // 2. NẾU CHƯA CÓ CÂU VÍ DỤ RIÊNG -> DÙNG MẪU CÂU QUY CHUẨN ĐỊNH NGHĨA CHUẨN XÁC
  if (isZh) {
    // Mẫu câu chuẩn tiếng Trung
    return {
      prefix: 'Trong tiếng Trung, từ "',
      suffix: `" có nghĩa là: "${definition}".`,
      fullSentence: `Trong tiếng Trung, từ "${cleanTerm}" có nghĩa là: "${definition}".`,
      hint: definition,
      isChinese: true,
    }
  }

  // Mẫu câu chuẩn tiếng Anh
  return {
    prefix: 'In English, the term "',
    suffix: `" is defined as: "${definition}".`,
    fullSentence: `In English, the term "${cleanTerm}" is defined as: "${definition}".`,
    hint: definition,
    isChinese: false,
  }
}
