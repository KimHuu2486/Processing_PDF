# PDF Tool

Công cụ Python chạy bằng dòng lệnh để gộp nhiều PDF hoặc trích một khoảng trang
thành file PDF mới.

## Cài đặt

Yêu cầu Python 3.10 trở lên.

```powershell
python -m pip install -r requirements.txt
```

## Sử dụng

### Gộp PDF

Các file được gộp theo đúng thứ tự đã nhập:

```powershell
python pdf_tool.py merge file1.pdf file2.pdf -o merged.pdf
```

### Trích một khoảng trang

Số trang bắt đầu từ `1`; cả trang đầu và trang cuối đều được đưa vào kết quả:

```powershell
python pdf_tool.py split input.pdf --pages 3-8 -o pages_3_8.pdf
```

Theo mặc định, công cụ không ghi đè file đã tồn tại. Thêm `--force` ở cuối lệnh
nếu bạn thực sự muốn ghi đè.

> [!NOTE]
> Phiên bản hiện tại chưa hỗ trợ PDF có mật khẩu.

## Kiểm thử

```powershell
python -m unittest discover -s tests -v
```
