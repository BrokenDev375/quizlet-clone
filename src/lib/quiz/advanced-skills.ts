import { Card as CardType } from '@/types/database.types'
import { isChineseText } from './sentence-templates'

export interface DialogueLine {
  id: string
  speaker: 'A' | 'B'
  speakerName: string
  avatar: string
  text: string
  translation: string
  highlightWord?: string
  phonetic?: string
}

export interface ReadingPassage {
  title: string
  content: string
  translation: string
  targetWords: {
    term: string
    phonetic?: string
    definition: string
  }[]
  questions: {
    id: string
    question: string
    options: string[]
    correctIndex: number
    explanation: string
  }[]
}

export interface GrammarExercise {
  id: string
  title: string
  targetSentence: string
  scrambledWords: string[]
  translation: string
  hint: string
}

/**
 * 1. Sinh đoạn hội thoại tự nhiên A/B từ danh sách từ vựng trong học phần
 */
export function generateDialogueFromCards(
  cards: (CardType & { phonetic?: string; example_sentence?: string })[]
): DialogueLine[] {
  if (cards.length === 0) return []

  const isZh = cards.some((c) => isChineseText(c.term))
  const lines: DialogueLine[] = []

  const speakerAName = isZh ? 'Tiểu Minh (A)' : 'Alex (A)'
  const speakerBName = isZh ? 'Lý Hoa (B)' : 'Emma (B)'

  cards.slice(0, 6).forEach((card, index) => {
    const isSpeakerA = index % 2 === 0
    const speaker = isSpeakerA ? 'A' : 'B'
    const speakerName = isSpeakerA ? speakerAName : speakerBName
    const avatar = isSpeakerA ? '👨‍💼' : '👩‍💼'

    let text = ''
    let translation = ''

    if (card.example_sentence && card.example_sentence.trim()) {
      // Dùng câu ví dụ có sẵn
      text = card.example_sentence.replace(/\[|\]/g, '')
      translation = `(Chứa từ: "${card.term}" - ${card.definition})`
    } else {
      if (isZh) {
        if (isSpeakerA) {
          text = `请问，你知道什么是“${card.term}”吗？`
          translation = `Xin hỏi, bạn có biết nghĩa của từ "${card.term}" là gì không?`
        } else {
          text = `我知道，“${card.term}”的意思是：${card.definition}。`
          translation = `Tôi biết chứ, "${card.term}" có nghĩa là: ${card.definition}.`
        }
      } else {
        if (isSpeakerA) {
          text = `Could you please explain what "${card.term}" means?`
          translation = `Bạn có thể giải thích từ "${card.term}" có nghĩa là gì không?`
        } else {
          text = `Sure! "${card.term}" means: ${card.definition}.`
          translation = `Chắc chắn rồi! "${card.term}" có nghĩa là: ${card.definition}.`
        }
      }
    }

    lines.push({
      id: `dialogue_${index}`,
      speaker,
      speakerName,
      avatar,
      text,
      translation,
      highlightWord: card.term,
      phonetic: card.phonetic || undefined,
    })
  })

  return lines
}

/**
 * 2. Sinh bài đọc hiểu và câu hỏi trắc nghiệm từ danh sách thẻ
 */
export function generateReadingFromCards(
  cards: (CardType & { phonetic?: string; example_sentence?: string })[],
  setTitle: string
): ReadingPassage {
  const isZh = cards.some((c) => isChineseText(c.term))
  const sampleCards = cards.slice(0, 5)

  let title = ''
  let content = ''
  let translation = ''

  if (isZh) {
    title = `Bài đọc: Khám phá chủ đề ${setTitle}`
    content = `在今天的汉语学习中，我们遇到了很多有趣的词汇。例如，“${sampleCards[0]?.term || '你好'}”是一个非常实用的表达。掌握这些词汇有助于我们提高日常沟通能力，让我们在交流中更加自信。`
    translation = `Trong bài học tiếng Trung hôm nay, chúng ta đã gặp nhiều từ vựng thú vị. Ví dụ, "${sampleCards[0]?.term || '你好'}" là một cách diễn đạt rất hữu ích. Nắm vững những từ này giúp nâng cao khả năng giao tiếp và tự tin hơn.`
  } else {
    title = `Reading Passage: Exploring ${setTitle}`
    content = `In today's lesson, we explored several essential terms related to our topic. For instance, "${sampleCards[0]?.term || 'Practice'}" is a fundamental concept. Mastering these terms will significantly enhance your understanding and communication skills in daily practice.`
    translation = `Trong bài học hôm nay, chúng ta đã tìm hiểu nhiều thuật ngữ thiết yếu. Nắm vững những từ này sẽ nâng cao đáng kể kỹ năng hiểu biết và giao tiếp trong thực tế.`
  }

  const questions = [
    {
      id: 'q1',
      question: isZh ? 'Mục đích chính của bài đọc này là gì?' : 'What is the main purpose of this passage?',
      options: [
        isZh ? 'Giới thiệu và ứng dụng từ vựng vào giao tiếp' : 'To introduce and apply key vocabulary in practice',
        isZh ? 'Kể một câu chuyện lịch sử' : 'To tell a historical story',
        isZh ? 'Phê bình các phương pháp học tập cũ' : 'To criticize old learning methods',
        isZh ? 'Mô tả một chuyến du lịch' : 'To describe a travel trip',
      ],
      correctIndex: 0,
      explanation: 'Bài đọc nhằm mục đích củng cố từ vựng trong học phần và ứng dụng vào thực tế.',
    },
    {
      id: 'q2',
      question: isZh ? `Từ "${sampleCards[0]?.term || 'từ đầu tiên'}" mang ý nghĩa gì?` : `What is the meaning of "${sampleCards[0]?.term || 'the first term'}"?`,
      options: [
        sampleCards[0]?.definition || 'Ý nghĩa chính xác',
        'Một ý nghĩa khác không liên quan',
        'Tên một địa danh nổi tiếng',
        'Một con số toán học',
      ],
      correctIndex: 0,
      explanation: `"${sampleCards[0]?.term}" có định nghĩa là: ${sampleCards[0]?.definition}.`,
    },
  ]

  return {
    title,
    content,
    translation,
    targetWords: sampleCards.map((c) => ({
      term: c.term,
      phonetic: c.phonetic || undefined,
      definition: c.definition,
    })),
    questions,
  }
}

/**
 * 3. Sinh bài tập Ngữ pháp & Sắp xếp trật tự từ (Sentence Unscramble)
 */
export function generateGrammarExercises(
  cards: (CardType & { phonetic?: string; example_sentence?: string })[]
): GrammarExercise[] {
  const exercises: GrammarExercise[] = []

  cards.forEach((card, index) => {
    const isZh = isChineseText(card.term)
    let sentence = ''
    let translation = ''

    if (card.example_sentence && card.example_sentence.trim()) {
      sentence = card.example_sentence.replace(/\[|\]/g, '').trim()
      translation = `Nghĩa của từ chính "${card.term}": ${card.definition}`
    } else {
      if (isZh) {
        sentence = `我 每天 都 在 学习 ${card.term}`
        translation = `Tôi mỗi ngày đều đang học ${card.term} (${card.definition})`
      } else {
        sentence = `Learning ${card.term} is very important for success`
        translation = `Học từ ${card.term} (${card.definition}) rất quan trọng cho thành công`
      }
    }

    // Tách thành các mảnh từ
    let words = sentence.split(/\s+/).filter(Boolean)
    if (words.length < 3 && isZh) {
      words = sentence.split('').filter((char) => char.trim())
    }

    if (words.length >= 3) {
      // Xáo trộn
      const scrambled = [...words].sort(() => Math.random() - 0.5)

      exercises.push({
        id: `grammar_${index}`,
        title: `Thử thách sắp xếp câu #${index + 1}`,
        targetSentence: words.join(isZh ? '' : ' '),
        scrambledWords: scrambled,
        translation,
        hint: `Từ vựng trọng tâm: ${card.term} (${card.definition})`,
      })
    }
  })

  return exercises
}
