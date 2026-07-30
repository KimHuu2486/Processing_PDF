import { deflateSync } from "node:zlib";

import { PDFDocument, rgb } from "pdf-lib";

export async function makePdf(pageCount = 3): Promise<Buffer> {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([
      420 + index * 10,
      595 + index * 10,
    ]);
    page.drawText(`Trang thu ${index + 1}`, {
      x: 36,
      y: page.getHeight() - 54,
      size: 18,
      color: rgb(0.15, 0.18, 0.24),
    });
  }
  return Buffer.from(await document.save());
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
  const output = new Uint8Array(12 + data.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length);
  output.set(typeBytes, 4);
  output.set(data, 8);
  const checksumInput = new Uint8Array(typeBytes.length + data.length);
  checksumInput.set(typeBytes);
  checksumInput.set(data, typeBytes.length);
  view.setUint32(8 + data.length, crc32(checksumInput));
  return output;
}

export function makePng(
  width = 8,
  height = 12,
  alpha = true,
): Buffer {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr.set([8, 6, 0, 0, 0], 8);

  const rows = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const offset = y * (1 + width * 4);
    rows[offset] = 0;
    for (let x = 0; x < width; x += 1) {
      rows.set(
        [239, 68 + x * 3, 68 + y * 2, alpha && x % 2 ? 120 : 255],
        offset + 1 + x * 4,
      );
    }
  }

  const chunks = [
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", new Uint8Array(deflateSync(rows))),
    pngChunk("IEND", new Uint8Array()),
  ];
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}
