# PDF Tools

Bộ công cụ PDF tiếng Việt chạy hoàn toàn trong trình duyệt. Tài liệu không được
upload, không có backend và không được lưu lại sau khi đóng tab.

## Tính năng

- Gộp và tách một khoảng trang PDF.
- Sắp xếp, xoay hoặc xóa trang.
- Thêm số trang theo vị trí tùy chọn.
- Chuyển nhiều ảnh JPG/PNG thành PDF.
- Chụp tài liệu bằng camera và tạo PDF ảnh.
- Crop vùng hiển thị của trang PDF.

## Chạy trên máy

Yêu cầu Node.js 24 trở lên.

```powershell
npm install
npm run dev
```

Các lệnh kiểm tra:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

## Triển khai GitHub Pages

1. Tạo public repository tên `processing-pdf`.
2. Push mã nguồn lên nhánh `main`.
3. Trong **Settings → Pages → Build and deployment**, chọn **GitHub Actions**.
4. Workflow sẽ kiểm tra, build và publish thư mục `dist`.

URL mặc định có dạng:
`https://<github-username>.github.io/processing-pdf/`.
Workflow tự lấy tên repository làm base path, nên asset và worker vẫn hoạt động
nếu bạn dùng một tên repository khác.

> [!IMPORTANT]
> Crop chỉ thay đổi vùng hiển thị (`CropBox`), không xóa dữ liệu ẩn và không
> được dùng như công cụ che thông tin nhạy cảm.

> [!NOTE]
> PDF có mật khẩu, PDF hỏng, OCR, nén file và chuyển đổi Office không nằm trong
> phạm vi phiên bản này. Bookmark, form, attachment, metadata nâng cao và chữ ký
> số không được cam kết bảo toàn khi chỉnh sửa. Với file lớn, khả năng xử lý phụ
> thuộc RAM của thiết bị.

> [!WARNING]
> PDF Tools không phải công cụ làm sạch (sanitizer) PDF. PDF đầu vào và kết quả
> vẫn phải được xem là nội dung không tin cậy. Ảnh có độ phân giải cực lớn hoặc
> PDF có kích thước trang bất thường vẫn có thể làm tab hết bộ nhớ dù file nén nhỏ.

## Quyền riêng tư

PDF và ảnh chỉ được đọc vào bộ nhớ của tab hiện tại. Ứng dụng không dùng
database, analytics, local storage hay API xử lý tài liệu.

Khi chuyển JPG thành PDF, EXIF/XMP/IPTC, comment và các segment metadata JPEG
được loại bỏ trước khi nhúng; hướng EXIF vẫn được áp dụng cho cách hiển thị ảnh.
