import type { ExifOrientation, ImageInput, PageRotation } from "./types";
import { normalizeRotation } from "./geometry";

export interface ImageTransform {
  rotationClockwise: PageRotation;
  mirrored: boolean;
}

const EXIF_TRANSFORMS: Record<ExifOrientation, ImageTransform> = {
  1: { rotationClockwise: 0, mirrored: false },
  2: { rotationClockwise: 0, mirrored: true },
  3: { rotationClockwise: 180, mirrored: false },
  4: { rotationClockwise: 180, mirrored: true },
  5: { rotationClockwise: 270, mirrored: true },
  6: { rotationClockwise: 90, mirrored: false },
  7: { rotationClockwise: 90, mirrored: true },
  8: { rotationClockwise: 270, mirrored: false },
};

const JPEG_MARKER_PREFIX = 0xff;
const JPEG_START_OF_IMAGE = 0xd8;
const JPEG_END_OF_IMAGE = 0xd9;
const JPEG_START_OF_SCAN = 0xda;
const JPEG_DEFINE_NUMBER_OF_LINES = 0xdc;
const JPEG_COMMENT = 0xfe;

function invalidJpeg(): never {
  throw new Error("Cấu trúc JPEG không hợp lệ.");
}

function isStandaloneJpegMarker(marker: number): boolean {
  return (
    marker === 0x01 ||
    marker === JPEG_START_OF_IMAGE ||
    marker === JPEG_END_OF_IMAGE ||
    (marker >= 0xd0 && marker <= 0xd7)
  );
}

function isRemovableApplicationMarker(marker: number): boolean {
  return (
    marker >= 0xe1 &&
    marker <= 0xef &&
    marker !== 0xe2 &&
    marker !== 0xee
  );
}

function concatenateJpegParts(
  parts: readonly Uint8Array[],
  totalLength: number,
): ArrayBuffer {
  const output = new Uint8Array(totalLength);
  let outputOffset = 0;
  for (const part of parts) {
    output.set(part, outputOffset);
    outputOffset += part.byteLength;
  }
  return output.buffer;
}

/**
 * Removes metadata-bearing JPEG application segments, COM segments, and bytes
 * appended after EOI. Structural/color segments such as JFIF (APP0), ICC
 * (APP2), and Adobe APP14 are retained so the encoded image remains suitable
 * for direct PDF embedding.
 */
export function stripJpegMetadata(buffer: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer);
  if (
    bytes.byteLength < 4 ||
    bytes[0] !== JPEG_MARKER_PREFIX ||
    bytes[1] !== JPEG_START_OF_IMAGE
  ) {
    invalidJpeg();
  }

  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let keptLength = 2;
  let offset = 2;
  let insideScan = false;
  let markerCameFromScan = false;
  let changed = false;

  const keep = (start: number, end: number) => {
    const part = bytes.subarray(start, end);
    parts.push(part);
    keptLength += part.byteLength;
  };

  while (offset < bytes.byteLength) {
    if (insideScan) {
      const scanStart = offset;
      let cursor = offset;
      let markerStart = -1;

      while (cursor < bytes.byteLength) {
        if (bytes[cursor] !== JPEG_MARKER_PREFIX) {
          cursor += 1;
          continue;
        }

        const prefixStart = cursor;
        while (
          cursor < bytes.byteLength &&
          bytes[cursor] === JPEG_MARKER_PREFIX
        ) {
          cursor += 1;
        }
        if (cursor >= bytes.byteLength) {
          invalidJpeg();
        }

        const marker = bytes[cursor];
        if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
          cursor += 1;
          continue;
        }

        markerStart = prefixStart;
        break;
      }

      if (markerStart < 0) {
        invalidJpeg();
      }
      keep(scanStart, markerStart);
      offset = markerStart;
      insideScan = false;
      markerCameFromScan = true;
      continue;
    }

    const markerStart = offset;
    if (bytes[offset] !== JPEG_MARKER_PREFIX) {
      invalidJpeg();
    }

    while (
      offset < bytes.byteLength &&
      bytes[offset] === JPEG_MARKER_PREFIX
    ) {
      offset += 1;
    }
    if (offset >= bytes.byteLength || bytes[offset] === 0x00) {
      invalidJpeg();
    }

    const marker = bytes[offset];
    const markerEnd = offset + 1;
    offset = markerEnd;

    if (isStandaloneJpegMarker(marker)) {
      keep(markerStart, markerEnd);
      if (marker === JPEG_END_OF_IMAGE) {
        if (markerEnd < bytes.byteLength) {
          changed = true;
        }
        return changed
          ? concatenateJpegParts(parts, keptLength)
          : buffer;
      }
      markerCameFromScan = false;
      continue;
    }

    if (offset + 2 > bytes.byteLength) {
      invalidJpeg();
    }
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2) {
      invalidJpeg();
    }
    const segmentEnd = offset + segmentLength;
    if (segmentEnd > bytes.byteLength) {
      invalidJpeg();
    }

    if (isRemovableApplicationMarker(marker) || marker === JPEG_COMMENT) {
      changed = true;
    } else {
      keep(markerStart, segmentEnd);
    }
    offset = segmentEnd;

    if (marker === JPEG_START_OF_SCAN) {
      insideScan = true;
    } else if (
      marker === JPEG_DEFINE_NUMBER_OF_LINES &&
      markerCameFromScan
    ) {
      insideScan = true;
    }
    markerCameFromScan = false;
  }

  return invalidJpeg();
}

export function readJpegExifOrientation(bytes: ArrayBuffer): ExifOrientation {
  const view = new DataView(bytes);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) {
    return 1;
  }

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      break;
    }

    const marker = view.getUint8(offset + 1);
    offset += 2;
    if (marker === 0xda || marker === 0xd9) {
      break;
    }
    if (offset + 2 > view.byteLength) {
      break;
    }

    const segmentLength = view.getUint16(offset, false);
    if (segmentLength < 2 || offset + segmentLength > view.byteLength) {
      break;
    }

    if (
      marker === 0xe1 &&
      segmentLength >= 10 &&
      view.getUint32(offset + 2, false) === 0x45786966 &&
      view.getUint16(offset + 6, false) === 0
    ) {
      const tiffStart = offset + 8;
      const segmentEnd = offset + segmentLength;
      if (tiffStart + 8 > segmentEnd) {
        return 1;
      }
      const byteOrder = view.getUint16(tiffStart, false);
      const littleEndian = byteOrder === 0x4949;
      if (!littleEndian && byteOrder !== 0x4d4d) {
        return 1;
      }

      const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
      const ifdStart = tiffStart + ifdOffset;
      if (ifdStart < tiffStart || ifdStart + 2 > segmentEnd) {
        return 1;
      }

      const entryCount = view.getUint16(ifdStart, littleEndian);
      for (let index = 0; index < entryCount; index += 1) {
        const entryOffset = ifdStart + 2 + index * 12;
        if (entryOffset + 12 > segmentEnd) {
          break;
        }
        if (view.getUint16(entryOffset, littleEndian) === 0x0112) {
          const orientation = view.getUint16(entryOffset + 8, littleEndian);
          return orientation >= 1 && orientation <= 8
            ? (orientation as ExifOrientation)
            : 1;
        }
      }
      return 1;
    }

    offset += segmentLength;
  }

  return 1;
}

export function getImageTransform(
  image: ImageInput,
  bytes?: ArrayBuffer,
): ImageTransform {
  const orientation =
    image.exifOrientation ??
    (image.mimeType === "image/jpeg" && bytes
      ? readJpegExifOrientation(bytes)
      : 1);
  const exif = EXIF_TRANSFORMS[orientation];
  return {
    rotationClockwise: normalizeRotation(exif.rotationClockwise + image.rotation),
    mirrored: exif.mirrored,
  };
}

export function calculateContainedImageLayout(
  sourceWidth: number,
  sourceHeight: number,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  transform: ImageTransform,
): {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotationClockwise: PageRotation;
  mirrored: boolean;
} {
  const rotated =
    transform.rotationClockwise === 90 || transform.rotationClockwise === 270;
  const visualWidth = rotated ? sourceHeight : sourceWidth;
  const visualHeight = rotated ? sourceWidth : sourceHeight;
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;
  const scale = Math.min(availableWidth / visualWidth, availableHeight / visualHeight);

  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const boundingWidth = rotated ? height : width;
  const boundingHeight = rotated ? width : height;

  return {
    x: (pageWidth - boundingWidth) / 2,
    y: (pageHeight - boundingHeight) / 2,
    width,
    height,
    scale,
    rotationClockwise: transform.rotationClockwise,
    mirrored: transform.mirrored,
  };
}
