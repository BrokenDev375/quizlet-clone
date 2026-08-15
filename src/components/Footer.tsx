import Link from 'next/link'
import { Sparkles, Heart } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-muted/20 py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-black text-lg text-foreground">
              <div className="size-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white">
                <Sparkles className="size-4" />
              </div>
              <span>Quizlet Clone</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nền tảng học tập flashcard trực tuyến thông minh, giúp bạn ghi nhớ nhanh hơn và đạt điểm cao hơn.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3">Tính năng học tập</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/explore" className="hover:text-foreground transition">Thẻ ghi nhớ (Flashcards)</Link></li>
              <li><Link href="/explore" className="hover:text-foreground transition">Chế độ Học (Learn Mode)</Link></li>
              <li><Link href="/explore" className="hover:text-foreground transition">Chế độ Kiểm tra (Test Mode)</Link></li>
              <li><Link href="/explore" className="hover:text-foreground transition">Trò chơi Ghép thẻ (Match Game)</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3">Tài nguyên</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/explore" className="hover:text-foreground transition">Khám phá học phần</Link></li>
              <li><Link href="/sets/new" className="hover:text-foreground transition">Tạo bộ thẻ mới</Link></li>
              <li><Link href="/dashboard" className="hover:text-foreground transition">Thư viện của bạn</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-3">Công nghệ</h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Xây dựng với Next.js App Router, Tailwind CSS, Supabase Database & Auth, triển khai trên Vercel.
            </p>
          </div>
        </div>

        <div className="pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Quizlet Clone. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Made with <Heart className="size-3.5 text-rose-500 fill-rose-500" /> for efficient learning
          </p>
        </div>
      </div>
    </footer>
  )
}
