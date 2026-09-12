// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makePng } from "../../../e2e/fixtures";
import { fileToImageInput } from "../../pdf/validation";
import { releaseSelectedImage, selectImage } from "./imageItems";

describe("image admission", () => {
  let decodeFails = false;
  beforeEach(() => {
    decodeFails = false;
    // Browser decoding is covered by e2e; this double controls load/error timing.
    vi.stubGlobal("Image", class {
      naturalWidth = 0;
      naturalHeight = 0;
      onload?: () => void;
      onerror?: () => void;
      set src(url: string) {
        if (!url) return;
        queueMicrotask(() => {
          this.naturalWidth = 8;
          this.naturalHeight = 12;
          if (decodeFails) this.onerror?.();
          else this.onload?.();
        });
      }
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("rejects empty and fake image files at admission", async () => {
    await expect(selectImage(new File([], "empty.png"))).rejects.toThrow(/rỗng/);
    await expect(selectImage(new File(["not JPEG"], "fake.jpg", { type: "image/jpeg" }))).rejects.toThrow(/JPG|PNG|định dạng/);
  });

  it("rejects a truncated PNG with a valid signature and releases its URL", async () => {
    decodeFails = true;
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    await expect(selectImage(new File([new Uint8Array(makePng().subarray(0, 24))], "broken.png"))).rejects.toThrow(/đọc ảnh/);
    expect(revoke).toHaveBeenCalledOnce();
    revoke.mockRestore();
  });

  it("uses the real PNG format when filename and MIME both say JPEG", async () => {
    const original = new File([new Uint8Array(makePng())], "photo.jpg", { type: "image/jpeg" });
    const selected = await selectImage(original);
    expect(selected.file.type).toBe("image/png");
    expect(selected.file.name).toBe("photo.jpg");
    expect(await selected.file.arrayBuffer()).toEqual(await original.arrayBuffer());
    expect((await fileToImageInput(selected.file)).mimeType).toBe("image/png");
    releaseSelectedImage(selected);
  });

  it("does not allocate a preview for an already cancelled selection", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(selectImage(new File([new Uint8Array(makePng())], "a.png"), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
