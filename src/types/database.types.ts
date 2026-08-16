export interface Profile {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface FlashcardSet {
  id: string
  owner_id: string
  title: string
  description: string | null
  is_public: boolean
  created_at: string
  updated_at: string
  profiles?: Profile
  cards?: Card[]
  card_count?: number
}

export interface Card {
  id: string
  set_id: string
  term: string
  definition: string
  phonetic?: string | null
  example_sentence?: string | null
  position: number
  image_url: string | null
  created_at: string
}

export interface StudyProgress {
  id: string
  user_id: string
  card_id: string
  status: 'new' | 'learning' | 'mastered'
  incorrect_count: number
  correct_count: number
  last_reviewed: string
}
