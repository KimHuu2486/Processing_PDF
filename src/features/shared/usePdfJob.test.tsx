import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PdfToolError, type PdfJob } from "../../pdf";
import { usePdfJob } from "./usePdfJob";

const worker = vi.hoisted(() => ({
  runPdfJob: vi.fn(),
  cancelPdfJob: vi.fn(),
  warmPdfWorker: vi.fn(),
}));

vi.mock("../../workers/pdfWorkerClient", () => ({
  runPdfJob: worker.runPdfJob,
  cancelPdfJob: worker.cancelPdfJob,
  warmPdfWorker: worker.warmPdfWorker,
}));

const job: PdfJob = {
  id: "test-job",
  type: "split",
  source: {
    id: "source",
    name: "source.pdf",
    blob: new Blob(["pdf"], { type: "application/pdf" }),
  },
  range: { start: 1, end: 1 },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("usePdfJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enters the busy state before an asynchronous job factory completes", async () => {
    const preparation = deferred<PdfJob>();
    const processing = deferred<ArrayBuffer>();
    worker.runPdfJob.mockReturnValue(processing.promise);
    const { result } = renderHook(() => usePdfJob());

    act(() => {
      void result.current.run(() => preparation.promise);
    });

    expect(result.current.status).toBe("processing");
    expect(result.current.message).toBe("Đang chuẩn bị tài liệu…");

    await act(async () => {
      preparation.resolve(job);
      await Promise.resolve();
    });
    expect(worker.runPdfJob).toHaveBeenCalledWith(
      job,
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );

    await act(async () => {
      processing.resolve(new ArrayBuffer(2));
      await processing.promise;
    });
    await waitFor(() => expect(result.current.status).toBe("done"));
  });

  it("does not turn a user cancellation into an error", async () => {
    const processing = deferred<ArrayBuffer>();
    worker.runPdfJob.mockReturnValue(processing.promise);
    const { result } = renderHook(() => usePdfJob());

    act(() => {
      void result.current.run(job);
    });
    await waitFor(() => expect(result.current.status).toBe("processing"));

    act(() => result.current.cancel());
    processing.reject(new PdfToolError("cancelled"));

    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(result.current.error).toBeNull();
    expect(worker.cancelPdfJob).toHaveBeenCalled();
  });

  it("cancels on unmount and ignores a late result", async () => {
    const processing = deferred<ArrayBuffer>();
    worker.runPdfJob.mockReturnValue(processing.promise);
    const createUrl = vi.spyOn(URL, "createObjectURL");
    const { result, unmount } = renderHook(() => usePdfJob());

    act(() => {
      void result.current.run(job);
    });
    await waitFor(() => expect(result.current.status).toBe("processing"));
    unmount();

    processing.resolve(new ArrayBuffer(2));
    await processing.promise;
    await Promise.resolve();

    expect(worker.cancelPdfJob).toHaveBeenCalled();
    expect(createUrl).not.toHaveBeenCalled();
    createUrl.mockRestore();
  });
});
