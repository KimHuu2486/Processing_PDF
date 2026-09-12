// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { loaded: 0, started: { promise, resolve } };
});

vi.mock("./pdfJs", () => ({
  getDocument: () => {
    transport.loaded++;
    if (transport.loaded === 2) transport.started.resolve();
    return {
      // PDF.js can leave this pending even when destroy() has completed.
      promise: transport.loaded <= 2
        ? new Promise(() => {})
        : Promise.resolve({ numPages: 1 }),
      destroy: async () => {},
    };
  },
}));

import { loadPdfDocument } from "./pdfDocuments";

describe("PDF transport cancellation", () => {
  it("frees active and queued work when destroyed PDF tasks never settle", async () => {
    const controllers = [new AbortController(), new AbortController()];
    const reads = controllers.map((controller) =>
      loadPdfDocument(new File(["%PDF-1.7"], "loading.pdf"), controller.signal),
    );
    const rejections = reads.map((reading) =>
      expect(reading).rejects.toMatchObject({ name: "AbortError" }),
    );
    await transport.started.promise;
    const queuedController = new AbortController();
    let queuedFileRead = false;
    const queuedFile = new File(["%PDF-1.7"], "queued.pdf");
    Object.defineProperty(queuedFile, "arrayBuffer", { value: async () => {
      queuedFileRead = true;
      return new ArrayBuffer(8);
    } });
    const queued = loadPdfDocument(queuedFile, queuedController.signal);
    const queuedRejection = expect(queued).rejects.toMatchObject({ name: "AbortError" });
    queuedController.abort();
    controllers.forEach((controller) => controller.abort());
    await Promise.all([...rejections, queuedRejection]);

    const next = await loadPdfDocument(new File(["%PDF-1.7"], "next.pdf"));
    expect(next.document.numPages).toBe(1);
    expect(queuedFileRead).toBe(false);
    await next.close();
  });
});
