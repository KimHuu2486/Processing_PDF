import { describe, expect, it } from "vitest";

import { PdfToolError } from "./errors";
import { defaultOutputName, sanitizePdfFilename } from "./naming";
import type {
  ExifOrientation,
  PageNumberPosition,
  SourceFile,
} from "./types";
import {
  fileToPdfInput,
  getLargeInputWarning,
  LARGE_FILE_BYTES,
  LARGE_PAGE_COUNT,
  validatePdfJob,
  validatePageRange,
} from "./validation";

describe("validatePageRange", () => {
  it("keeps a valid one-based inclusive range", () => {
    expect(validatePageRange({ start: 2, end: 5 }, 8)).toEqual({
      start: 2,
      end: 5,
    });
  });

  it.each([
    [{ start: 0, end: 2 }, 4],
    [{ start: 3, end: 2 }, 4],
    [{ start: 1, end: 5 }, 4],
    [{ start: 1.5, end: 2 }, 4],
  ])("rejects invalid range %o", (range, pageCount) => {
    expect(() => validatePageRange(range, pageCount)).toThrowError(PdfToolError);
  });
});

describe("output naming", () => {
  it("creates the split output name from the original file and range", () => {
    expect(
      defaultOutputName("split", [{ name: "Bao cao.thang 7.pdf" }], {
        start: 3,
        end: 8,
      }),
    ).toBe("Bao cao.thang 7_pages_3-8.pdf");
  });

  it("removes unsafe path characters and always appends one PDF extension", () => {
    expect(sanitizePdfFilename('  bao:cao/nam?.PDF  ')).toBe(
      "bao-cao-nam-.pdf",
    );
  });

  it("does not allow reserved Windows filenames", () => {
    expect(sanitizePdfFilename("CON.pdf", "ket-qua.pdf")).toBe("ket-qua.pdf");
  });
});

describe("getLargeInputWarning", () => {
  const source = (size: number, pageCount: number): SourceFile => ({
    id: "source",
    file: new File(["x"], "source.pdf", { type: "application/pdf" }),
    kind: "pdf",
    name: "source.pdf",
    size,
    mimeType: "application/pdf",
    pageCount,
  });

  it("returns null for ordinary files", () => {
    expect(getLargeInputWarning([source(1024, 10)])).toBeNull();
  });

  it("reports both best-effort thresholds without blocking the input", () => {
    const warning = getLargeInputWarning([
      source(LARGE_FILE_BYTES + 1, LARGE_PAGE_COUNT + 1),
    ]);
    expect(warning).toMatchObject({
      exceedsBytes: true,
      exceedsPages: true,
      totalPages: LARGE_PAGE_COUNT + 1,
    });
  });
});

describe("worker-boundary validation", () => {
  const source = {
    id: "source",
    name: "source.pdf",
    blob: new Blob(["%PDF-1.7"], { type: "application/pdf" }),
  };

  it("keeps the original File as a Blob instead of materializing an ArrayBuffer", async () => {
    const file = new File(["%PDF-1.7"], "source.pdf", {
      type: "application/pdf",
    });
    const input = await fileToPdfInput(file, "source");
    expect(input.blob).toBe(file);
  });

  it("rejects non-finite number settings and invalid position members", () => {
    expect(() =>
      validatePdfJob({
        id: "numbers",
        type: "number-pages",
        source,
        range: { start: 1, end: 1 },
        startNumber: 1,
        position: "middle" as PageNumberPosition,
        fontSize: Number.NaN,
        margin: 24,
      }),
    ).toThrowError(PdfToolError);
  });

  it("rejects an invalid optional EXIF orientation", () => {
    expect(() =>
      validatePdfJob({
        id: "images",
        type: "images-to-pdf",
        images: [
          {
            id: "image",
            name: "image.jpg",
            blob: new Blob(["jpeg"], { type: "image/jpeg" }),
            mimeType: "image/jpeg",
            rotation: 0,
            exifOrientation: 9 as ExifOrientation,
          },
        ],
      }),
    ).toThrowError(PdfToolError);
  });
});
