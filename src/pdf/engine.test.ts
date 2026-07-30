import { deflateSync } from "node:zlib";

import {
  degrees,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
} from "pdf-lib";
import { describe, expect, it } from "vitest";

import { executePdfJob } from "./engine";
import type { PageRotation, PdfInput } from "./types";

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function concatenateBytes(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((total, part) => total + part.byteLength, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function jpegSegment(marker: number, payload: Uint8Array): Uint8Array {
  const length = payload.byteLength + 2;
  return concatenateBytes(
    new Uint8Array([
      0xff,
      marker,
      (length >>> 8) & 0xff,
      length & 0xff,
    ]),
    payload,
  );
}

function jpegExifOrientationPayload(orientation: number): Uint8Array {
  return new Uint8Array([
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00,
    orientation, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
}

function includesBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  return haystack.some((_, start) =>
    needle.every((byte, index) => haystack[start + index] === byte),
  );
}

function makeJpegWithPrivateMetadata(): ArrayBuffer {
  const base64 = [
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQE",
    "BQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/",
    "2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU",
    "FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAIDASIAAhEBAxEB/8QA",
    "HwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUF",
    "BAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkK",
    "FhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1",
    "dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG",
    "x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEB",
    "AQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAEC",
    "AxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRom",
    "JygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOE",
    "hYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU",
    "1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD4H8Q/8h/U",
    "v+vmX/0M0UUV/ptkP/Ipwn/XuH/pKPAzr/kZ4r/r5P8A9KZ//9k=",
  ].join("");
  const jpeg = Uint8Array.from(atob(base64), (character) =>
    character.charCodeAt(0),
  );
  const xmp = new TextEncoder().encode(
    "http://ns.adobe.com/xap/1.0/\0private-xmp",
  );
  const comment = new TextEncoder().encode("private-comment");
  return arrayBuffer(
    concatenateBytes(
      jpeg.subarray(0, 2),
      jpegSegment(0xe1, jpegExifOrientationPayload(6)),
      jpegSegment(0xe1, xmp),
      jpegSegment(0xfe, comment),
      jpeg.subarray(2),
    ),
  );
}

async function makePdf(
  sizes: Array<[number, number]>,
  rotations: PageRotation[] = [],
): Promise<PdfInput> {
  const document = await PDFDocument.create();
  sizes.forEach((size, index) => {
    const page = document.addPage(size);
    page.setRotation(degrees(rotations[index] ?? 0));
  });
  return {
    id: `pdf-${sizes.length}-${sizes[0]?.join("x")}`,
    name: "source.pdf",
    blob: new Blob([arrayBuffer(await document.save())], {
      type: "application/pdf",
    }),
  };
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const result = new Uint8Array(12 + data.length);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.length);
  result.set(typeBytes, 4);
  result.set(data, 8);
  const checksumInput = new Uint8Array(typeBytes.length + data.length);
  checksumInput.set(typeBytes);
  checksumInput.set(data, typeBytes.length);
  view.setUint32(8 + data.length, crc32(checksumInput));
  return result;
}

function makePng(width: number, height: number): ArrayBuffer {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr.set([8, 6, 0, 0, 0], 8);

  const rows = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (1 + width * 4);
    rows[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      rows.set([220, 45, 55, x % 2 === 0 ? 255 : 120], rowOffset + 1 + x * 4);
    }
  }
  const idat = new Uint8Array(deflateSync(rows));
  const chunks = [
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", new Uint8Array()),
  ];
  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output.buffer;
}

function expectBoxClose(
  actual: { x: number; y: number; width: number; height: number },
  expected: { x: number; y: number; width: number; height: number },
): void {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
  expect(actual.width).toBeCloseTo(expected.width);
  expect(actual.height).toBeCloseTo(expected.height);
}

describe("executePdfJob", () => {
  it("merges every page in source order", async () => {
    const first = await makePdf([
      [100, 200],
      [110, 210],
    ]);
    const second = await makePdf([[300, 400]]);

    const bytes = await executePdfJob({
      id: "merge",
      type: "merge",
      sources: [first, second],
    });
    const output = await PDFDocument.load(bytes);

    expect(output.getPageCount()).toBe(3);
    expect(output.getPages().map((page) => page.getSize())).toEqual([
      { width: 100, height: 200 },
      { width: 110, height: 210 },
      { width: 300, height: 400 },
    ]);
  });

  it("extracts an inclusive one-based page range", async () => {
    const source = await makePdf([
      [100, 200],
      [110, 210],
      [120, 220],
      [130, 230],
    ]);

    const bytes = await executePdfJob({
      id: "split",
      type: "split",
      source,
      range: { start: 2, end: 3 },
    });
    const output = await PDFDocument.load(bytes);

    expect(output.getPages().map((page) => page.getSize())).toEqual([
      { width: 110, height: 210 },
      { width: 120, height: 220 },
    ]);
  });

  it("reorders, rotates, and deletes pages according to PageRef", async () => {
    const source = await makePdf([
      [100, 200],
      [110, 210],
      [120, 220],
    ]);

    const bytes = await executePdfJob({
      id: "organize",
      type: "organize",
      source,
      pages: [
        {
          id: "page-3",
          sourceId: source.id,
          pageIndex: 2,
          rotation: 90,
        },
        {
          id: "page-1",
          sourceId: source.id,
          pageIndex: 0,
          rotation: 180,
        },
      ],
    });
    const output = await PDFDocument.load(bytes);

    expect(output.getPageCount()).toBe(2);
    expect(output.getPages().map((page) => page.getSize())).toEqual([
      { width: 120, height: 220 },
      { width: 100, height: 200 },
    ]);
    expect(output.getPages().map((page) => page.getRotation().angle)).toEqual([
      90, 180,
    ]);
  });

  it("preserves shared image resources when organizing many pages", async () => {
    const sourceDocument = await PDFDocument.create();
    const sharedImage = await sourceDocument.embedPng(makePng(64, 64));
    for (let index = 0; index < 20; index += 1) {
      const page = sourceDocument.addPage([200, 300]);
      page.drawImage(sharedImage, {
        x: 20,
        y: 70,
        width: 160,
        height: 160,
      });
    }
    const source: PdfInput = {
      id: "shared-image-source",
      name: "shared-image.pdf",
      blob: new Blob([arrayBuffer(await sourceDocument.save())], {
        type: "application/pdf",
      }),
    };

    const bytes = await executePdfJob({
      id: "organize-shared-image",
      type: "organize",
      source,
      pages: Array.from({ length: 20 }, (_, index) => ({
        id: `page-${index}`,
        sourceId: source.id,
        pageIndex: 19 - index,
        rotation: 0 as const,
      })),
    });
    const output = await PDFDocument.load(bytes);
    const imageStreams = output.context
      .enumerateIndirectObjects()
      .filter(
        ([, object]) =>
          object instanceof PDFRawStream &&
          object.dict.get(PDFName.of("Subtype"))?.toString() === "/Image",
      );

    expect(output.getPageCount()).toBe(20);
    // One RGB image plus one alpha soft mask, shared by all 20 pages.
    expect(imageStreams).toHaveLength(2);
  });

  it("adds number content only inside the selected range", async () => {
    const source = await makePdf([
      [200, 300],
      [200, 300],
      [200, 300],
    ]);

    const bytes = await executePdfJob({
      id: "numbers",
      type: "number-pages",
      source,
      range: { start: 2, end: 3 },
      startNumber: 7,
      position: "bottom-center",
      fontSize: 12,
      margin: 24,
    });
    const output = await PDFDocument.load(bytes);

    expect(output.getPage(0).node.Contents()).toBeUndefined();
    expect(output.getPage(1).node.Contents()).toBeDefined();
    expect(output.getPage(2).node.Contents()).toBeDefined();
  });

  it("maps a visual crop onto CropBox for rotations 0, 90, 180, and 270", async () => {
    const source = await makePdf(
      [
        [200, 300],
        [200, 300],
        [200, 300],
        [200, 300],
      ],
      [0, 90, 180, 270],
    );

    const bytes = await executePdfJob({
      id: "crop",
      type: "crop",
      source,
      pageIndices: [0, 1, 2, 3],
      crop: { left: 0.1, top: 0.2, right: 0.3, bottom: 0.1 },
    });
    const output = await PDFDocument.load(bytes);

    expectBoxClose(output.getPage(0).getCropBox(), {
      x: 20,
      y: 30,
      width: 120,
      height: 210,
    });
    expectBoxClose(output.getPage(1).getCropBox(), {
      x: 40,
      y: 30,
      width: 140,
      height: 180,
    });
    expectBoxClose(output.getPage(2).getCropBox(), {
      x: 60,
      y: 60,
      width: 120,
      height: 210,
    });
    expectBoxClose(output.getPage(3).getCropBox(), {
      x: 20,
      y: 90,
      width: 140,
      height: 180,
    });
  });

  it("creates one white A4 page per PNG and chooses landscape orientation", async () => {
    const bytes = await executePdfJob({
      id: "images",
      type: "images-to-pdf",
      images: [
        {
          id: "landscape",
          name: "landscape.png",
          mimeType: "image/png",
          blob: new Blob([makePng(4, 2)], { type: "image/png" }),
          rotation: 0,
        },
        {
          id: "portrait",
          name: "portrait.png",
          mimeType: "image/png",
          blob: new Blob([makePng(2, 4)], { type: "image/png" }),
          rotation: 0,
        },
      ],
    });
    const output = await PDFDocument.load(bytes);

    expect(output.getPageCount()).toBe(2);
    expect(output.getPage(0).getSize()).toEqual({
      width: 841.89,
      height: 595.28,
    });
    expect(output.getPage(1).getSize()).toEqual({
      width: 595.28,
      height: 841.89,
    });
  });

  it("uses original EXIF orientation but omits JPEG metadata from the PDF", async () => {
    const bytes = await executePdfJob({
      id: "jpeg-metadata",
      type: "images-to-pdf",
      images: [
        {
          id: "photo",
          name: "photo.jpg",
          mimeType: "image/jpeg",
          blob: new Blob([makeJpegWithPrivateMetadata()], {
            type: "image/jpeg",
          }),
          rotation: 0,
        },
      ],
    });
    const output = await PDFDocument.load(bytes);
    const outputBytes = new Uint8Array(bytes);
    const text = (value: string) => new TextEncoder().encode(value);

    expect(output.getPage(0).getSize()).toEqual({
      width: 595.28,
      height: 841.89,
    });
    expect(includesBytes(outputBytes, text("JFIF"))).toBe(true);
    expect(includesBytes(outputBytes, text("Exif\0\0"))).toBe(false);
    expect(includesBytes(outputBytes, text("private-xmp"))).toBe(false);
    expect(includesBytes(outputBytes, text("private-comment"))).toBe(false);
  });

  it("reports progress from zero through completion", async () => {
    const first = await makePdf([[100, 100]]);
    const second = await makePdf([[100, 100]]);
    const progress: number[] = [];

    await executePdfJob(
      { id: "progress", type: "merge", sources: [first, second] },
      (event) => progress.push(event.progress),
    );

    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(100);
  });

  it("rejects a corrupt PDF with a normalized Vietnamese error", async () => {
    const source: PdfInput = {
      id: "corrupt",
      name: "corrupt.pdf",
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], {
        type: "application/pdf",
      }),
    };

    await expect(
      executePdfJob({
        id: "corrupt-job",
        type: "split",
        source,
        range: { start: 1, end: 1 },
      }),
    ).rejects.toMatchObject({
      code: "corrupt-pdf",
      message: expect.stringContaining("bị hỏng"),
    });
  });

  it("rejects a valid PDF that contains no pages", async () => {
    const document = await PDFDocument.create();
    const bytes = await document.save({ addDefaultPage: false });
    const source: PdfInput = {
      id: "empty",
      name: "empty.pdf",
      blob: new Blob([arrayBuffer(bytes)], { type: "application/pdf" }),
    };

    await expect(
      executePdfJob({
        id: "empty-job",
        type: "split",
        source,
        range: { start: 1, end: 1 },
      }),
    ).rejects.toMatchObject({ code: "empty-pdf" });
  });

  it("rejects an encrypted PDF instead of bypassing its protection", async () => {
    const document = await PDFDocument.create();
    document.addPage();
    const encryption = document.context.obj({
      Filter: PDFName.of("Standard"),
      V: PDFNumber.of(1),
      R: PDFNumber.of(2),
      O: PDFHexString.of("00112233445566778899AABBCCDDEEFF"),
      U: PDFHexString.of("00112233445566778899AABBCCDDEEFF"),
      P: PDFNumber.of(-4),
    });
    document.context.trailerInfo.Encrypt =
      document.context.register(encryption);
    const source: PdfInput = {
      id: "encrypted",
      name: "encrypted.pdf",
      blob: new Blob([arrayBuffer(await document.save())], {
        type: "application/pdf",
      }),
    };

    await expect(
      executePdfJob({
        id: "encrypted-job",
        type: "split",
        source,
        range: { start: 1, end: 1 },
      }),
    ).rejects.toMatchObject({ code: "encrypted-pdf" });
  });
});
