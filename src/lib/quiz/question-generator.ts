import { Card as CardType } from '@/types/database.types'

export type QuestionType =
  | 'mc_term_to_def'
  | 'mc_def_to_term'
  | 'true_false'
  | 'written'

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
 * So khớp câu trả lời tự luận
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
 * Sinh 1 câu hỏi cụ thể cho 1 thẻ flashcard
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
        promptTypeLabel: 'Chọn định nghĩa đúng',
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
        promptTypeLabel: 'Chọn thuật ngữ tương ứng',
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
        promptTypeLabel: 'Đúng hay Sai?',
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
        promptTypeLabel: 'Nhập thuật ngữ chính xác',
        targetAnswer: card.term,
      }
    }
  }
}

/**
 * Sinh bộ câu hỏi theo vòng học thích ứng (Adaptive Spaced Repetition Queue)
 * Mỗi vòng lấy một nhóm thẻ (batch) và chọn dạng câu hỏi phù hợp với level hiện tại của thẻ
 */
export function generateAdaptiveLearnBatch(
  allCards: CardType[],
  progressMap: Record<string, CardProgressState>,
  batchSize = 5
): QuizQuestion[] {
  // Lọc các thẻ chưa đạt 'mastered'
  const unmasteredCards = allCards.filter(
    (c) => progressMap[c.id]?.level !== 'mastered'
  )

  if (unmasteredCards.length === 0) return []

  // Ưu tiên các thẻ đang học (learning) trước, sau đó đến thẻ mới (new)
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
      // Lần đầu: Trắc nghiệm xuôi (dễ nhất)
      targetType = 'mc_term_to_def'
    } else if (state.level === 'learning') {
      // Lần 2: Nếu đã làm trắc nghiệm xuôi thì nâng lên Trắc nghiệm ngược hoặc Đúng/Sai
      if (!state.testedTypes.includes('mc_def_to_term')) {
        targetType = 'mc_def_to_term'
      } else if (!state.testedTypes.includes('true_false')) {
        targetType = 'true_false'
      } else {
        targetType = 'written' // Thử thách cao nhất để đạt Mastered
      }
    }

    questions.push(generateQuestionForCard(card, allCards, targetType))
  })

  return questions.sort(() => Math.random() - 0.5)
}

/**
 * Sinh đề thi tùy biến sâu (Deep Custom Test Generator)
 * Cho phép sinh 10, 20, 40, 60, 80 hoặc 100+ câu hỏi đa dạng từ tập từ vựng gốc
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
    config.enabledTypes.length > 0
      ? config.enabledTypes
      : (['mc_term_to_def', 'mc_def_to_term', 'true_false', 'written'] as QuestionType[])

  const questions: QuizQuestion[] = []
  const totalCount = Math.max(1, config.questionCount)

  // Xáo trộn thẻ ban đầu
  let cardPool = [...allCards].sort(() => Math.random() - 0.5)
  let cardIndex = 0
  let typeIndex = 0

  for (let i = 0; i < totalCount; i++) {
    // Lấy thẻ tuần hoàn
    const card = cardPool[cardIndex % cardPool.length]
    cardIndex++

    // Nếu đã duyệt hết 1 vòng thẻ, xáo trộn lại để tránh trùng thứ tự
    if (cardIndex % cardPool.length === 0) {
      cardPool = [...allCards].sort(() => Math.random() - 0.5)
    }

    // Chọn luân phiên dạng câu hỏi trong danh sách được bật
    const qType = enabledTypes[typeIndex % enabledTypes.length]
    typeIndex++

    questions.push(generateQuestionForCard(card, allCards, qType))
  }

  return questions
}
