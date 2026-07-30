import {
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import { useEffect, useState } from "react";

import { getDocument } from "./pdfJs";

type ScheduledLoad = {
  cancelled: boolean;
  run: () => Promise<void>;
};

const loadQueue: ScheduledLoad[] = [];
let activeLoads = 0;
const MAX_CONCURRENT_DOCUMENT_LOADS = 2;

function pumpLoadQueue() {
  while (
    activeLoads < MAX_CONCURRENT_DOCUMENT_LOADS &&
    loadQueue.length > 0
  ) {
    const scheduled = loadQueue.shift();
    if (!scheduled || scheduled.cancelled) continue;
    activeLoads += 1;
    void scheduled.run().finally(() => {
      activeLoads -= 1;
      pumpLoadQueue();
    });
  }
}

function scheduleLoad(run: () => Promise<void>) {
  const scheduled: ScheduledLoad = { cancelled: false, run };
  loadQueue.push(scheduled);
  pumpLoadQueue();
  return () => {
    scheduled.cancelled = true;
    const index = loadQueue.indexOf(scheduled);
    if (index >= 0) loadQueue.splice(index, 1);
  };
}

type LoadedState = {
  file: File;
  document: PDFDocumentProxy | null;
  error: string | null;
};

export function usePdfDocument(file: File | null) {
  const [loaded, setLoaded] = useState<LoadedState | null>(null);

  useEffect(() => {
    if (!file) return;

    let disposed = false;
    let task: PDFDocumentLoadingTask | null = null;

    const cancelScheduled = scheduleLoad(async () => {
      try {
        const buffer = await file.arrayBuffer();
        if (disposed) return;
        task = getDocument({
          data: new Uint8Array(buffer),
          stopAtErrors: true,
        });
        const document = await task.promise;
        if (!document || disposed) return;
        setLoaded({ file, document, error: null });
      } catch {
        if (!disposed) {
          setLoaded({
            file,
            document: null,
            error: `Không thể hiển thị “${file.name}”.`,
          });
        }
      }
    });

    return () => {
      disposed = true;
      cancelScheduled();
      if (task) void task.destroy();
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
