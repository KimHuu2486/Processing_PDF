import { describe, expect, it } from "vitest";

import type {
  PdfJob,
  WorkerEvent,
  WorkerRequest,
} from "../pdf";
import { PdfWorkerClient } from "./pdfWorkerClient";

class FakeWorker {
  onmessage: ((event: MessageEvent<WorkerEvent>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: WorkerRequest[] = [];
  terminated = false;

  postMessage(message: WorkerRequest): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(event: WorkerEvent): void {
    this.onmessage?.({ data: event } as MessageEvent<WorkerEvent>);
  }
}

function job(id = "job"): PdfJob {
  return {
    id,
    type: "split",
    source: {
      id: "source",
      name: "source.pdf",
      blob: new Blob([new Uint8Array([1])], { type: "application/pdf" }),
    },
    range: { start: 1, end: 1 },
  };
}

describe("PdfWorkerClient", () => {
  it("resolves worker output and forwards progress", async () => {
    const worker = new FakeWorker();
    const client = new PdfWorkerClient(() => worker);
    const progress: number[] = [];
    const promise = client.run(job(), {
      onProgress: (event) => progress.push(event.progress),
    });

    worker.emit({
      type: "progress",
      jobId: "job",
      progress: 50,
      message: "Đang xử lý",
    });
    const result = new Uint8Array([37, 80, 68, 70]).buffer;
    worker.emit({
      type: "result",
      jobId: "job",
      bytes: result,
      mimeType: "application/pdf",
    });

    await expect(promise).resolves.toBe(result);
    expect(progress).toEqual([50]);
    expect(client.busy).toBe(false);
  });

  it("rejects a second job while one is active", async () => {
    const worker = new FakeWorker();
    const client = new PdfWorkerClient(() => worker);
    const first = client.run(job("first"));

    await expect(client.run(job("second"))).rejects.toMatchObject({
      code: "busy",
    });
    worker.emit({
      type: "error",
      jobId: "first",
      error: { code: "processing-failed", message: "failed" },
    });
    await expect(first).rejects.toMatchObject({ code: "processing-failed" });
  });

  it("cancels by terminating the worker and creates a fresh worker next time", async () => {
    const workers = [new FakeWorker(), new FakeWorker()];
    const client = new PdfWorkerClient(() => {
      const worker = workers.find((candidate) => !candidate.messages.length);
      if (!worker) {
        throw new Error("No fake worker available");
      }
      return worker;
    });
    const first = client.run(job("first"));

    client.cancel();
    await expect(first).rejects.toMatchObject({ code: "cancelled" });
    expect(workers[0].terminated).toBe(true);

    const second = client.run(job("second"));
    workers[1].emit({
      type: "result",
      jobId: "second",
      bytes: new ArrayBuffer(2),
      mimeType: "application/pdf",
    });
    await expect(second).resolves.toHaveProperty("byteLength", 2);
  });

  it("uses AbortSignal to cancel an active job", async () => {
    const worker = new FakeWorker();
    const client = new PdfWorkerClient(() => worker);
    const controller = new AbortController();
    const promise = client.run(job(), { signal: controller.signal });

    controller.abort();

    await expect(promise).rejects.toMatchObject({ code: "cancelled" });
    expect(worker.terminated).toBe(true);
  });

  it("cleans up when structured cloning fails synchronously", async () => {
    const worker = new FakeWorker();
    worker.postMessage = () => {
      throw new DOMException("The object could not be cloned", "DataCloneError");
    };
    const client = new PdfWorkerClient(() => worker);

    await expect(client.run(job())).rejects.toMatchObject({
      code: "processing-failed",
    });
    expect(client.busy).toBe(false);
    expect(worker.terminated).toBe(true);
  });
});
