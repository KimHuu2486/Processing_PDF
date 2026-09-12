import { loadPdfDocument } from "./pdfDocuments";

export type PdfMetadata = {
  pageCount: number;
};

export async function readPdfMetadata(file: File, signal?: AbortSignal): Promise<PdfMetadata> {
  const handle = await loadPdfDocument(file, signal);
  try {
    return { pageCount: handle.document.numPages };
  } finally {
    await handle.close();
  }
}
