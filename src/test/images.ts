import { vi } from "vitest";
import { makePng } from "../../e2e/fixtures";

export function imageFile(name = "scan.png") {
  return new File([new Uint8Array(makePng())], name, { type: "image/png" });
}

/** jsdom does not decode image resources; real decoding is covered in e2e. */
export function stubImageDecoder() {
  vi.stubGlobal("Image", class {
    naturalWidth = 8;
    naturalHeight = 12;
    onload?: () => void;
    set src(value: string) { if (value) queueMicrotask(() => this.onload?.()); }
  });
}
