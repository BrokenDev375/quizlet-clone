import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Sparkles, 
  BookOpen, 
  Brain, 
  FileCheck2, 
  Gamepad2, 
  ArrowRight, 
  Zap, 
  CheckCircle2, 
  Users, 
  Award,
  Layers
} from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-full">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-border/40">
        {/* Glow gradients background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-indigo-500/20 via-cyan-400/20 to-blue-600/20 blur-3xl -z-10 rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold shadow-xs">
            <Sparkles className="size-3.5" />
            Phương pháp học tập flashcard hiệu quả hàng đầu
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight max-w-4xl mx-auto text-balance leading-tight">
            Ghi nhớ mọi kiến thức với{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Quizlet Flashcard
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed">
            Học từ vựng ngoại ngữ, ôn thi đại học, trắc nghiệm y dược hay lập trình. Tăng tốc độ ghi nhớ gấp 3 lần với công nghệ lặp lại thông minh.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link href="/sets/new">
              <Button size="lg" className="h-12 px-8 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-base shadow-xl shadow-indigo-500/25 gap-2">
                Tạo học phần miễn phí <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/explore">
              <Button size="lg" variant="outline" className="h-12 px-8 rounded-full font-semibold text-base border-border hover:bg-muted/60">
                Khám phá kho học phần
              </Button>
            </Link>
          </div>

          {/* Interactive Preview Card Mockup */}
          <div className="max-w-2xl mx-auto pt-8">
            <div className="relative p-6 sm:p-8 rounded-2xl border-2 border-indigo-500/30 bg-card/80 backdrop-blur-md shadow-2xl text-left space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/40 pb-3">
                <span className="font-bold uppercase tracking-wider text-indigo-600">Thẻ mẫu • Tiếng Anh Giao Tiếp</span>
                <Badge variant="success" className="text-[10px]">Đã ghi nhớ</Badge>
              </div>
              <div className="py-4 text-center">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  Serendipity
                </h3>
                <p className="text-sm text-muted-foreground mt-2 italic">
                  /ˌser.ənˈdɪp.ə.t̬i/ • Danh từ
                </p>
                <p className="text-base text-foreground/90 font-medium mt-3 bg-indigo-50/50 dark:bg-indigo-950/40 py-2 px-4 rounded-xl inline-block border border-indigo-500/20">
                  Sự tình cờ may mắn tìm thấy những điều tuyệt vời
                </p>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                <span>Chế độ: Lật thẻ 3D + Phát âm AI</span>
                <span className="text-indigo-600 font-semibold">Nhấn để lật</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 LEARNING MODES SECTION */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="indigo" className="text-xs">Chế độ học đa dạng</Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            4 Phương thức ôn luyện toàn diện
          </h2>
          <p className="text-muted-foreground text-sm">
            Tùy biến cách bạn học để phù hợp với từng giai đoạn tiếp thu và ôn thi
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Flashcards */}
          <Card className="border-border/80 bg-card hover:border-indigo-500/50 hover:shadow-lg transition">
            <CardContent className="p-6 space-y-4">
              <div className="size-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                <BookOpen className="size-6" />
              </div>
              <h3 className="text-lg font-bold">Thẻ ghi nhớ (Flashcards)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Lật thẻ 3D trực quan, hỗ trợ phím tắt bàn phím và phát âm chuẩn để làm quen với từ vựng mới.
              </p>
            </CardContent>
          </Card>

          {/* Learn Mode */}
          <Card className="border-border/80 bg-card hover:border-blue-500/50 hover:shadow-lg transition">
            <CardContent className="p-6 space-y-4">
              <div className="size-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Brain className="size-6" />
              </div>
              <h3 className="text-lg font-bold">Chế độ Học (Learn)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Trắc nghiệm 4 đáp án thông minh, tự động phân loại từ chưa nhớ và lặp lại cho đến khi thành thạo.
              </p>
            </CardContent>
          </Card>

          {/* Test Mode */}
          <Card className="border-border/80 bg-card hover:border-emerald-500/50 hover:shadow-lg transition">
            <CardContent className="p-6 space-y-4">
              <div className="size-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <FileCheck2 className="size-6" />
              </div>
              <h3 className="text-lg font-bold">Chế độ Kiểm tra (Test)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Mô phỏng bài thi thực tế với trắc nghiệm, đúng/sai và tự luận để đánh giá chính xác năng lực.
              </p>
            </CardContent>
          </Card>

          {/* Match Game */}
          <Card className="border-border/80 bg-card hover:border-amber-500/50 hover:shadow-lg transition">
            <CardContent className="p-6 space-y-4">
              <div className="size-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Gamepad2 className="size-6" />
              </div>
              <h3 className="text-lg font-bold">Ghép thẻ (Match Game)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Trò chơi ghép thuật ngữ với định nghĩa tốc độ cao có bấm giờ, tạo động lực học tập hào hứng.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="py-16 bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Sẵn sàng nâng cao hiệu quả học tập ngay hôm nay?
          </h2>
          <p className="text-indigo-200 text-sm sm:text-base max-w-xl mx-auto">
            Tạo tài khoản và học phần đầu tiên của bạn chỉ trong chưa đầy 1 phút. Hoàn toàn miễn phí!
          </p>
          <div className="pt-2">
            <Link href="/signup">
              <Button size="lg" className="bg-white text-indigo-900 hover:bg-white/90 font-bold px-8 rounded-full shadow-xl">
                Bắt đầu miễn phí ngay
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
