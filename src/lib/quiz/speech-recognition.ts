import { isChineseText } from './sentence-templates'
import { pinyin } from 'pinyin-pro'
import { normalizeAnswer } from './question-generator'

export interface SpeechScoreResult {
  score: number // 0 to 100
  isPassed: boolean // >= 70%
  transcript: string
  feedbackMessage: string
  wordFeedback: {
    word: string
    isCorrect: boolean
  }[]
}

/**
 * Tách các biến thể có thể có của thuật ngữ
 * Ví dụ: "take off / remove (v)" -> ["take off", "remove", "take off remove"]
 */
export function extractTargetVariants(targetTerm: string): string[] {
  // 1. Loại bỏ ngoặc đơn, ngoặc vuông: "(v)", "[noun]", "(adj)"
  const cleanBase = targetTerm
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\{[^}]*\}/g, '')
    .trim()

  const variants = new Set<string>()

  if (cleanBase) {
    variants.add(cleanBase)

    // 2. Tách theo dấu gạch chéo '/', dấu phẩy ',', dấu chấm phẩy ';'
    const parts = cleanBase.split(/[\/,;]/).map((p) => p.trim()).filter(Boolean)
    parts.forEach((p) => variants.add(p))
  }

  // Luôn thêm từ gốc
  variants.add(targetTerm.trim())

  return Array.from(variants)
}

/**
 * Tính khoảng cách Levenshtein giữa 2 chuỗi
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // thay thế
          matrix[i][j - 1] + 1,     // chèn
          matrix[i - 1][j] + 1      // xóa
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Tính độ tương đồng giữa 2 chuỗi từ 0% đến 100% (có hỗ trợ Substring & Lenient matching)
 */
export function calculateStringSimilarity(spoken: string, target: string): number {
  const normSpoken = normalizeAnswer(spoken)
  const normTarget = normalizeAnswer(target)

  if (!normSpoken || !normTarget) return 0
  if (normSpoken === normTarget) return 100

  // Nếu người dùng nói có chứa từ mục tiêu (VD: nói "an apple" mà từ là "apple") -> 100%
  if (normSpoken.includes(normTarget) || normTarget.includes(normSpoken)) {
    return 100
  }

  const maxLen = Math.max(normSpoken.length, normTarget.length)
  if (maxLen === 0) return 100

  const distance = calculateLevenshteinDistance(normSpoken, normTarget)
  const similarity = Math.max(0, 1 - distance / maxLen)
  return Math.round(similarity * 100)
}

/**
 * Thuật toán chấm điểm phát âm toàn diện siêu nhạy (Hỗ trợ tiếng Anh & tiếng Trung)
 */
export function scorePronunciation(
  spokenText: string,
  targetTerm: string,
  engineConfidence = 0.9
): SpeechScoreResult {
  const cleanSpoken = spokenText.trim()
  const variants = extractTargetVariants(targetTerm)
  const isZh = isChineseText(targetTerm)

  let bestScore = 0
  let bestVariant = variants[0] || targetTerm

  // Thử so khớp với tất cả các biến thể của từ (ví dụ bỏ ngoặc (v), tách dấu /)
  for (const variant of variants) {
    let currentScore = 0

    if (isZh) {
      // Tiếng Trung: So sánh cả Hán tự lẫn Pinyin (bỏ dấu thanh điệu để tránh sai lệch máy nhận âm)
      const spokenPinyin = pinyin(cleanSpoken, { toneType: 'none' }).toLowerCase().replace(/[^a-z0-9]/g, '')
      const targetPinyin = pinyin(variant, { toneType: 'none' }).toLowerCase().replace(/[^a-z0-9]/g, '')

      const hanziScore = calculateStringSimilarity(cleanSpoken, variant)
      const pinyinScore = calculateStringSimilarity(spokenPinyin, targetPinyin)

      // Nếu pinyin trùng nhau (VD: máy nhận âm lệch chữ nhưng cùng âm đọc) -> Điểm tối đa
      if (spokenPinyin === targetPinyin || spokenPinyin.includes(targetPinyin) || targetPinyin.includes(spokenPinyin)) {
        currentScore = 100
      } else {
        currentScore = Math.max(hanziScore, pinyinScore)
      }
    } else {
      // Tiếng Anh: So khớp từ vựng
      currentScore = calculateStringSimilarity(cleanSpoken, variant)
    }

    if (currentScore > bestScore) {
      bestScore = currentScore
      bestVariant = variant
    }
  }

  // Đánh giá từng từ thành phần để tô màu
  let wordFeedback: { word: string; isCorrect: boolean }[] = []
  if (isZh) {
    const targetChars = bestVariant.split('')
    const spokenPinyin = pinyin(cleanSpoken, { toneType: 'none' }).toLowerCase()

    wordFeedback = targetChars.map((char) => {
      const charPinyin = pinyin(char, { toneType: 'none' }).toLowerCase()
      const isMatch = cleanSpoken.includes(char) || spokenPinyin.includes(charPinyin)
      return {
        word: char,
        isCorrect: isMatch || bestScore >= 70,
      }
    })
  } else {
    const targetWords = bestVariant.split(/\s+/).filter(Boolean)
    const spokenNorm = normalizeAnswer(cleanSpoken)

    wordFeedback = targetWords.map((word) => {
      const normW = normalizeAnswer(word)
      const isMatch = spokenNorm.includes(normW) || calculateStringSimilarity(spokenNorm, normW) >= 70
      return {
        word,
        isCorrect: isMatch || bestScore >= 70,
      }
    })
  }

  // Kết hợp điểm số: Nếu độ khớp cao thì lấy điểm thực tế
  const confidenceFactor = engineConfidence > 0 ? engineConfidence : 0.9
  let finalScore = bestScore

  if (bestScore < 100) {
    finalScore = Math.min(100, Math.round(bestScore * 0.85 + confidenceFactor * 100 * 0.15))
  }

  // Ngưỡng đạt thân thiện cho người học ngôn ngữ (>= 70%)
  const isPassed = finalScore >= 70

  let feedbackMessage = 'Cần luyện tập thêm!'
  if (finalScore >= 90) {
    feedbackMessage = '🎉 Xuất sắc! Phát âm cực chuẩn!'
  } else if (finalScore >= 80) {
    feedbackMessage = '👍 Rất tốt! Gần như hoàn hảo!'
  } else if (finalScore >= 70) {
    feedbackMessage = '✨ Đạt yêu cầu! Phát âm khá chuẩn!'
  } else if (finalScore >= 50) {
    feedbackMessage = '⚠️ Gần đúng rồi, hãy thử nói rõ ràng và gần micro hơn nhé!'
  }

  return {
    score: finalScore,
    isPassed,
    transcript: cleanSpoken,
    feedbackMessage,
    wordFeedback,
  }
}

/**
 * Đánh giá danh sách các ứng viên âm thanh (Top 5 Alternatives từ Web Speech API)
 * Chọn ra ứng viên có điểm số cao nhất cho người học
 */
export function scoreMultipleTranscripts(
  transcripts: { transcript: string; confidence: number }[],
  targetTerm: string
): SpeechScoreResult {
  if (!transcripts || transcripts.length === 0) {
    return {
      score: 0,
      isPassed: false,
      transcript: '',
      feedbackMessage: 'Không nhận được âm thanh. Hãy thử nói to hơn!',
      wordFeedback: [],
    }
  }

  let bestResult: SpeechScoreResult | null = null

  for (const item of transcripts) {
    const result = scorePronunciation(item.transcript, targetTerm, item.confidence)
    if (!bestResult || result.score > bestResult.score) {
      bestResult = result
    }
    if (result.isPassed && result.score >= 95) {
      break // Đã tìm thấy ứng viên xuất sắc nhất
    }
  }

  return bestResult || scorePronunciation(transcripts[0].transcript, targetTerm, transcripts[0].confidence)
}

/**
 * Phát âm thanh chúc mừng bằng Web Audio API
 */
export function playSuccessChime() {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6 (Major Arpeggio)
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.08)

      gain.gain.setValueAtTime(0, ctx.currentTime + index * 0.08)
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + index * 0.08 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.08 + 0.3)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(ctx.currentTime + index * 0.08)
      osc.stop(ctx.currentTime + index * 0.08 + 0.35)
    })
  } catch (e) {}
}

/**
 * Phát âm thanh nhắc nhở thử lại
 */
export function playRetryBeep() {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(320, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(240, ctx.currentTime + 0.2)

    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch (e) {}
}
