import "@testing-library/jest-dom/vitest";

// jsdom has FileReader but does not implement Blob.arrayBuffer yet.
if (!Blob.prototype.arrayBuffer) {
  Object.defineProperty(Blob.prototype, "arrayBuffer", {
    configurable: true,
    value: function (this: Blob): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    },
  });
}

if (!("DOMMatrix" in globalThis)) {
  Object.defineProperty(globalThis, "DOMMatrix", {
    configurable: true,
    value: class DOMMatrix {},
  });
}

if (!URL.createObjectURL) {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: () => `blob:test-${crypto.randomUUID()}`,
  });
}

if (!URL.revokeObjectURL) {
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: () => undefined,
  });
}
