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
    if (clean.length === 1) return `1 chữ Hán`
    if (clean.length === 2) return `${clean[0]} _ (2 chữ Hán)`
    const middle = ' _ '.repeat(clean.length - 2)
    return `${clean[0]}${middle}${clean[clean.length - 1]} (${clean.length} chữ Hán)`
  }

  if (clean.length <= 2) return `${clean.length} ký tự`
  if (clean.length <= 4) return `${clean[0]} _ _ ${clean[clean.length - 1]}`
  const middle = ' _ '.repeat(clean.length - 2)
  return `${clean[0]}${middle}${clean[clean.length - 1]} (${clean.length} chữ cái)`
}

// Ngân hàng mẫu câu tiếng Trung đời sống tự nhiên phong phú (16 ngữ cảnh thực tế)
const ZH_NATURAL_PATTERNS = [
  { prefix: '办理 这个 ', suffix: ' 需要 准备 好 相应 的 材料 。' },
  { prefix: '请 问 在 哪里 可以 办理 ', suffix: ' 呢 ？' },
  { prefix: '今天 的 会议 主要 讨论 了 有关 ', suffix: ' 的 问题 。' },
  { prefix: '在 日常 交流 中 ，', suffix: ' 是 一个 非常 常用 的 表达 。' },
  { prefix: '这 项 业务 专门 提供 专业 的 ', suffix: ' 支持 。' },
  { prefix: '老师 在 课堂 上 详细 解释 了 ', suffix: ' 的 含义 。' },
  { prefix: '在 处理 这个 情况 时 ，我们 必须 注意 ', suffix: ' 。' },
  { prefix: '他 在 实际 工作 中 熟练 运用 了 ', suffix: ' 。' },
  { prefix: '这 次 经历 让 我 更加 深刻 地 理解 了 ', suffix: ' 。' },
  { prefix: '出发 之前 ，请 大家 务必 仔细 确认 ', suffix: ' 。' },
  { prefix: '大家 一致 认为 做好 ', suffix: ' 是 成功 的 关键 。' },
  { prefix: '现代 社会 中 ，了解 ', suffix: ' 对 每个人 都 很 有 帮助 。' },
  { prefix: '通过 努力 ，我们 顺利 解决 了 ', suffix: ' 的 相关 难题 。' },
  { prefix: '请 问 您 对 这个 ', suffix: ' 还 有 什么 疑问 吗 ？' },
  { prefix: '经过 讨论 ，大家 对 ', suffix: ' 达成 了 一致 意见 。' },
  { prefix: '如果 遇到 困难 ，可以 随时 咨询 ', suffix: ' 的 办理 流程 。' },
]

// Ngân hàng mẫu câu tiếng Anh đời sống phong phú (16 ngữ cảnh thực tế)
const EN_NATURAL_PATTERNS = [
  { prefix: 'Please make sure to check the ', suffix: ' before submitting your application.' },
  { prefix: 'Could you please tell me where I can find information about ', suffix: '?' },
  { prefix: 'Today’s meeting focused extensively on how to manage ', suffix: ' effectively.' },
  { prefix: 'Understanding ', suffix: ' is essential for practical everyday communication.' },
  { prefix: 'Our team provides dedicated support regarding all aspects of ', suffix: '.' },
  { prefix: 'The instructor clearly explained the primary purpose of ', suffix: ' today.' },
  { prefix: 'When dealing with this procedure, paying close attention to ', suffix: ' is necessary.' },
  { prefix: 'He successfully demonstrated great expertise in handling ', suffix: '.' },
  { prefix: 'This practical experience gave everyone a deeper insight into ', suffix: '.' },
  { prefix: 'Before departure, please ensure you have verified your ', suffix: '.' },
  { prefix: 'Completing the ', suffix: ' on schedule is crucial for project success.' },
  { prefix: 'In modern workplaces, mastering ', suffix: ' helps boost overall productivity.' },
  { prefix: 'With collaborative effort, we resolved all issues related to ', suffix: '.' },
  { prefix: 'Do you have any further questions regarding this ', suffix: '?' },
  { prefix: 'After constructive discussion, the team aligned on ', suffix: '.' },
  { prefix: 'If you encounter any challenges, feel free to ask about ', suffix: '.' },
]

/**
 * Sinh câu điền từ ngữ cảnh thông minh (Contextual Cloze) từ mẫu câu có sẵn hoặc template tự nhiên
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
        hint: `Nghĩa: "${definition}"`,
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

  // Tính hash của từ để phân bổ ngữ cảnh ngẫu nhiên nhưng ổn định
  let hash = 0
  for (let i = 0; i < cleanTerm.length; i++) {
    hash = (hash << 5) - hash + cleanTerm.charCodeAt(i)
    hash |= 0
  }
  const positiveHash = Math.abs(hash)

  // 2. Mẫu câu tiếng Trung đa dạng tự nhiên
  if (isZh) {
    const pattern = ZH_NATURAL_PATTERNS[positiveHash % ZH_NATURAL_PATTERNS.length]
    return {
      prefix: pattern.prefix,
      suffix: pattern.suffix,
      fullSentence: `${pattern.prefix}${cleanTerm}${pattern.suffix}`,
      hint: `Nghĩa: "${definition}"`,
      isChinese: true,
    }
  }

  // 3. Mẫu câu tiếng Anh đa dạng tự nhiên
  const enPattern = EN_NATURAL_PATTERNS[positiveHash % EN_NATURAL_PATTERNS.length]
  return {
    prefix: enPattern.prefix,
    suffix: enPattern.suffix,
    fullSentence: `${enPattern.prefix}${cleanTerm}${enPattern.suffix}`,
    hint: `Meaning: "${definition}"`,
    isChinese: false,
  }
}

export const generateContextClozeSentence = generateContextualCloze
