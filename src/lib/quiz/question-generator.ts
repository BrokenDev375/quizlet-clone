import { Card as CardType } from '@/types/database.types'
import { generateContextClozeSentence } from './sentence-templates'

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
  card: CardType
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
  userResponse?: string
  isCorrect?: boolean
}

/**
 * Chuẩn hóa chuỗi để so sánh câu trả lời tự luận (loại bỏ dấu câu, khoảng trắng, viết hoa)
 */
export function normalizeAnswer(text: string): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Xóa dấu tiếng Việt / accents
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'–—]/g, '') // Xóa dấu câu
    .replace(/\s+/g, ' ') // Gộp khoảng trắng
    .trim()
}

/**
 * So khớp câu trả lời tự luận và điền chỗ trống
 */
export function checkWrittenAnswer(userInput: string, targetAnswer: string): boolean {
  const normUser = normalizeAnswer(userInput)
  const normTarget = normalizeAnswer(targetAnswer)

  if (!normUser || !normTarget) return false
  if (normUser === normTarget) return true

  // Cho phép so khớp nếu người dùng nhập một trong các nghĩa (phân cách bởi dấu ; hoặc ,)
  const targetSubParts = targetAnswer
    .split(/[,;\/\n]/)
    .map((p) => normalizeAnswer(p))
    .filter(Boolean)

  if (targetSubParts.includes(normUser)) return true

  return false
}

/**
 * Tạo gợi ý ký tự (Letter Scaffolding) ví dụ: "S _ _ _ _ _ _ y" cho từ "Serendipity"
 */
export function generateLetterHint(term: string): string {
  const clean = term.trim()
  if (clean.length <= 2) return `${clean.length} ký tự`
  if (clean.length <= 4) return `${clean[0]} _ _ ${clean[clean.length - 1]}`
  
  // Từ 5 ký tự trở lên: hiển thị chữ cái đầu, chữ cái cuối và độ dài
  const middle = ' _ '.repeat(clean.length - 2)
  return `${clean[0]}${middle}${clean[clean.length - 1]} (${clean.length} chữ cái)`
}

/**
 * Sinh 1 câu hỏi cụ thể cho 1 thẻ flashcard theo đúng dạng
 */
export function generateQuestionForCard(
  card: CardType,
  allCards: CardType[],
  type: QuestionType
): QuizQuestion {
  const otherCards = allCards.filter((c) => c.id !== card.id)
  const qId = `${card.id}_${type}_${Math.random().toString(36).substring(2, 7)}`

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
        promptTypeLabel: 'Trắc nghiệm xuôi: Chọn định nghĩa',
        targetAnswer: card.definition,
        options,
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
        promptTypeLabel: 'Trắc nghiệm ngược: Chọn thuật ngữ',
        targetAnswer: card.term,
        options,
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
      }
    }

    case 'written': {
      // Cho Định nghĩa -> Tự gõ Thuật ngữ
      return {
        id: qId,
        card,
        type: 'written',
        prompt: card.definition,
        promptTypeLabel: 'Tự luận: Gõ thuật ngữ chính xác',
        targetAnswer: card.term,
      }
    }

    case 'cloze_fill_blank': {
      // DẠNG ĐIỀN TỪ VÀO CÂU NGỮ CẢNH TIẾNG ANH THẬT
      const cloze = generateContextClozeSentence(card.term, card.definition)
      const hint = generateLetterHint(card.term)
      
      return {
        id: qId,
        card,
        type: 'cloze_fill_blank',
        prompt: card.definition,
        promptTypeLabel: 'Điền từ còn thiếu vào câu tiếng Anh',
        targetAnswer: card.term,
        clozePrefix: cloze.prefix,
        clozeSuffix: cloze.suffix,
        letterHint: hint,
      }
    }
  }
}

/**
 * Sinh bộ câu hỏi theo vòng học thích ứng (Adaptive Spaced Repetition Queue)
 */
export function generateAdaptiveLearnBatch(
  allCards: CardType[],
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
  allCards: CardType[],
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
