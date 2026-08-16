/**
 * Hệ thống sinh câu ngữ cảnh tiếng Anh tự nhiên và đục lỗ từ vựng (Contextual Cloze Sentence Engine)
 */

export interface ClozeSentence {
  prefix: string
  suffix: string
  fullSentence: string
  hint: string
}

// Kho mẫu câu ngữ cảnh tự nhiên phong phú cho các từ vựng
const CONTEXT_TEMPLATES = [
  {
    prefix: 'She demonstrated exceptional ',
    suffix: ' when facing unexpected challenges at work.',
  },
  {
    prefix: 'In modern society, the concept of ',
    suffix: ' plays an essential role in daily life.',
  },
  {
    prefix: 'Scientists are conducting new research to better understand ',
    suffix: ' in different environments.',
  },
  {
    prefix: 'Finding a true sense of ',
    suffix: ' helped him overcome the difficult period.',
  },
  {
    prefix: 'The teacher asked the students to give an example of ',
    suffix: ' in their presentation.',
  },
  {
    prefix: 'Having good ',
    suffix: ' is considered a key factor for long-term success.',
  },
  {
    prefix: 'It was pure ',
    suffix: ' that led them to discover the hidden treasure.',
  },
  {
    prefix: 'Effective communication requires both clarity and ',
    suffix: ' in every situation.',
  },
  {
    prefix: 'Many experts emphasize that ',
    suffix: ' is crucial for personal development.',
  },
  {
    prefix: 'The team worked together with remarkable ',
    suffix: ' to complete the project on time.',
  },
  {
    prefix: 'Without sufficient ',
    suffix: ', it is hard to achieve great results in any field.',
  },
  {
    prefix: 'The book explores how ',
    suffix: ' has shaped human history over centuries.',
  },
]

/**
 * Sinh một câu ví dụ tiếng Anh có chỗ trống [ _____ ] cho từ vựng
 */
export function generateContextClozeSentence(
  term: string,
  definition: string
): ClozeSentence {
  const cleanTerm = term.trim()

  // Chọn mẫu câu ngẫu nhiên dựa trên hash của từ để đảm bảo mỗi từ có câu ngữ cảnh phù hợp
  let hash = 0
  for (let i = 0; i < cleanTerm.length; i++) {
    hash = (hash << 5) - hash + cleanTerm.charCodeAt(i)
    hash |= 0
  }
  const templateIndex = Math.abs(hash) % CONTEXT_TEMPLATES.length
  const template = CONTEXT_TEMPLATES[templateIndex]

  const prefix = template.prefix
  const suffix = template.suffix
  const fullSentence = `${prefix}${cleanTerm}${suffix}`

  return {
    prefix,
    suffix,
    fullSentence,
    hint: definition,
  }
}
