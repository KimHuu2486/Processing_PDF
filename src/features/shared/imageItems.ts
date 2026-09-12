import type { PageRotation } from "../../pdf/types";
import { detectImageMimeType } from "../../pdf/imageFormat";

export type SelectedImage = {
  id: string;
  file: File;
  previewUrl: string;
  rotation: PageRotation;
};

export async function selectImage(file: File, signal?: AbortSignal): Promise<SelectedImage> {
  signal?.throwIfAborted();
  const mimeType = await detectImageMimeType(file);
  signal?.throwIfAborted();
  const normalized = file.type === mimeType ? file : new File([file], file.name, {
    type: mimeType, lastModified: file.lastModified,
  });
  const previewUrl = URL.createObjectURL(normalized);
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      const cleanup = () => {
        image.onload = null;
        image.onerror = null;
        signal?.removeEventListener("abort", abort);
      };
      const abort = () => {
        cleanup();
        image.src = "";
        reject(new DOMException("Đã hủy đọc ảnh.", "AbortError"));
      };
      image.onload = () => {
        cleanup();
        if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve();
        else reject(new Error("Không thể đọc ảnh. File có thể bị hỏng."));
      };
      image.onerror = () => {
        cleanup();
        reject(new Error("Không thể đọc ảnh. File có thể bị hỏng hoặc trình duyệt không hỗ trợ cách mã hóa này."));
      };
      signal?.addEventListener("abort", abort, { once: true });
      image.src = previewUrl;
    });
    signal?.throwIfAborted();
    return { id: crypto.randomUUID(), file: normalized, previewUrl, rotation: 0 };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}

export function releaseSelectedImage(image: SelectedImage) {
  URL.revokeObjectURL(image.previewUrl);
}

export function rotateImage(
  image: SelectedImage,
  direction: 90 | -90 = 90,
): SelectedImage {
  const rotation = ((image.rotation + direction + 360) % 360) as PageRotation;
  return { ...image, rotation };
}
