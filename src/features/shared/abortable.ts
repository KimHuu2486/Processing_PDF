/** Settle independently of APIs whose promises can remain pending after abort. */
export function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(signal.reason ?? new DOMException("Đã hủy đọc tệp.", "AbortError"));
    };
    promise.then((value) => {
      signal.removeEventListener("abort", abort);
      resolve(value);
    }, (error: unknown) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}
