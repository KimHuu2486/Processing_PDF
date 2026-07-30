import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
if (typeof Worker !== "undefined") {
  const workerState = globalThis as typeof globalThis & {
    __pdfToolsPreviewWorker?: Worker;
  };
  workerState.__pdfToolsPreviewWorker ??= new Worker(pdfWorkerUrl, {
    type: "module",
    name: "pdfjs-preview-worker",
  });
  GlobalWorkerOptions.workerPort = workerState.__pdfToolsPreviewWorker;
}

export { getDocument };
