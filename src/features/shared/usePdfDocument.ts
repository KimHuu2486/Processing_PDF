import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useState } from "react";

import { loadPdfDocument, type PdfDocumentHandle } from "./pdfDocuments";

type LoadedState = {
  file: File;
  document: PDFDocumentProxy | null;
  error: string | null;
};

export function usePdfDocument(file: File | null) {
  const [loaded, setLoaded] = useState<LoadedState | null>(null);

  useEffect(() => {
    if (!file) return;

    const controller = new AbortController();
    let handle: PdfDocumentHandle | undefined;
    void loadPdfDocument(file, controller.signal).then(async (loaded) => {
      if (controller.signal.aborted) {
        await loaded.close();
        return;
      }
      handle = loaded;
      setLoaded({ file, document: loaded.document, error: null });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setLoaded({
          file, document: null,
          error: error instanceof Error ? error.message : "Không thể hiển thị PDF.",
        });
      }
    });

    return () => {
      controller.abort();
      void handle?.close().catch(() => {});
    };
  }, [file]);

  if (!file) {
    return { document: null, error: null, loading: false };
  }
  if (!loaded || loaded.file !== file) {
    return { document: null, error: null, loading: true };
  }
  return {
    document: loaded.document,
    error: loaded.error,
    loading: false,
  };
}
