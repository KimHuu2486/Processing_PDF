import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";

import { getDocument } from "./pdfJs";
import { abortable } from "./abortable";

type QueuedLoad = { run: () => void };
const queue: QueuedLoad[] = [];
let active = 0;
const MAX_CONCURRENT_LOADS = 2;

function pump() {
  while (active < MAX_CONCURRENT_LOADS && queue.length) queue.shift()!.run();
}

function schedule<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      const index = queue.indexOf(entry);
      if (index >= 0) queue.splice(index, 1);
      reject(new DOMException("Đã hủy đọc PDF.", "AbortError"));
    };
    const entry: QueuedLoad = { run: () => {
      signal?.removeEventListener("abort", abort);
      if (signal?.aborted) { abort(); return; }
      active++;
      void operation().then(resolve, reject).finally(() => { active--; pump(); });
    } };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    queue.push(entry);
    pump();
  });
}

function pdfReadError(error: unknown): Error {
  if (error instanceof Error && error.name === "AbortError") return error;
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "PasswordException") return new Error("PDF có mật khẩu hoặc được mã hóa nên chưa thể đọc.", { cause: error });
  if (name === "InvalidPDFException") return new Error("PDF bị hỏng hoặc có cấu trúc không hợp lệ.", { cause: error });
  return new Error("Không thể đọc PDF trong trình duyệt này. Hãy thử tải lại trang hoặc cập nhật trình duyệt.", { cause: error });
}

export type PdfDocumentHandle = {
  document: PDFDocumentProxy;
  close: () => Promise<void>;
};

export function loadPdfDocument(file: File, signal?: AbortSignal): Promise<PdfDocumentHandle> {
  return schedule(async () => {
    let task: PDFDocumentLoadingTask | undefined;
    let closing: Promise<void> | undefined;
    const close = () => {
      signal?.removeEventListener("abort", onAbort);
      return closing ??= task?.destroy() ?? Promise.resolve();
    };
    const onAbort = () => { void close().catch(() => {}); };
    try {
      signal?.throwIfAborted();
      if (!file.size) throw new Error("File PDF rỗng.");
      const bytes = await abortable(file.arrayBuffer(), signal);
      signal?.throwIfAborted();
      task = getDocument({ data: new Uint8Array(bytes), stopAtErrors: true });
      signal?.addEventListener("abort", onAbort, { once: true });
      const document = await abortable(task.promise, signal);
      signal?.throwIfAborted();
      if (document.numPages < 1) throw new Error("PDF không có trang.");
      return { document, close };
    } catch (error) {
      await close().catch(() => {});
      signal?.throwIfAborted();
      if (!file.size || (error instanceof Error && error.message === "PDF không có trang.")) throw error;
      throw pdfReadError(error);
    }
  }, signal);
}
