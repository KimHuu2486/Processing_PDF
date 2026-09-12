import { PdfToolError } from "./errors";
import type { ImageMimeType } from "./types";

/** Names and browser MIME hints can disagree with the actual encoded bytes. */
export async function detectImageMimeType(blob: Blob): Promise<ImageMimeType> {
  if (!blob.size) throw new PdfToolError("invalid-input", "File ảnh rỗng.");
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  if (png.every((byte, index) => bytes[index] === byte)) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  throw new PdfToolError("unsupported-image", "Nội dung tệp không phải ảnh JPG hoặc PNG hợp lệ.");
}
