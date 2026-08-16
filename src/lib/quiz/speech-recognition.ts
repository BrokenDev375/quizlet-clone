import { isChineseText } from './sentence-templates'
import { pinyin } from 'pinyin-pro'
import { normalizeAnswer } from './question-generator'

export interface SpeechScoreResult {
  score: number // 0 to 100
  isPassed: boolean // >= 75%
  transcript: string
  feedbackMessage: string
  wordFeedback: {
    word: string
    isCorrect: boolean
  }[]
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
 * Tính độ tương đồng giữa 2 chuỗi từ 0% đến 100%
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeAnswer(str1)
  const norm2 = normalizeAnswer(str2)

  if (!norm1 || !norm2) return 0
  if (norm1 === norm2) return 100

  const maxLen = Math.max(norm1.length, norm2.length)
  if (maxLen === 0) return 100

  const distance = calculateLevenshteinDistance(norm1, norm2)
  const similarity = Math.max(0, 1 - distance / maxLen)
  return Math.round(similarity * 100)
}

/**
 * Thuật toán chấm điểm phát âm toàn diện (Hỗ trợ tiếng Anh & tiếng Trung)
 */
export function scorePronunciation(
  spokenText: string,
  targetTerm: string,
  engineConfidence = 0.9
): SpeechScoreResult {
  const cleanSpoken = spokenText.trim()
  const cleanTarget = targetTerm.trim()
  const isZh = isChineseText(cleanTarget)

  let baseScore = 0
  let wordFeedback: { word: string; isCorrect: boolean }[] = []

  if (isZh) {
    // Chấm điểm cho tiếng Trung (so khớp cả chữ Hán lẫn Pinyin)
    const spokenPinyin = pinyin(cleanSpoken, { toneType: 'none' }).toLowerCase().replace(/\s+/g, '')
    const targetPinyin = pinyin(cleanTarget, { toneType: 'none' }).toLowerCase().replace(/\s+/g, '')

    const hanziScore = calculateStringSimilarity(cleanSpoken, cleanTarget)
    const pinyinScore = calculateStringSimilarity(spokenPinyin, targetPinyin)

    baseScore = Math.max(hanziScore, pinyinScore)

    // Chia từng chữ Hán để đánh giá
    const targetChars = cleanTarget.split('')
    wordFeedback = targetChars.map((char) => {
      const match = cleanSpoken.includes(char) || spokenPinyin.includes(pinyin(char, { toneType: 'none' }).toLowerCase())
      return {
        word: char,
        isCorrect: match,
      }
    })
  } else {
    // Chấm điểm cho tiếng Anh / chữ Latin
    baseScore = calculateStringSimilarity(cleanSpoken, cleanTarget)

    const targetWords = cleanTarget.split(/\s+/)
    const spokenNorm = normalizeAnswer(cleanSpoken)

    wordFeedback = targetWords.map((word) => {
      const normW = normalizeAnswer(word)
      const isMatch = spokenNorm.includes(normW) || calculateStringSimilarity(spokenNorm, normW) >= 75
      return {
        word,
        isCorrect: isMatch,
      }
    })
  }

  // Kết hợp confidence của Web Speech API
  const confidenceWeight = engineConfidence > 0 ? engineConfidence : 0.85
  const finalScore = Math.min(100, Math.round(baseScore * 0.8 + confidenceWeight * 100 * 0.2))

  const isPassed = finalScore >= 75

  let feedbackMessage = 'Cần luyện tập thêm!'
  if (finalScore >= 95) {
    feedbackMessage = '🎉 Xuất sắc! Phát âm cực chuẩn!'
  } else if (finalScore >= 85) {
    feedbackMessage = '👍 Rất tốt! Gần như hoàn hảo!'
  } else if (finalScore >= 75) {
    feedbackMessage = '✨ Đạt yêu cầu! Phát âm khá chuẩn!'
  } else if (finalScore >= 50) {
    feedbackMessage = '⚠️ Gần đúng rồi, hãy thử phát âm rõ ràng hơn nhé!'
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
 * Phát âm thanh chúc mừng bằng Web Audio API (Zero external assets needed)
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
