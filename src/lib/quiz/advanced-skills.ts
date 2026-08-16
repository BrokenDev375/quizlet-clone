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

export interface ReadingQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface ReadingPassage {
  id: string
  title: string
  genre: string
  content: string
  translation: string
  targetWords: {
    term: string
    phonetic?: string
    definition: string
  }[]
  questions: ReadingQuestion[]
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

  cards.slice(0, 8).forEach((card, index) => {
    const isSpeakerA = index % 2 === 0
    const speaker = isSpeakerA ? 'A' : 'B'
    const speakerName = isSpeakerA ? speakerAName : speakerBName
    const avatar = isSpeakerA ? '👨‍💼' : '👩‍💼'

    let text = ''
    let translation = ''

    if (card.example_sentence && card.example_sentence.trim()) {
      text = card.example_sentence.replace(/\[|\]/g, '')
      translation = `(Ngữ cảnh từ "${card.term}": ${card.definition})`
    } else {
      if (isZh) {
        if (isSpeakerA) {
          text = `请问，你知道在日常生活中怎么使用“${card.term}”吗？`
          translation = `Xin hỏi, bạn có biết trong đời sống thường dùng từ "${card.term}" như thế nào không?`
        } else {
          text = `我知道，“${card.term}”通常表示：${card.definition}。`
          translation = `Tôi biết chứ, "${card.term}" thường mang nghĩa là: ${card.definition}.`
        }
      } else {
        if (isSpeakerA) {
          text = `Could you give me an example of how to use "${card.term}"?`
          translation = `Bạn có thể cho tôi một ví dụ về cách dùng từ "${card.term}" được không?`
        } else {
          text = `Certainly! "${card.term}" refers to: ${card.definition}.`
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
 * 2. Thuật toán sinh NHIỀU BÀI ĐỌC HIỂU PHONG PHÚ & BỘ CÂU HỎI ĐA DẠNG
 */
export function generateMultipleReadingPassages(
  cards: (CardType & { phonetic?: string; example_sentence?: string })[],
  setTitle: string
): ReadingPassage[] {
  if (cards.length === 0) return []

  const isZh = cards.some((c) => isChineseText(c.term))
  const passages: ReadingPassage[] = []

  // Chia danh sách từ thành các nhóm (mỗi nhóm 3-5 từ cho 1 bài đọc riêng)
  const chunkSize = Math.max(3, Math.min(5, Math.ceil(cards.length / 3)))
  const cardChunks: (CardType & { phonetic?: string; example_sentence?: string })[][] = []

  for (let i = 0; i < cards.length; i += chunkSize) {
    cardChunks.push(cards.slice(i, i + chunkSize))
  }

  // Nếu có ít từ, nhân đôi hoặc dùng toàn bộ
  if (cardChunks.length === 1 && cards.length >= 2) {
    cardChunks.push([...cards].reverse())
  }

  cardChunks.forEach((chunk, chunkIdx) => {
    const c1 = chunk[0] || cards[0]
    const c2 = chunk[1] || chunk[0]
    const c3 = chunk[2] || chunk[1] || chunk[0]

    let title = ''
    let genre = ''
    let content = ''
    let translation = ''

    if (isZh) {
      if (chunkIdx === 0) {
        genre = 'Đời sống & Giao tiếp'
        title = `Bài 1: Cuộc sống thường ngày và “${c1.term}”`
        content = `在日常生活中，良好的沟通非常重要。当我们遇到“${c1.term}”（${c1.definition}）时，往往能够带来积极的改变。正如很多人所说，“${c2.term}”（${c2.definition}）也是日常交流中不可或缺的一部分。通过不断练习“${c3.term}”，我们能够更好地与他人建立联系，并在实践中取得显著的进步。`
        translation = `Trong cuộc sống hàng ngày, giao tiếp tốt rất quan trọng. Khi chúng ta gặp "${c1.term}" (${c1.definition}), điều đó thường mang lại những thay đổi tích cực. Như nhiều người vẫn nói, "${c2.term}" (${c2.definition}) cũng là một phần không thể thiếu trong giao tiếp. Bằng việc không ngừng rèn luyện "${c3.term}", chúng ta sẽ kết nối tốt hơn và đạt được tiến bộ rõ rệt.`
      } else if (chunkIdx === 1) {
        genre = 'Công việc & Học tập'
        title = `Bài 2: Phương pháp phát triển cùng “${c2.term}”`
        content = `无论是在学习还是工作中，掌握核心技能都是成功的关键。理解“${c1.term}”的真正含义，能让我们在面对复杂任务时更加从容。同时，结合“${c2.term}”与“${c3.term}”的实际应用，可以大幅提高团队的协作效率与个人能力。坚持积累这些词汇，是通往流利汉语的重要一步。`
        translation = `Dù trong học tập hay công việc, nắm vững kỹ năng cốt lõi luôn là chìa khóa dẫn đến thành công. Hiểu rõ ý nghĩa thực sự của "${c1.term}" giúp chúng ta tự tin hơn khi đối mặt với nhiệm vụ phức tạp. Đồng thời, kết hợp ứng dụng thực tế của "${c2.term}" và "${c3.term}" sẽ nâng cao đáng kể hiệu suất làm việc nhóm và năng lực cá nhân.`
      } else {
        genre = 'Câu chuyện & Góc nhìn'
        title = `Bài ${chunkIdx + 1}: Câu chuyện trải nghiệm mới`
        content = `每个人在探索新领域的过程中，都会经历不同的挑战。学会运用“${c1.term}”，能够帮助我们发现未曾注意的细节。而在深入理解“${c2.term}”之后，我们更能体会到学习的乐趣。让我们把“${c3.term}”融入到日常表达中，不断开拓视野。`
        translation = `Mỗi người trong quá trình khám phá lĩnh vực mới đều trải qua những thử thách khác nhau. Học cách vận dụng "${c1.term}" giúp chúng ta phát hiện những chi tiết chưa từng để ý. Sau khi hiểu sâu về "${c2.term}", chúng ta sẽ càng cảm nhận được niềm vui học tập.`
      }
    } else {
      if (chunkIdx === 0) {
        genre = 'Daily Life & Real World'
        title = `Passage 1: Everyday Life and "${c1.term}"`
        content = `In modern society, effective communication plays an essential role in our daily routines. When we truly understand the concept of "${c1.term}" (${c1.definition}), it often leads to positive changes. Furthermore, embracing "${c2.term}" (${c2.definition}) allows individuals to build meaningful connections with others. By consistently applying "${c3.term}" in real-life situations, we can achieve substantial personal growth and confidence.`
        translation = `Trong xã hội hiện đại, giao tiếp hiệu quả đóng vai trò thiết yếu trong cuộc sống hàng ngày. Khi chúng ta thực sự hiểu khái niệm "${c1.term}" (${c1.definition}), điều đó thường mang lại những thay đổi tích cực. Hơn nữa, việc tiếp nhận "${c2.term}" (${c2.definition}) cho phép mỗi người xây dựng các mối quan hệ ý nghĩa.`
      } else if (chunkIdx === 1) {
        genre = 'Professional & Academic'
        title = `Passage 2: Strategies for Success with "${c2.term}"`
        content = `Whether in academic research or professional environments, mastering key principles is crucial for long-term success. Having a clear grasp of "${c1.term}" helps professionals handle complex problems with greater precision. When combined with "${c2.term}" and "${c3.term}", it creates a powerful framework that enhances both team collaboration and individual productivity.`
        translation = `Dù trong nghiên cứu học thuật hay môi trường làm việc, việc nắm vững các nguyên tắc cốt lõi là vô cùng quan trọng để thành công lâu dài. Hiểu rõ "${c1.term}" giúp giải quyết các bài toán phức tạp chính xác hơn, kết hợp cùng "${c2.term}" và "${c3.term}" tạo nên hiệu quả vượt trội.`
      } else {
        genre = 'Insights & Narrative'
        title = `Passage ${chunkIdx + 1}: Exploring New Horizons`
        content = `Everyone experiences meaningful turning points during their learning journey. Recognizing the value of "${c1.term}" enables us to discover unexpected opportunities. As we delve deeper into "${c2.term}", we begin to appreciate the broader picture. Incorporating "${c3.term}" into your active vocabulary will undoubtedly open up exciting pathways.`
        translation = `Mỗi người đều trải qua những bước ngoặt ý nghĩa trong hành trình học tập. Nhận ra giá trị của "${c1.term}" cho phép chúng ta khám phá những cơ hội bất ngờ và mở rộng tầm nhìn.`
      }
    }

    // Sinh 4 câu hỏi trắc nghiệm chuyên sâu cho từng bài đọc
    const questions: ReadingQuestion[] = [
      {
        id: `p${chunkIdx}_q1`,
        question: isZh
          ? 'Ý chính (Main Idea) của đoạn văn này là gì?'
          : 'What is the primary message or main idea of this passage?',
        options: [
          isZh
            ? `Tầm quan trọng của việc hiểu và áp dụng "${c1.term}" cùng các kỹ năng vào thực tế`
            : `The importance of understanding and applying "${c1.term}" in real-life contexts`,
          isZh ? 'Miêu tả chi tiết một chuyến du lịch xa' : 'A description of a long travel trip',
          isZh ? 'Phân tích các sự kiện lịch sử cổ đại' : 'An analysis of ancient historical events',
          isZh ? 'Hướng dẫn nấu các món ăn truyền thống' : 'Instructions on traditional cooking recipes',
        ],
        correctIndex: 0,
        explanation: `Đoạn văn tập trung làm rõ tầm quan trọng và sự ứng dụng thực tế của "${c1.term}" trong đời sống và công việc.`,
      },
      {
        id: `p${chunkIdx}_q2`,
        question: isZh
          ? `Trong bài đọc, từ “${c1.term}” mang ý nghĩa gì?`
          : `According to the passage, what does the term "${c1.term}" mean?`,
        options: [
          c1.definition,
          'Một khái niệm hoàn toàn trái ngược',
          'Tên của một tổ chức quốc tế',
          'Một dụng cụ thể thao',
        ],
        correctIndex: 0,
        explanation: `"${c1.term}" có định nghĩa chính xác là: ${c1.definition}.`,
      },
      {
        id: `p${chunkIdx}_q3`,
        question: isZh
          ? `Theo tác giả, điều gì sẽ xảy ra khi áp dụng “${c2.term}”?`
          : `According to the text, what benefit comes from embracing "${c2.term}"?`,
        options: [
          isZh
            ? `Giúp nâng cao hiệu quả, xây dựng mối quan hệ và phát triển năng lực (${c2.definition})`
            : `It enhances productivity, builds meaningful connections, and improves skills (${c2.definition})`,
          isZh ? 'Gây ra sự lãng phí thời gian' : 'It wastes a significant amount of time',
          isZh ? 'Không đem lại bất kỳ thay đổi nào' : 'It has no noticeable effect on results',
          isZh ? 'Làm giảm sự tự tin của bản thân' : 'It reduces personal confidence',
        ],
        correctIndex: 0,
        explanation: `Bài đọc khẳng định việc tiếp nhận "${c2.term}" mang lại lợi ích tích cực và phát triển năng lực.`,
      },
      {
        id: `p${chunkIdx}_q4`,
        question: isZh
          ? `Khẳng định nào sau đây là ĐÚNG theo nội dung bài đọc?`
          : `Which of the following statements is TRUE based on the passage?`,
        options: [
          isZh
            ? `Việc kiên trì tích lũy và ứng dụng các từ vựng như "${c3.term}" giúp tạo ra sự tiến bộ`
            : `Consistently practicing and applying vocabulary like "${c3.term}" leads to progress`,
          isZh ? 'Học từ vựng không cần phải áp dụng vào thực tế' : 'Vocabulary learning requires no practical application',
          isZh ? 'Chỉ cần học một lần là nhớ mãi mãi' : 'Studying once is sufficient for permanent memory',
          isZh ? 'Giao tiếp tốt không mang lại lợi ích gì' : 'Good communication offers no advantages',
        ],
        correctIndex: 0,
        explanation: `Đoạn văn kết luận rằng sự kiên trì thực hành "${c3.term}" là chìa khóa dẫn đến tiến bộ.`,
      },
    ]

    passages.push({
      id: `passage_${chunkIdx}`,
      title,
      genre,
      content,
      translation,
      targetWords: chunk.map((c) => ({
        term: c.term,
        phonetic: c.phonetic || undefined,
        definition: c.definition,
      })),
      questions,
    })
  })

  return passages
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

    let words = sentence.split(/\s+/).filter(Boolean)
    if (words.length < 3 && isZh) {
      words = sentence.split('').filter((char) => char.trim())
    }

    if (words.length >= 3) {
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
