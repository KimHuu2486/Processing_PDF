# Product Landing README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến `README.md` thành trang giới thiệu web app song ngữ, có CTA đến live demo, ảnh giao diện thật và thông tin kỹ thuật chính xác.

**Architecture:** README được tổ chức theo luồng đọc product-first: hero và live demo trước, sau đó là preview, lợi ích, tính năng, privacy, hướng dẫn developer và giới hạn an toàn. Ảnh preview là tài nguyên cục bộ trong repository; mọi tuyên bố về tính năng và bảo mật được đối chiếu với mã nguồn hiện tại.

**Tech Stack:** GitHub Flavored Markdown, GitHub Actions badges, GitHub Pages, React, TypeScript, Vite, Tailwind CSS, pdf-lib, PDF.js, Vitest, Playwright.

## Global Constraints

- Trình bày song ngữ theo từng section, tiếng Việt trước và tiếng Anh cô đọng ngay sau đó.
- Giữ nguyên các thuật ngữ kỹ thuật phổ biến như PDF, client-side, Web Worker, Quick Start, CI và GitHub Pages.
- Live demo chính thức là `https://kimhuu2486.github.io/Processing_PDF/`.
- README phải mô tả đúng 7 công cụ trong `src/app/toolRegistry.ts`.
- Không thêm các section License, Contributing hoặc Changelog.
- Không tạo logo hoặc thay đổi giao diện web app.
- Không thay đổi workflow CI/CD hoặc dependency.
- Không loại bỏ cảnh báo về `CropBox`, PDF sanitizer và giới hạn RAM.
- Không commit nếu chưa có sự cho phép riêng của người dùng.

---

### Task 1: Tạo ảnh preview từ web app đang chạy

**Files:**
- Create: `docs/images/pdf-tools-home.png`
- Reference: `src/app/HomePage.tsx`
- Reference: `src/styles.css`

**Interfaces:**
- Consumes: Live demo tại `https://kimhuu2486.github.io/Processing_PDF/`.
- Produces: Ảnh PNG trang chủ để `README.md` nhúng bằng đường dẫn tương đối `docs/images/pdf-tools-home.png`.

- [x] **Step 1: Mở live demo ở viewport desktop**

Mở URL `https://kimhuu2486.github.io/Processing_PDF/` bằng browser automation với viewport khoảng `1440 × 1000`. Chờ trang hoàn tất render và xác nhận hero hiển thị dòng “Mọi công cụ PDF bạn cần, chạy ngay trên thiết bị”.

- [x] **Step 2: Kiểm tra ảnh không chứa trạng thái lỗi**

Xác nhận screenshot hiển thị hero, nhãn riêng tư và hàng thẻ công cụ đầu tiên; không có DevTools, popup quyền camera, loading indicator hoặc dữ liệu cá nhân.

- [x] **Step 3: Lưu screenshot**

Lưu ảnh chụp trang chủ vào:

```text
docs/images/pdf-tools-home.png
```

Ảnh phải đủ rõ khi GitHub co về chiều rộng khoảng 900px và không chụp toàn bộ trang theo chiều dọc nếu phần bên dưới làm nội dung chính bị quá nhỏ.

- [x] **Step 4: Kiểm tra tài nguyên ảnh**

Xác nhận file tồn tại, có định dạng PNG hợp lệ và có kích thước lớn hơn 0 byte.

### Task 2: Viết Product Landing README song ngữ

**Files:**
- Modify: `README.md`
- Consume: `docs/images/pdf-tools-home.png`
- Reference: `src/app/toolRegistry.ts`
- Reference: `package.json`
- Reference: `.github/workflows/ci.yml`
- Reference: `.github/workflows/pages.yml`
- Reference: `vite.config.ts`

**Interfaces:**
- Consumes: Screenshot từ Task 1 và dữ liệu đã xác minh từ source/config.
- Produces: README hoàn chỉnh có anchor, CTA, bảng tính năng, privacy, Quick Start, tech stack, deployment và limitations.

- [x] **Step 1: Thay header bằng hero product-first**

Phần đầu README phải chứa:

```markdown
<div align="center">

# PDF Tools

**Xử lý PDF riêng tư, ngay trên thiết bị.**  
*Private PDF processing, right in your browser.*

[![Deploy GitHub Pages](https://github.com/KimHuu2486/Processing_PDF/actions/workflows/pages.yml/badge.svg)](https://github.com/KimHuu2486/Processing_PDF/actions/workflows/pages.yml)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

[**Trải nghiệm ngay · Live Demo →**](https://kimhuu2486.github.io/Processing_PDF/)

</div>
```

Không thêm version badge cho package riêng tư và không dùng badge số sao,
download hoặc coverage chưa được xác minh. Không hiển thị CI badge khi trạng thái
workflow hiện tại đang failing; badge deployment đã được xác minh passing.

- [x] **Step 2: Nhúng product preview**

Ngay sau hero, thêm ảnh với alt text song ngữ:

```markdown
![Giao diện trang chủ PDF Tools — PDF Tools home screen](docs/images/pdf-tools-home.png)
```

- [x] **Step 3: Viết phần giới thiệu giá trị**

Thêm section `Tại sao chọn PDF Tools? / Why PDF Tools?` với ba ý:

- Tài liệu không được upload; xử lý diễn ra trong bộ nhớ của tab hiện tại.
- Không cần đăng ký, đăng nhập hoặc backend xử lý tài liệu.
- Static web app có thể tự host trên GitHub Pages.

Mỗi ý có câu tiếng Việt trước và câu tiếng Anh ngắn ngay sau, không nhân đôi thành hai section riêng.

- [x] **Step 4: Thêm bảng 7 tính năng**

Tạo bảng `Công cụ / Tools` gồm chính xác các dòng:

| Công cụ / Tool | Mô tả / Description |
|---|---|
| Gộp PDF / Merge PDF | Kết hợp nhiều tài liệu theo thứ tự đã chọn. / Combine multiple documents in your chosen order. |
| Tách PDF / Split PDF | Trích một khoảng trang liên tục thành file mới. / Extract a continuous page range into a new file. |
| Sắp xếp PDF / Organize PDF | Đổi thứ tự, xoay hoặc xóa trang. / Reorder, rotate, or remove pages. |
| Đánh số trang / Page Numbers | Chọn phạm vi, vị trí và cỡ chữ. / Choose the range, position, and font size. |
| Ảnh sang PDF / Images to PDF | Ghép và sắp xếp ảnh JPG hoặc PNG thành PDF. / Arrange JPG or PNG images into a PDF. |
| Quét sang PDF / Scan to PDF | Chụp bằng camera hoặc dùng ảnh có sẵn. / Capture with a camera or use existing images. |
| Cắt lề PDF / Crop PDF | Điều chỉnh vùng hiển thị của một hoặc nhiều trang. / Adjust the visible area of one or more pages. |

- [x] **Step 5: Viết Privacy & Security**

Nội dung phải phân biệt rõ giữa xử lý riêng tư và làm sạch file:

```markdown
## Quyền riêng tư & bảo mật / Privacy & Security

- PDF và ảnh chỉ được đọc vào bộ nhớ của tab hiện tại. / PDFs and images are read only into the current tab's memory.
- Không có database, analytics, local storage hay API xử lý tài liệu. / No database, analytics, local storage, or document-processing API is used.
- Metadata EXIF/XMP/IPTC và comment của JPEG được loại bỏ trước khi nhúng; EXIF orientation vẫn được áp dụng để hiển thị đúng chiều. / JPEG EXIF/XMP/IPTC metadata and comments are removed before embedding, while EXIF orientation is still applied.

> [!WARNING]
> PDF Tools không phải PDF sanitizer. Tệp đầu vào và đầu ra vẫn phải được xem là nội dung không tin cậy.  
> PDF Tools is not a PDF sanitizer. Treat both input and output files as untrusted content.
```

- [x] **Step 6: Viết Quick Start và quality checks**

Nêu Node.js `>=24`, sau đó dùng các lệnh đã có trong `package.json`:

```powershell
npm install
npm run dev
```

Khối kiểm tra:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

- [x] **Step 7: Viết Tech Stack**

Trình bày ngắn theo nhóm:

- UI: React 19, TypeScript 5, Tailwind CSS 4.
- PDF: pdf-lib, PDF.js.
- Tooling: Vite 8, Vitest 4, Playwright.
- Architecture: static web app và Web Worker cho các PDF job.

- [x] **Step 8: Viết Deployment**

Giữ quy trình GitHub Pages bốn bước, dùng `main`, GitHub Actions và URL mẫu. Giải thích workflow truyền `VITE_BASE_PATH=/${{ github.event.repository.name }}/` khi build, nhưng không tuyên bố hỗ trợ custom domain nếu chưa được cấu hình.

- [x] **Step 9: Viết Limitations bằng admonitions**

Phải có:

```markdown
> [!IMPORTANT]
> Crop chỉ thay đổi vùng hiển thị (`CropBox`), không xóa dữ liệu ẩn và không phù hợp để che thông tin nhạy cảm.  
> Cropping changes only the visible area (`CropBox`); it does not remove hidden data and must not be used for redaction.
```

Và một `NOTE` song ngữ nêu rõ chưa hỗ trợ PDF có mật khẩu, PDF hỏng, OCR, nén file, chuyển đổi Office; bookmark, form, attachment, metadata nâng cao và chữ ký số không được cam kết bảo toàn; file lớn phụ thuộc RAM thiết bị.

- [x] **Step 10: Rà soát độ dài và điều hướng**

Chỉ thêm mục lục nếu sau khi viết README dài đến mức người đọc phải cuộn qua nhiều section để tới Quick Start. Không tạo hai bản README tách biệt và không lặp lại toàn bộ nội dung theo ngôn ngữ.

### Task 3: Xác minh README và tài nguyên

**Files:**
- Verify: `README.md`
- Verify: `docs/images/pdf-tools-home.png`
- Verify: `docs/superpowers/specs/2026-07-31-readme-product-landing-design.md`

**Interfaces:**
- Consumes: README và screenshot hoàn thành.
- Produces: Bằng chứng README không có liên kết cục bộ hỏng, đủ 7 công cụ và không có lỗi whitespace.

- [x] **Step 1: Kiểm tra file và đường dẫn tương đối**

Xác nhận `docs/images/pdf-tools-home.png` tồn tại và đường dẫn trong `README.md` khớp chính xác, kể cả chữ hoa/chữ thường.

- [x] **Step 2: Kiểm tra link bên ngoài**

Gửi HEAD/GET tới các URL trong README, tối thiểu gồm live demo, workflow CI, workflow Pages và badge endpoints. Live demo phải trả HTTP 200; redirect hợp lệ của badge được chấp nhận.

- [x] **Step 3: Đối chiếu nội dung với source**

So sánh bảng tính năng với `src/app/toolRegistry.ts` và stack với `package.json`. Xác nhận đủ 7 công cụ, không thêm tính năng OCR/nén/chuyển đổi Office.

- [x] **Step 4: Kiểm tra Markdown và whitespace**

Chạy:

```powershell
git diff --check
```

Expected: không có output và exit code `0`.

- [x] **Step 5: Kiểm tra trạng thái Git**

Chạy:

```powershell
git status --short
```

Expected: chỉ có các thay đổi đã được duyệt cho README, screenshot, design spec và implementation plan; không commit.
