import { createClient } from '@/lib/supabase/client'
import { SetStudySession } from '@/types/database.types'

const LOCAL_STORAGE_PREFIX = 'quizlet_study_session_'

/**
 * Lưu tiến độ học tập đồng thời vào LocalStorage và Supabase (Cross-device Sync)
 */
export async function saveStudySession(session: {
  setId: string
  mode: 'flashcard' | 'learn' | 'grammar' | 'dictation' | 'speak' | 'match' | 'test'
  cardIndex: number
  batchIndex?: number
}) {
  const data: SetStudySession = {
    set_id: session.setId,
    last_mode: session.mode,
    last_card_index: Math.max(0, session.cardIndex),
    last_batch_index: session.batchIndex ?? 0,
    updated_at: new Date().toISOString(),
  }

  // 1. Lưu tức thì vào LocalStorage (0ms latency)
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${session.setId}`, JSON.stringify(data))
    } catch (e) {}
  }

  // 2. Đồng bộ ngầm lên Supabase nếu người dùng đã đăng nhập
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('set_study_sessions')
      .upsert(
        {
          user_id: user.id,
          set_id: session.setId,
          last_mode: session.mode,
          last_card_index: data.last_card_index,
          last_batch_index: data.last_batch_index,
          updated_at: data.updated_at,
        },
        { onConflict: 'user_id, set_id' }
      )
  } catch (err) {
    // Không làm gián đoạn người dùng nếu Supabase lỗi mạng
    console.debug('Supabase session sync notice:', err)
  }
}

/**
 * Lấy tiến độ học tập gần nhất (Ưu tiên kết hợp LocalStorage + Supabase)
 */
export async function getStudySession(setId: string): Promise<SetStudySession | null> {
  let localSession: SetStudySession | null = null

  // 1. Đọc từ LocalStorage trước để hiển thị ngay lập tức
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${setId}`)
      if (raw) {
        localSession = JSON.parse(raw)
      }
    } catch (e) {}
  }

  // 2. Thử truy vấn từ Supabase để lấy dữ liệu mới nhất (nếu học từ thiết bị khác)
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: remoteData } = await supabase
        .from('set_study_sessions')
        .select('*')
        .eq('set_id', setId)
        .single()

      if (remoteData) {
        // So sánh timestamp để lấy phiên bản mới nhất
        if (!localSession || !localSession.updated_at || new Date(remoteData.updated_at) > new Date(localSession.updated_at)) {
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${setId}`, JSON.stringify(remoteData))
            } catch (e) {}
          }
          return remoteData as SetStudySession
        }
      }
    }
  } catch (err) {
    console.debug('Supabase get session notice:', err)
  }

  return localSession
}

/**
 * Xóa tiến độ học tập khi hoàn thành hoặc bắt đầu lại từ đầu
 */
export async function clearStudySession(setId: string) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${setId}`)
    } catch (e) {}
  }

  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('set_study_sessions')
        .delete()
        .eq('set_id', setId)
    }
  } catch (e) {}
}
