import { EncryptedPDFError } from "pdf-lib";

import type { PdfErrorCode, PdfErrorInfo } from "./types";

const DEFAULT_MESSAGES: Record<PdfErrorCode, string> = {
  busy: "Một tác vụ PDF khác đang được xử lý.",
  cancelled: "Đã hủy xử lý PDF.",
  "corrupt-pdf": "Không thể đọc file PDF. File có thể bị hỏng hoặc không hợp lệ.",
  "crop-too-small": "Vùng cắt phải có chiều rộng và chiều cao tối thiểu 36 pt.",
  "empty-pdf": "File PDF không có trang nào.",
  "encrypted-pdf": "PDF có mật khẩu hoặc được mã hóa nên chưa thể xử lý.",
  "invalid-input": "Dữ liệu đầu vào không hợp lệ.",
  "invalid-page-range": "Khoảng trang không hợp lệ.",
  "processing-failed": "Không thể hoàn tất xử lý PDF.",
  "unsupported-image": "Chỉ hỗ trợ ảnh JPG, JPEG và PNG.",
};

export class PdfToolError extends Error {
  readonly code: PdfErrorCode;
  readonly details?: string;

  constructor(code: PdfErrorCode, message = DEFAULT_MESSAGES[code], details?: string) {
    super(message);
    this.name = "PdfToolError";
    this.code = code;
    this.details = details;
  }
}

export function toPdfErrorInfo(error: unknown): PdfErrorInfo {
  if (error instanceof PdfToolError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    };
  }

  if (error instanceof EncryptedPDFError) {
    return {
      code: "encrypted-pdf",
      message: DEFAULT_MESSAGES["encrypted-pdf"],
    };
  }

  const details = error instanceof Error ? error.message : String(error);
  return {
    code: "processing-failed",
    message: DEFAULT_MESSAGES["processing-failed"],
    ...(details ? { details } : {}),
  };
}

export function normalizePdfError(error: unknown): PdfToolError {
  if (error instanceof PdfToolError) {
    return error;
  }

  const info = toPdfErrorInfo(error);
  return new PdfToolError(info.code, info.message, info.details);
}
