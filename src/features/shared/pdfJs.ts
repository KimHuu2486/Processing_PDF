import { GlobalWorkerOptions, getDocument as createDocument, PDFWorker } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
// Start loading the worker with the tool, preserving offline use after page load.
let owner: PDFWorker | undefined = typeof Worker === "undefined" ? undefined : createOwner();

function createOwner() {
  const worker = PDFWorker.create({});
  void worker.promise.catch(() => {
    worker.destroy();
    if (owner === worker) owner = undefined;
  });
  return worker;
}

/** Loading tasks borrow this worker; task.destroy() only closes their document. */
export function getDocument(parameters: Parameters<typeof createDocument>[0]) {
  if (!owner || owner.destroyed) {
    owner = createOwner();
  }
  return createDocument({ ...parameters, worker: owner });
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    owner?.destroy();
  });
}
