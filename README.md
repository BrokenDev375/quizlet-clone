# 📚 Quizlet Clone — Nền tảng học tập Flashcard thông minh

Ứng dụng web học tập Flashcard lấy cảm hứng từ Quizlet, hỗ trợ đầy đủ 4 chế độ học tập (Flashcards 3D, Learn trắc nghiệm, Test kiểm tra tổng hợp, Match Game phản xạ tốc độ), quản lý bộ thẻ, phân quyền bảo mật cao với Supabase RLS và giao diện Tailwind CSS hiện đại.

---

## ✨ Tính năng nổi bật

### 🗂️ 1. Quản lý học phần (Flashcard Sets)
- **Tạo & chỉnh sửa bộ thẻ**: Thêm tiêu đề, mô tả, từ vựng và định nghĩa không giới hạn.
- **Import nhanh dữ liệu**: Nhập hàng chục từ vựng cùng lúc từ văn bản hoặc file CSV/Tab-separated chỉ với 1 cú click.
- **Quyền riêng tư linh hoạt**: Tùy chỉnh chế độ **Công khai (Public)** hoặc **Riêng tư (Private)**.

### 🎯 2. 4 Chế độ học tập toàn diện
- 🎴 **Thẻ ghi nhớ (Flashcards 3D)**: Hiệu ứng lật thẻ 3D trực quan, hỗ trợ phím tắt (`Space` để lật, `←` `→` để chuyển thẻ, nút trộn thẻ ngẫu nhiên) và phát âm AI (Text-to-Speech).
- 🧠 **Chế độ Học (Learn Mode)**: Trắc nghiệm 4 đáp án thông minh, theo dõi độ chính xác thời gian thực, tự động gom các từ chưa nhớ để ôn lại vòng sau.
- 📝 **Chế độ Kiểm tra (Test Mode)**: Mô phỏng bài thi thực tế đa dạng câu hỏi (Trắc nghiệm, Đúng/Sai, Tự luận), tự động chấm điểm và hiển thị đáp án chi tiết.
- ⚡ **Trò chơi Ghép thẻ (Match Game)**: Game ghép cặp thuật ngữ - định nghĩa tốc độ cao với đồng hồ bấm giờ mili-giây và bảng xếp hạng kỷ lục.

### 🌐 3. Khám phá & Cá nhân hóa
- **Khám phá cộng đồng (Explore)**: Tìm kiếm học phần theo từ khóa và danh mục học tập (Tiếng Anh, CNTT, Y Dược, Khoa học...).
- **Thư viện cá nhân (Dashboard)**: Quản lý toàn bộ học phần đã tạo, thống kê số lượng thẻ và học phần.
- **Trang cá nhân (Profile)**: Xem các học phần công khai của từng thành viên.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **Frontend & Framework**: [Next.js 16 (App Router)](https://nextjs.org/) + [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Giao diện & Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) + [Lucide Icons](https://lucide.dev/)
- **Cơ sở dữ liệu & Xác thực**: [Supabase](https://supabase.com/) (PostgreSQL, Supabase Auth, Row Level Security - RLS)
- **Triển khai (Deployment)**: [Vercel](https://vercel.com/)

---

## 🚀 Cài đặt và chạy thử nghiệm (Local Development)

### 1. Clone repository
```bash
git clone https://github.com/BrokenDev375/quizlet-clone.git
cd quizlet-clone
```

### 2. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 3. Cấu hình biến môi trường
Tạo file `.env.local` tại thư mục gốc của dự án:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Khởi tạo Database trên Supabase
1. Mở trang quản trị Supabase $\rightarrow$ **SQL Editor**.
2. Sao chép nội dung file `supabase/schema.sql` và nhấn **Run** để khởi tạo các bảng và phân quyền RLS.

### 5. Chạy ứng dụng
```bash
npm run dev
```
Mở trình duyệt tại địa chỉ [http://localhost:3000](http://localhost:3000).

---

## ☁️ Triển khai lên Vercel (Deployment)

1. Đẩy mã nguồn lên GitHub.
2. Truy cập [Vercel Dashboard](https://vercel.com/new) và Import repository này.
3. Trong phần **Environment Variables**, thêm 2 biến:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Bấm **Deploy**.

---

## 📄 Bản quyền (License)

Dự án được xây dựng phục vụ mục đích học tập và nghiên cứu.
Phát triển bởi **[BrokenDev375](https://github.com/BrokenDev375)**.
