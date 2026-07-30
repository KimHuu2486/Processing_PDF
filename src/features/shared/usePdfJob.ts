import { useCallback, useEffect, useRef, useState } from "react";

import { PdfToolError, type PdfJob } from "../../pdf";
import {
  cancelPdfJob,
  runPdfJob,
  warmPdfWorker,
} from "../../workers/pdfWorkerClient";

type JobState = {
  status: "idle" | "processing" | "done" | "error";
  progress: number;
  message: string;
  error: string | null;
  resultUrl: string | null;
  resultSize: number | null;
};

const initialState: JobState = {
  status: "idle",
  progress: 0,
  message: "",
  error: null,
  resultUrl: null,
  resultSize: null,
};

function readableError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Không thể xử lý tài liệu. Vui lòng kiểm tra file và thử lại.";
}

export function usePdfJob() {
  const [state, setState] = useState<JobState>(initialState);
  const currentUrl = useRef<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const activeRun = useRef(false);

  const revokeResult = useCallback(() => {
    if (currentUrl.current) {
      URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    generation.current += 1;
    activeRun.current = false;
    cancelPdfJob();
    revokeResult();
    if (mounted.current) setState(initialState);
  }, [revokeResult]);

  const run = useCallback(
    async (
      jobOrFactory: PdfJob | (() => PdfJob | Promise<PdfJob>),
    ): Promise<void> => {
      if (activeRun.current) return;
      activeRun.current = true;
      const runGeneration = generation.current + 1;
      generation.current = runGeneration;
      revokeResult();
      setState({
        ...initialState,
        status: "processing",
        message: "Đang chuẩn bị tài liệu…",
      });
      try {
        const job =
          typeof jobOrFactory === "function"
            ? await jobOrFactory()
            : jobOrFactory;
        if (
          !mounted.current ||
          generation.current !== runGeneration
        ) {
          return;
        }
        const output = await runPdfJob(job, {
          onProgress: (event) => {
            if (
              !mounted.current ||
              generation.current !== runGeneration
            ) {
              return;
            }
            setState((current) => ({
              ...current,
              progress: event.progress,
              message: event.message,
            }));
          },
        });
        if (
          !mounted.current ||
          generation.current !== runGeneration
        ) {
          return;
        }
        const blob = new Blob([output], { type: "application/pdf" });
        const resultUrl = URL.createObjectURL(blob);
        currentUrl.current = resultUrl;
        setState({
          status: "done",
          progress: 100,
          message: "Đã xử lý xong",
          error: null,
          resultUrl,
          resultSize: blob.size,
        });
      } catch (error) {
        if (
          !mounted.current ||
          generation.current !== runGeneration
        ) {
          return;
        }
        if (error instanceof PdfToolError && error.code === "cancelled") {
          setState(initialState);
          return;
        }
        setState({
          ...initialState,
          status: "error",
          error: readableError(error),
        });
      } finally {
        if (generation.current === runGeneration) {
          activeRun.current = false;
        }
      }
    },
    [revokeResult],
  );

  const cancel = useCallback(() => {
    generation.current += 1;
    activeRun.current = false;
    cancelPdfJob();
    if (mounted.current) setState(initialState);
  }, []);

  useEffect(() => {
    mounted.current = true;
    warmPdfWorker();
    return () => {
      mounted.current = false;
      generation.current += 1;
      activeRun.current = false;
      cancelPdfJob();
      revokeResult();
    };
  }, [revokeResult]);

  return {
    ...state,
    run,
    reset,
    cancel,
    dismissError: () =>
      setState((current) => ({ ...current, error: null })),
  };
}
