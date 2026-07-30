/// <reference lib="webworker" />

import { executePdfJob, toPdfErrorInfo } from "../pdf";
import type { WorkerEvent, WorkerRequest } from "../pdf";

const workerScope = self as DedicatedWorkerGlobalScope;
let running = false;

function post(event: WorkerEvent, transfer?: Transferable[]): void {
  workerScope.postMessage(event, transfer ?? []);
}

workerScope.onmessage = async (message: MessageEvent<WorkerRequest>) => {
  const request = message.data;
  if (request.type !== "run") {
    return;
  }

  if (running) {
    post({
      type: "error",
      jobId: request.job.id,
      error: {
        code: "busy",
        message: "Một tác vụ PDF khác đang được xử lý.",
      },
    });
    return;
  }

  running = true;
  try {
    const bytes = await executePdfJob(request.job, (event) => post(event));
    post(
      {
        type: "result",
        jobId: request.job.id,
        bytes,
        mimeType: "application/pdf",
      },
      [bytes],
    );
  } catch (error) {
    post({
      type: "error",
      jobId: request.job.id,
      error: toPdfErrorInfo(error),
    });
  } finally {
    running = false;
  }
};

export {};
