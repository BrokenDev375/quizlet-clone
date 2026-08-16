import { Card as CardType } from '@/types/database.types'
import {
  generateContextClozeSentence,
  generateSmartLetterHint,
  isChineseText,
} from './sentence-templates'

export type QuestionType =
  | 'mc_term_to_def'
  | 'mc_def_to_term'
  | 'true_false'
  | 'written'
  | 'cloze_fill_blank'

export type CardMasteryLevel = 'new' | 'learning' | 'mastered'

export interface CardProgressState {
  cardId: string
  level: CardMasteryLevel
  correctStreak: number
  incorrectCount: number
  testedTypes: QuestionType[]
}

export interface QuizQuestion {
  id: string
  card: CardType & { example_sentence?: string | null }
  type: QuestionType
  prompt: string
  promptTypeLabel: string
  targetAnswer: string
  options?: string[]
  tfDisplayDef?: string
  isActuallyTrue?: boolean
  clozePrefix?: string
  clozeSuffix?: string
  letterHint?: string
  isChinese?: boolean
  userResponse?: string
  isCorrect?: boolean
}

/**
 * Chuẩn hóa chuỗi để so sánh câu trả lời tự luận (hỗ trợ cả tiếng Anh, tiếng Trung và tiếng Việt)
 */
export function normalizeAnswer(text: string): string {
  if (!text) return ''
  const isZh = isChineseText(text)

  let normalized = text
    .toLowerCase()
    .trim()
    // Xóa dấu câu tiếng Anh và tiếng Trung (full-width punctuation)
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'–—。，！？；：“”‘’（）]/g, '')

  if (!isZh) {
    // Xóa dấu tiếng Việt / accents cho chữ Latin
    normalized = normalized
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
  } else {
    // Với tiếng Trung: loại bỏ mọi khoảng trắng thừa giữa các chữ Hán
    normalized = normalized.replace(/\s+/g, '')
  }

  return normalized.trim()
}

/**
 * So khớp câu trả lời tự luận và điền chỗ trống
 */
export function checkWrittenAnswer(userInput: string, targetAnswer: string): boolean {
  const normUser = normalizeAnswer(userInput)
  const normTarget = normalizeAnswer(targetAnswer)

  if (!normUser || !normTarget) return false
  if (normUser === normTarget) return true

  // Cho phép so khớp nếu người dùng nhập một trong các nghĩa (phân cách bởi dấu ; hoặc , hoặc / hoặc 、 trong tiếng Trung)
  const targetSubParts = targetAnswer
    .split(/[,;\/\n、]/)
    .map((p) => normalizeAnswer(p))
    .filter(Boolean)

  if (targetSubParts.includes(normUser)) return true

  return false
}

/**
 * Sinh 1 câu hỏi cụ thể cho 1 thẻ flashcard theo đúng dạng
 */
export function generateQuestionForCard(
  card: CardType & { example_sentence?: string | null },
  allCards: (CardType & { example_sentence?: string | null })[],
  type: QuestionType
): QuizQuestion {
  const otherCards = allCards.filter((c) => c.id !== card.id)
  const qId = `${card.id}_${type}_${Math.random().toString(36).substring(2, 7)}`
  const isZh = isChineseText(card.term)

  switch (type) {
    case 'mc_term_to_def': {
      // Cho Thuật ngữ -> Chọn Định nghĩa (4 đáp án)
      const distractors = otherCards
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((c) => c.definition)

      const options = [...distractors, card.definition].sort(
        () => Math.random() - 0.5
      )

      return {
        id: qId,
        card,
        type: 'mc_term_to_def',
        prompt: card.term,
        promptTypeLabel: isZh ? 'Trắc nghiệm: Chọn nghĩa tiếng Việt' : 'Trắc nghiệm xuôi: Chọn định nghĩa',
        targetAnswer: card.definition,
        options,
        isChinese: isZh,
      }
    }

    case 'mc_def_to_term': {
      // Cho Định nghĩa -> Chọn Thuật ngữ (4 đáp án - Đảo chiều)
      const distractors = otherCards
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((c) => c.term)

      const options = [...distractors, card.term].sort(
        () => Math.random() - 0.5
      )

      return {
        id: qId,
        card,
        type: 'mc_def_to_term',
        prompt: card.definition,
        promptTypeLabel: isZh ? 'Trắc nghiệm: Chọn chữ Hán / Từ tiếng Trung' : 'Trắc nghiệm ngược: Chọn thuật ngữ',
        targetAnswer: card.term,
        options,
        isChinese: isZh,
      }
    }

    case 'true_false': {
      // Cho Thuật ngữ + 1 Định nghĩa (đúng hoặc ghép nhầm) -> Hỏi Đúng hay Sai
      const isActuallyTrue = Math.random() > 0.5 || otherCards.length === 0
      const randomOther =
        otherCards.length > 0
          ? otherCards[Math.floor(Math.random() * otherCards.length)]
          : card
      const displayDef = isActuallyTrue ? card.definition : randomOther.definition

      return {
        id: qId,
        card,
        type: 'true_false',
        prompt: card.term,
        promptTypeLabel: 'Phán đoán phản xạ: Đúng hay Sai?',
        targetAnswer: isActuallyTrue ? 'true' : 'false',
        tfDisplayDef: displayDef,
        isActuallyTrue,
        isChinese: isZh,
      }
    }

    case 'written': {
      // Cho Định nghĩa -> Tự gõ Thuật ngữ
      return {
        id: qId,
        card,
        type: 'written',
        prompt: card.definition,
        promptTypeLabel: isZh ? 'Tự luận: Gõ chữ Hán / Pinyin' : 'Tự luận: Gõ thuật ngữ chính xác',
        targetAnswer: card.term,
        isChinese: isZh,
      }
    }

    case 'cloze_fill_blank': {
      // DẠNG ĐIỀN TỪ VÀO CÂU NGỮ CẢNH (Ưu tiên câu ví dụ tự nhập nếu có)
      const cloze = generateContextClozeSentence(
        card.term,
        card.definition,
        card.example_sentence
      )
      const hint = generateSmartLetterHint(card.term)

      return {
        id: qId,
        card,
        type: 'cloze_fill_blank',
        prompt: card.definition,
        promptTypeLabel: isZh
          ? 'Điền chữ Hán còn thiếu vào câu'
          : 'Điền từ còn thiếu vào câu',
        targetAnswer: card.term,
        clozePrefix: cloze.prefix,
        clozeSuffix: cloze.suffix,
        letterHint: hint,
        isChinese: isZh,
      }
    }
  }
}

/**
 * Sinh bộ câu hỏi theo vòng học thích ứng (Adaptive Spaced Repetition Queue)
 */
export function generateAdaptiveLearnBatch(
  allCards: (CardType & { example_sentence?: string | null })[],
  progressMap: Record<string, CardProgressState>,
  batchSize = 6
): QuizQuestion[] {
  const unmasteredCards = allCards.filter(
    (c) => progressMap[c.id]?.level !== 'mastered'
  )

  if (unmasteredCards.length === 0) return []

  const sorted = [...unmasteredCards].sort((a, b) => {
    const stateA = progressMap[a.id] || { level: 'new', correctStreak: 0 }
    const stateB = progressMap[b.id] || { level: 'new', correctStreak: 0 }
    if (stateA.level === 'learning' && stateB.level === 'new') return -1
    if (stateA.level === 'new' && stateB.level === 'learning') return 1
    return 0.5 - Math.random()
  })

  const currentBatchCards = sorted.slice(0, batchSize)
  const questions: QuizQuestion[] = []

  currentBatchCards.forEach((card) => {
    const state = progressMap[card.id] || {
      level: 'new',
      correctStreak: 0,
      testedTypes: [],
    }

    let targetType: QuestionType = 'mc_term_to_def'

    if (state.level === 'new') {
      targetType = 'mc_term_to_def'
    } else if (state.level === 'learning') {
      if (!state.testedTypes.includes('mc_def_to_term')) {
        targetType = 'mc_def_to_term'
      } else if (!state.testedTypes.includes('cloze_fill_blank')) {
        targetType = 'cloze_fill_blank'
      } else if (!state.testedTypes.includes('true_false')) {
        targetType = 'true_false'
      } else {
        targetType = 'written'
      }
    }

    questions.push(generateQuestionForCard(card, allCards, targetType))
  })

  return questions.sort(() => Math.random() - 0.5)
}

/**
 * THUẬT TOÁN TỐI ƯU SINH ĐỀ THI UNIQUE 100%:
 * Sinh đúng số lượng câu hỏi mà KHÔNG BAO GIỜ bị trùng lặp cặp (Thẻ, Dạng câu hỏi)
 * Giới hạn tối đa = allCards.length * enabledTypes.length
 */
export function generateCustomTestQuestions(
  allCards: (CardType & { example_sentence?: string | null })[],
  config: {
    questionCount: number
    enabledTypes: QuestionType[]
  }
): QuizQuestion[] {
  if (allCards.length === 0) return []

  const enabledTypes =
    config.enabledTypes && config.enabledTypes.length > 0
      ? config.enabledTypes
      : ([
          'mc_term_to_def',
          'mc_def_to_term',
          'true_false',
          'written',
          'cloze_fill_blank',
        ] as QuestionType[])

  // 1. Tạo TOÀN BỘ tổ hợp độc nhất (Card x Type)
  const uniquePool: QuizQuestion[] = []

  allCards.forEach((card) => {
    enabledTypes.forEach((type) => {
      uniquePool.push(generateQuestionForCard(card, allCards, type))
    })
  })

  // 2. Xáo trộn toàn bộ tổ hợp độc nhất
  const shuffledPool = [...uniquePool].sort(() => Math.random() - 0.5)

  // 3. Giới hạn tối đa bằng kích thước của uniquePool
  const finalCount = Math.min(
    Math.max(1, config.questionCount),
    shuffledPool.length
  )

  return shuffledPool.slice(0, finalCount)
}
