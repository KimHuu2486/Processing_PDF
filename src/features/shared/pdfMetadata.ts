import { getDocument } from "./pdfJs";

export type PdfMetadata = {
  pageCount: number;
};

export async function readPdfMetadata(file: File): Promise<PdfMetadata> {
  const task = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    stopAtErrors: true,
  });

  try {
    const document = await task.promise;
    const pageCount = document.numPages;
    if (pageCount < 1) {
      throw new Error("PDF không có trang.");
    }
    return { pageCount };
  } catch {
    throw new Error(
      `Không thể đọc “${file.name}”. PDF có thể bị hỏng hoặc có mật khẩu.`,
    );
  } finally {
    await task.destroy();
  }
}
