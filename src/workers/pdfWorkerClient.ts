import {
  PdfToolError,
  type PdfJob,
  type WorkerEvent,
  type WorkerProgressEvent,
  type WorkerRequest,
} from "../pdf";

interface WorkerLike {
  onmessage: ((event: MessageEvent<WorkerEvent>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: WorkerRequest): void;
  terminate(): void;
}

export type PdfWorkerFactory = () => WorkerLike;

export interface RunPdfJobOptions {
  onProgress?: (event: WorkerProgressEvent) => void;
  signal?: AbortSignal;
}

interface PendingJob {
  id: string;
  resolve: (bytes: ArrayBuffer) => void;
  reject: (error: PdfToolError) => void;
  onProgress?: (event: WorkerProgressEvent) => void;
  signal?: AbortSignal;
  abortListener?: () => void;
}

function defaultWorkerFactory(): WorkerLike {
  return new Worker(new URL("./pdf.worker.ts", import.meta.url), {
    type: "module",
    name: "pdf-tools-worker",
  });
}

export class PdfWorkerClient {
  private worker: WorkerLike | null = null;
  private pending: PendingJob | null = null;

  constructor(private readonly workerFactory: PdfWorkerFactory = defaultWorkerFactory) {}

  get busy(): boolean {
    return this.pending !== null;
  }

  warm(): void {
    this.ensureWorker();
  }

  run(job: PdfJob, options: RunPdfJobOptions = {}): Promise<ArrayBuffer> {
    if (this.pending) {
      return Promise.reject(new PdfToolError("busy"));
    }
    if (options.signal?.aborted) {
      return Promise.reject(new PdfToolError("cancelled"));
    }

    const worker = this.ensureWorker();
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const pending: PendingJob = {
        id: job.id,
        resolve,
        reject,
        ...(options.onProgress ? { onProgress: options.onProgress } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      };
      if (options.signal) {
        pending.abortListener = () => this.cancel();
        options.signal.addEventListener("abort", pending.abortListener, { once: true });
      }
      this.pending = pending;
      try {
        worker.postMessage({ type: "run", job });
      } catch (error) {
        this.detachPending();
        this.terminateWorker();
        reject(
          new PdfToolError(
            "processing-failed",
            "Không thể gửi dữ liệu tới worker xử lý PDF.",
            error instanceof Error ? error.message : String(error),
          ),
        );
      }
    });
  }

  cancel(): void {
    if (!this.pending) {
      return;
    }
    const pending = this.detachPending();
    this.terminateWorker();
    pending?.reject(new PdfToolError("cancelled"));
  }

  dispose(): void {
    if (this.pending) {
      const pending = this.detachPending();
      pending?.reject(new PdfToolError("cancelled"));
    }
    this.terminateWorker();
  }

  private ensureWorker(): WorkerLike {
    if (!this.worker) {
      this.worker = this.workerFactory();
      this.worker.onmessage = (event) => this.handleMessage(event.data);
      this.worker.onerror = (event) => {
        const pending = this.detachPending();
        this.terminateWorker();
        pending?.reject(
          new PdfToolError(
            "processing-failed",
            "Worker xử lý PDF gặp lỗi.",
            event.message,
          ),
        );
      };
    }
    return this.worker;
  }

  private handleMessage(event: WorkerEvent): void {
    const pending = this.pending;
    if (!pending || pending.id !== event.jobId) {
      return;
    }

    switch (event.type) {
      case "progress":
        pending.onProgress?.(event);
        break;
      case "result": {
        const completed = this.detachPending();
        completed?.resolve(event.bytes);
        break;
      }
      case "error": {
        const failed = this.detachPending();
        failed?.reject(
          new PdfToolError(event.error.code, event.error.message, event.error.details),
        );
        break;
      }
      case "cancelled": {
        const cancelled = this.detachPending();
        cancelled?.reject(new PdfToolError("cancelled"));
        break;
      }
    }
  }

  private detachPending(): PendingJob | null {
    const pending = this.pending;
    if (pending?.signal && pending.abortListener) {
      pending.signal.removeEventListener("abort", pending.abortListener);
    }
    this.pending = null;
    return pending;
  }

  private terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

let sharedClient: PdfWorkerClient | null = null;

function getSharedClient(): PdfWorkerClient {
  sharedClient ??= new PdfWorkerClient();
  return sharedClient;
}

export function runPdfJob(
  job: PdfJob,
  options?: RunPdfJobOptions,
): Promise<ArrayBuffer> {
  return getSharedClient().run(job, options);
}

export function warmPdfWorker(): void {
  getSharedClient().warm();
}

export function cancelPdfJob(): void {
  sharedClient?.cancel();
}

export function disposePdfWorker(): void {
  sharedClient?.dispose();
  sharedClient = null;
}
