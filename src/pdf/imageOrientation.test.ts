import { describe, expect, it } from "vitest";

import {
  calculateContainedImageLayout,
  getImageTransform,
  readJpegExifOrientation,
  stripJpegMetadata,
} from "./imageOrientation";

function concatenate(...parts: Uint8Array[]): Uint8Array {
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

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function jpegSegment(marker: number, payload: Uint8Array): Uint8Array {
  const length = payload.byteLength + 2;
  return concatenate(
    new Uint8Array([
      0xff,
      marker,
      (length >>> 8) & 0xff,
      length & 0xff,
    ]),
    payload,
  );
}

function includesBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  return haystack.some((_, start) =>
    needle.every((byte, index) => haystack[start + index] === byte),
  );
}

function jpegWithOrientation(orientation: number): ArrayBuffer {
  const bytes = new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe1,
    0x00,
    0x22,
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00,
    0x49,
    0x49,
    0x2a,
    0x00,
    0x08,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x12,
    0x01,
    0x03,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    orientation,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0xff,
    0xd9,
  ]);
  return bytes.buffer;
}

describe("JPEG EXIF orientation", () => {
  it("reads the orientation tag from a little-endian EXIF segment", () => {
    expect(readJpegExifOrientation(jpegWithOrientation(6))).toBe(6);
  });

  it("combines EXIF and user rotations clockwise", () => {
    const bytes = jpegWithOrientation(6);
    expect(
      getImageTransform({
        id: "image",
        name: "photo.jpg",
        blob: new Blob([bytes], { type: "image/jpeg" }),
        mimeType: "image/jpeg",
        rotation: 90,
      }, bytes),
    ).toEqual({ rotationClockwise: 180, mirrored: false });
  });

  it("falls back safely for a truncated EXIF TIFF header", () => {
    const malformed = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x0a, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
      0x49, 0x49,
    ]);
    expect(readJpegExifOrientation(malformed.buffer)).toBe(1);
  });
});

describe("stripJpegMetadata", () => {
  it("removes EXIF, XMP, comments, and bytes after EOI while preserving scan data", () => {
    const text = (value: string) => new TextEncoder().encode(value);
    const jpeg = concatenate(
      new Uint8Array([0xff, 0xd8]),
      jpegSegment(0xe0, text("JFIF\0")),
      jpegSegment(0xe2, text("ICC_PROFILE\0")),
      jpegSegment(0xe1, text("Exif\0\0private-gps")),
      jpegSegment(0xe1, text("http://ns.adobe.com/xap/1.0/\0private-xmp")),
      jpegSegment(0xed, text("Photoshop-IPTC-private")),
      jpegSegment(0xef, text("private-app15")),
      jpegSegment(0xfe, text("private-comment")),
      jpegSegment(0xda, new Uint8Array()),
      new Uint8Array([0x11, 0xff, 0x00, 0x22, 0xff, 0xd0, 0x33]),
      jpegSegment(0xfe, text("between-scans-comment")),
      new Uint8Array([0xff, 0xd9]),
      text("trailing-private-data"),
    );

    const stripped = new Uint8Array(stripJpegMetadata(arrayBuffer(jpeg)));

    expect(includesBytes(stripped, text("JFIF\0"))).toBe(true);
    expect(includesBytes(stripped, text("ICC_PROFILE\0"))).toBe(true);
    expect(
      includesBytes(
        stripped,
        new Uint8Array([0x11, 0xff, 0x00, 0x22, 0xff, 0xd0, 0x33]),
      ),
    ).toBe(true);
    expect(includesBytes(stripped, text("Exif\0\0"))).toBe(false);
    expect(includesBytes(stripped, text("private-xmp"))).toBe(false);
    expect(includesBytes(stripped, text("Photoshop-IPTC-private"))).toBe(false);
    expect(includesBytes(stripped, text("private-app15"))).toBe(false);
    expect(includesBytes(stripped, text("private-comment"))).toBe(false);
    expect(includesBytes(stripped, text("between-scans-comment"))).toBe(false);
    expect(includesBytes(stripped, text("trailing-private-data"))).toBe(false);
    expect(Array.from(stripped.slice(-2))).toEqual([0xff, 0xd9]);
  });

  it("leaves EXIF orientation readable only in the original bytes", () => {
    const original = jpegWithOrientation(6);
    const stripped = stripJpegMetadata(original);

    expect(readJpegExifOrientation(original)).toBe(6);
    expect(readJpegExifOrientation(stripped)).toBe(1);
  });

  it("rejects a truncated metadata segment instead of returning unfiltered bytes", () => {
    const truncated = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x20, 0x45, 0x78, 0x69, 0x66,
    ]);

    expect(() => stripJpegMetadata(truncated.buffer)).toThrow(
      "Cấu trúc JPEG không hợp lệ.",
    );
  });
});

describe("calculateContainedImageLayout", () => {
  it("contains a rotated landscape source inside the available page area", () => {
    const layout = calculateContainedImageLayout(
      1200,
      800,
      595,
      842,
      24,
      { rotationClockwise: 90, mirrored: false },
    );

    expect(layout.x).toBeGreaterThanOrEqual(24);
    expect(layout.y).toBeCloseTo(24);
    expect(layout.height).toBeCloseTo(529.333);
    expect(layout.width).toBeCloseTo(794);
  });
});
