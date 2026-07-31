# Thiết kế README theo hướng Product Landing

## Mục tiêu

Thiết kế lại `README.md` thành trang giới thiệu chuyên nghiệp cho PDF Tools, giúp
người xem nhanh chóng hiểu giá trị sản phẩm và mở bản chạy thật. README phục vụ cả
người dùng Việt Nam lẫn người đọc quốc tế, nhưng vẫn giữ phần kỹ thuật đủ ngắn gọn
cho developer muốn chạy hoặc triển khai dự án.

Live demo chính thức:
<https://kimhuu2486.github.io/Processing_PDF/>

## Đối tượng

- Người dùng muốn xử lý PDF mà không tải tài liệu lên máy chủ.
- Developer muốn xem stack, chạy dự án cục bộ hoặc triển khai GitHub Pages.
- Người duyệt repository cần đánh giá nhanh tính năng, quyền riêng tư và chất lượng
  kỹ thuật.

## Ngôn ngữ và giọng điệu

- Trình bày song ngữ theo từng section, tiếng Việt trước và tiếng Anh cô đọng ngay
  sau đó.
- Giữ nguyên các thuật ngữ kỹ thuật phổ biến như PDF, client-side, Web Worker,
  Quick Start, CI và GitHub Pages.
- Giọng điệu rõ ràng, đáng tin cậy và hướng sản phẩm; không dùng tuyên bố tiếp thị
  không thể kiểm chứng.
- Hạn chế emoji và badge trang trí.

## Cấu trúc nội dung

1. **Hero**
   - Tên `PDF Tools`.
   - Tagline song ngữ nhấn mạnh xử lý ngay trên thiết bị.
   - Badge CI, deployment, React và TypeScript khi URL badge có thể xác định chính
     xác từ repository.
   - CTA nổi bật bằng liên kết văn bản/badge: `Trải nghiệm ngay / Live Demo`.

2. **Product preview**
   - Một screenshot trang chủ đặt ngay sau hero và CTA.
   - Ảnh phải phản ánh giao diện thật, có alt text song ngữ và được lưu trong
     repository để không phụ thuộc dịch vụ ảnh bên ngoài.

3. **Value proposition**
   - Không upload tài liệu.
   - Không cần tài khoản.
   - Xử lý client-side và có thể triển khai như static web app.

4. **Features**
   - Trình bày đúng 7 công cụ đang có: gộp, tách, sắp xếp, đánh số trang, ảnh sang
     PDF, quét sang PDF và cắt lề.
   - Dùng bảng ngắn để người đọc quét nhanh; mỗi dòng có tên song ngữ và mô tả cô
     đọng.

5. **Privacy and security**
   - Tài liệu chỉ được đọc vào bộ nhớ của tab hiện tại.
   - Ứng dụng không có backend xử lý tài liệu, database, analytics hoặc local
     storage.
   - Metadata JPEG nhạy cảm được loại bỏ trước khi nhúng, trong khi EXIF
     orientation vẫn được áp dụng khi hiển thị.

6. **Quick Start**
   - Nêu yêu cầu Node.js 24 trở lên.
   - Giữ hướng dẫn cài dependency và chạy development server.
   - Tách các lệnh quality check vào khối riêng, không làm phần giới thiệu bị nặng.

7. **Tech Stack**
   - React, TypeScript, Vite, Tailwind CSS, pdf-lib, PDF.js, Vitest và Playwright.
   - Chỉ liệt kê công nghệ có trong `package.json`.

8. **Deployment**
   - Mô tả ngắn quy trình GitHub Pages và hành vi tự xác định base path từ tên
     repository.

9. **Limitations and safety**
   - Crop chỉ thay đổi `CropBox`, không xóa dữ liệu ẩn.
   - Ứng dụng không phải PDF sanitizer.
   - Nêu phạm vi chưa hỗ trợ: PDF có mật khẩu, PDF hỏng, OCR, nén và chuyển đổi
     Office.
   - Cảnh báo giới hạn RAM đối với file hoặc ảnh rất lớn.

## Yêu cầu trình bày

- Dùng GitHub Flavored Markdown và GitHub admonitions cho các cảnh báo quan trọng.
- Mục lục chỉ thêm nếu README sau cùng đủ dài để mang lại giá trị điều hướng.
- Không thêm các section License, Contributing hoặc Changelog.
- Không tạo logo giả khi dự án chưa có nhận diện thương hiệu.
- Không dùng badge với số liệu hoặc trạng thái chưa được xác minh.

## Tiêu chí nghiệm thu

- Link live demo mở đúng trang GitHub Pages và được đặt trong vùng đầu README.
- Toàn bộ 7 công cụ khớp với `src/app/toolRegistry.ts`.
- Nội dung song ngữ tự nhiên, không sao chép nguyên cả README thành hai nửa dài.
- Các tuyên bố privacy và security không vượt quá hành vi có thể xác minh từ mã
  nguồn.
- README hiển thị tốt trên GitHub desktop và mobile.
- Không loại bỏ cảnh báo an toàn đang có trong README hiện tại.

## Ngoài phạm vi

- Thiết kế logo hoặc bộ nhận diện thương hiệu mới.
- Thay đổi giao diện hoặc hành vi của web app.
- Thay đổi workflow CI/CD.
- Thêm tài liệu License, Contributing hoặc Changelog.
