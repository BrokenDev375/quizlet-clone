# 📚 Quizlet Clone — Nền tảng học tập Flashcard thông minh

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://quizlet-clone-7471r43y7-thanh-djts-projects.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js%2016-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

Ứng dụng web học tập Flashcard trực tuyến lấy cảm hứng từ Quizlet, hỗ trợ đầy đủ 4 chế độ học tập thông minh, quản lý bộ thẻ, phân quyền bảo mật với Supabase RLS và giao diện Tailwind CSS hiện đại.

🌐 **Trải nghiệm trực tiếp:** [https://quizlet-clone-7471r43y7-thanh-djts-projects.vercel.app](https://quizlet-clone-7471r43y7-thanh-djts-projects.vercel.app)

---

## ✨ Tính năng nổi bật

### 🗂️ 1. Quản lý học phần (Flashcard Sets)
- **Tạo & chỉnh sửa bộ thẻ**: Thêm tiêu đề, mô tả, từ vựng và định nghĩa không giới hạn.
- **Import nhanh dữ liệu**: Nhập hàng chục từ vựng cùng lúc từ văn bản hoặc file CSV/Tab-separated chỉ với 1 cú click.
- **Quyền riêng tư linh hoạt**: Tùy chỉnh chế độ **Công khai (Public)** hoặc **Riêng tư (Private)**.

### 🎯 2. 4 Chế độ học tập toàn diện
- 🎴 **Thẻ ghi nhớ (Flashcards 3D)**: Hiệu ứng lật thẻ 3D trực quan, hỗ trợ phím tắt (`Space` để lật thẻ, `←` `→` để chuyển thẻ, nút trộn thẻ ngẫu nhiên) và phát âm AI (Text-to-Speech).
- 🧠 **Chế độ Học (Learn Mode)**: Trắc nghiệm 4 đáp án thông minh, theo dõi độ chính xác thời gian thực, tự động gom các từ chưa nhớ để ôn lại vòng sau.
- 📝 **Chế độ Kiểm tra (Test Mode)**: Mô phỏng bài thi thực tế đa dạng câu hỏi (Trắc nghiệm, Đúng/Sai, Tự luận), tự động chấm điểm và hiển thị đáp án chi tiết.
- ⚡ **Trò chơi Ghép thẻ (Match Game)**: Game ghép cặp thuật ngữ - định nghĩa tốc độ cao với đồng hồ bấm giờ mili-giây và bảng xếp hạng kỷ lục.

### 🌐 3. Khám phá & Cá nhân hóa
- **Khám phá cộng đồng (Explore)**: Tìm kiếm học phần theo từ khóa và danh mục học tập (Tiếng Anh, CNTT, Y Dược, Khoa học...).
- **Thư viện cá nhân (Dashboard)**: Quản lý toàn bộ học phần đã tạo, thống kê số lượng thẻ và học phần.
- **Trang cá nhân (Profile)**: Xem các học phần công khai của từng thành viên.
- **Xác thực an toàn (Authentication)**: Đăng nhập / Đăng ký nhanh chóng qua Email hoặc Google OAuth.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **Frontend & Framework**: [Next.js 16 (App Router)](https://nextjs.org/) + [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Giao diện & Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) + [Lucide Icons](https://lucide.dev/)
- **Cơ sở dữ liệu & Xác thực**: [Supabase](https://supabase.com/) (PostgreSQL, Supabase Auth, Row Level Security - RLS)
- **Triển khai (Deployment)**: [Vercel](https://vercel.com/)

---

## 📄 Bản quyền & Tác giả

Dự án được xây dựng phục vụ mục đích học tập và nghiên cứu.
Phát triển bởi **[BrokenDev375](https://github.com/BrokenDev375)**.
