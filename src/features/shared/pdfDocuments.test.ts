// @vitest-environment node
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

// PDF.js's Node environment needs the polyfills shipped in its existing legacy build.
await import("pdfjs-dist/legacy/build/pdf.mjs");
// @ts-expect-error PDF.js does not publish declarations for its worker entry.
await import("pdfjs-dist/build/pdf.worker.mjs");
const { loadPdfDocument } = await import("./pdfDocuments");
const { readPdfMetadata } = await import("./pdfMetadata");

async function pdfFile(name = "valid.pdf") {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = new Uint8Array(await pdf.save());
  return new File([bytes], name, { type: "application/pdf" });
}

describe("shared PDF document lifecycle", () => {
  it("can load another document while a previous document closes", async () => {
    const first = await loadPdfDocument(await pdfFile("a.pdf"));
    const second = await loadPdfDocument(await pdfFile("b.pdf"));
    const closing = first.close();
    const third = await loadPdfDocument(await pdfFile("c.pdf"));
    await closing;
    expect((await second.document.getPage(1)).pageNumber).toBe(1);
    expect((await third.document.getPage(1)).pageNumber).toBe(1);
    await Promise.all([second.close(), third.close()]);
  });

  it("rejects aborted reads without touching the file", async () => {
    const controller = new AbortController();
    controller.abort();
    const file = await pdfFile();
    Object.defineProperty(file, "arrayBuffer", { value: () => { throw new Error("Must not read"); } });
    await expect(loadPdfDocument(file, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("settles active cancellation and frees both loading slots for later files", async () => {
    const controllers = [new AbortController(), new AbortController()];
    const reads = await Promise.all(controllers.map(async (controller) => {
      const file = await pdfFile();
      Object.defineProperty(file, "arrayBuffer", { value: () => new Promise<ArrayBuffer>(() => {}) });
      const reading = loadPdfDocument(file, controller.signal);
      const rejected = expect(reading).rejects.toMatchObject({ name: "AbortError" });
      controller.abort();
      return rejected;
    }));
    await Promise.all(reads);
    const next = await loadPdfDocument(await pdfFile());
    expect(next.document.numPages).toBe(1);
    await next.close();
  });

  it("reports an empty PDF separately from corrupt data", async () => {
    await expect(readPdfMetadata(new File([], "empty.pdf"))).rejects.toThrow(/rỗng/);
    await expect(readPdfMetadata(new File(["garbage"], "broken.pdf"))).rejects.toThrow(/hỏng|không hợp lệ/);
    await expect(readPdfMetadata(await pdfFile())).resolves.toEqual({ pageCount: 1 });
  });
});
