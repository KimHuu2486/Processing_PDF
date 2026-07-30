import { PdfToolError } from "./errors";
import type {
  CropMargins,
  ImageMimeType,
  InputSizeWarning,
  PageRange,
  PageRotation,
  PdfInput,
  PdfJob,
  SourceFile,
} from "./types";

export const LARGE_FILE_BYTES = 50 * 1024 * 1024;
export const LARGE_PAGE_COUNT = 200;
export const MIN_CROP_SIZE_POINTS = 36;

const VALID_ROTATIONS: ReadonlySet<PageRotation> = new Set([0, 90, 180, 270]);
const VALID_IMAGE_TYPES: ReadonlySet<string> = new Set(["image/jpeg", "image/png"]);
const VALID_PAGE_NUMBER_POSITIONS = new Set([
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

function assertInteger(value: number, message: string): void {
  if (!Number.isInteger(value)) {
    throw new PdfToolError("invalid-input", message);
  }
}

function validatePdfInput(input: PdfInput): void {
  if (!input.id.trim() || !input.name.trim() || input.blob.size === 0) {
    throw new PdfToolError("invalid-input", "File PDF đầu vào không hợp lệ.");
  }
}

export function validatePageRange(range: PageRange, pageCount: number): PageRange {
  assertInteger(pageCount, "Tổng số trang không hợp lệ.");
  assertInteger(range.start, "Trang bắt đầu phải là số nguyên.");
  assertInteger(range.end, "Trang kết thúc phải là số nguyên.");

  if (
    pageCount < 1 ||
    range.start < 1 ||
    range.end < range.start ||
    range.end > pageCount
  ) {
    throw new PdfToolError(
      "invalid-page-range",
      `Khoảng trang phải nằm trong 1–${Math.max(pageCount, 1)} và trang đầu không lớn hơn trang cuối.`,
    );
  }

  return { start: range.start, end: range.end };
}

export function validateCropMargins(crop: CropMargins): CropMargins {
  const values = [crop.left, crop.top, crop.right, crop.bottom];
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value >= 1)) {
    throw new PdfToolError(
      "invalid-input",
      "Các lề cắt phải là tỷ lệ từ 0 đến nhỏ hơn 1.",
    );
  }
  if (crop.left + crop.right >= 1 || crop.top + crop.bottom >= 1) {
    throw new PdfToolError("crop-too-small");
  }
  return { ...crop };
}

export function validatePdfJob(job: PdfJob): PdfJob {
  if (!job.id.trim()) {
    throw new PdfToolError("invalid-input", "Tác vụ PDF thiếu mã định danh.");
  }

  switch (job.type) {
    case "merge":
      if (job.sources.length < 2) {
        throw new PdfToolError("invalid-input", "Cần ít nhất hai file PDF để gộp.");
      }
      job.sources.forEach(validatePdfInput);
      break;
    case "split":
      validatePdfInput(job.source);
      assertInteger(job.range.start, "Trang bắt đầu phải là số nguyên.");
      assertInteger(job.range.end, "Trang kết thúc phải là số nguyên.");
      if (job.range.start < 1 || job.range.end < job.range.start) {
        throw new PdfToolError("invalid-page-range");
      }
      break;
    case "organize":
      validatePdfInput(job.source);
      if (job.pages.length === 0) {
        throw new PdfToolError("invalid-input", "PDF kết quả phải còn ít nhất một trang.");
      }
      for (const page of job.pages) {
        assertInteger(page.pageIndex, "Chỉ số trang phải là số nguyên.");
        if (
          page.sourceId !== job.source.id ||
          page.pageIndex < 0 ||
          !VALID_ROTATIONS.has(page.rotation)
        ) {
          throw new PdfToolError("invalid-input", "Danh sách trang sắp xếp không hợp lệ.");
        }
        if (page.crop) {
          validateCropMargins(page.crop);
        }
      }
      break;
    case "number-pages":
      validatePdfInput(job.source);
      assertInteger(job.range.start, "Trang bắt đầu phải là số nguyên.");
      assertInteger(job.range.end, "Trang kết thúc phải là số nguyên.");
      assertInteger(job.startNumber, "Số bắt đầu phải là số nguyên.");
      if (
        job.range.start < 1 ||
        job.range.end < job.range.start ||
        !VALID_PAGE_NUMBER_POSITIONS.has(job.position) ||
        !Number.isFinite(job.fontSize) ||
        job.fontSize < 8 ||
        job.fontSize > 48 ||
        !Number.isFinite(job.margin) ||
        job.margin < 0 ||
        job.margin > 72
      ) {
        throw new PdfToolError("invalid-input", "Thiết lập đánh số trang không hợp lệ.");
      }
      break;
    case "images-to-pdf":
      if (job.images.length === 0) {
        throw new PdfToolError("invalid-input", "Cần ít nhất một ảnh để tạo PDF.");
      }
      if (
        job.margin !== undefined &&
        (!Number.isFinite(job.margin) || job.margin < 0 || job.margin > 72)
      ) {
        throw new PdfToolError("invalid-input", "Lề ảnh phải nằm trong khoảng 0–72 pt.");
      }
      for (const image of job.images) {
        if (
          !image.id.trim() ||
          !image.name.trim() ||
          image.blob.size === 0 ||
          !VALID_IMAGE_TYPES.has(image.mimeType) ||
          !VALID_ROTATIONS.has(image.rotation) ||
          (image.exifOrientation !== undefined &&
            (!Number.isInteger(image.exifOrientation) ||
              image.exifOrientation < 1 ||
              image.exifOrientation > 8))
        ) {
          throw new PdfToolError("unsupported-image");
        }
      }
      break;
    case "crop":
      validatePdfInput(job.source);
      validateCropMargins(job.crop);
      if (job.pageIndices.length === 0) {
        throw new PdfToolError("invalid-input", "Hãy chọn ít nhất một trang để cắt.");
      }
      for (const pageIndex of job.pageIndices) {
        assertInteger(pageIndex, "Chỉ số trang phải là số nguyên.");
        if (pageIndex < 0) {
          throw new PdfToolError("invalid-input", "Chỉ số trang không hợp lệ.");
        }
      }
      break;
  }

  return job;
}

export function getLargeInputWarning(
  files: ReadonlyArray<Pick<SourceFile, "size" | "pageCount">>,
): InputSizeWarning | null {
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  const totalPages = files.reduce((total, file) => total + (file.pageCount ?? 0), 0);
  const exceedsBytes = totalBytes > LARGE_FILE_BYTES;
  const exceedsPages = totalPages > LARGE_PAGE_COUNT;

  if (!exceedsBytes && !exceedsPages) {
    return null;
  }

  const reasons = [
    exceedsBytes ? "dung lượng vượt 50 MiB" : "",
    exceedsPages ? "tổng số trang vượt 200" : "",
  ].filter(Boolean);

  return {
    totalBytes,
    totalPages,
    exceedsBytes,
    exceedsPages,
    message: `Tài liệu có ${reasons.join(" và ")}. Trình duyệt có thể xử lý chậm hoặc hết bộ nhớ.`,
  };
}

function createId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ? `${prefix}-${randomId}` : `${prefix}-${Date.now()}-${Math.random()}`;
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function imageMimeType(file: File): ImageMimeType | null {
  if (file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) {
    return "image/jpeg";
  }
  if (file.type === "image/png" || /\.png$/i.test(file.name)) {
    return "image/png";
  }
  return null;
}

export async function fileToPdfInput(file: File, id = createId("pdf")): Promise<PdfInput> {
  if (!isPdfFile(file)) {
    throw new PdfToolError("invalid-input", "Chỉ hỗ trợ file có định dạng PDF.");
  }
  const input = { id, name: file.name, blob: file };
  validatePdfInput(input);
  return input;
}

export async function fileToImageInput(
  file: File,
  id = createId("image"),
  rotation: PageRotation = 0,
): Promise<import("./types").ImageInput> {
  const mimeType = imageMimeType(file);
  if (!mimeType || !VALID_ROTATIONS.has(rotation)) {
    throw new PdfToolError("unsupported-image");
  }

  if (file.size === 0) {
    throw new PdfToolError("invalid-input", "File ảnh rỗng.");
  }

  return {
    id,
    name: file.name,
    blob: file,
    mimeType,
    rotation,
  };
}
