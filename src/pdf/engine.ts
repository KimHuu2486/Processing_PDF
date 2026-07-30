import {
  degrees,
  EncryptedPDFError,
  PDFDocument,
  type PDFImage,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";

import { normalizePdfError, PdfToolError } from "./errors";
import {
  calculatePageNumberPlacement,
  normalizeRotation,
  normalizedCropToBox,
} from "./geometry";
import {
  calculateContainedImageLayout,
  getImageTransform,
  stripJpegMetadata,
} from "./imageOrientation";
import type {
  CropMargins,
  ImageInput,
  ImagesToPdfJob,
  MergeJob,
  NumberPagesJob,
  OrganizeJob,
  PdfInput,
  PdfJob,
  PdfProgressReporter,
  SplitJob,
  WorkerProgressEvent,
} from "./types";
import { validatePageRange, validatePdfJob } from "./validation";

export const A4_PORTRAIT = {
  width: 595.28,
  height: 841.89,
} as const;
export const DEFAULT_IMAGE_MARGIN = 24;

function report(
  job: PdfJob,
  reporter: PdfProgressReporter | undefined,
  progress: number,
  message: string,
): void {
  const event: WorkerProgressEvent = {
    type: "progress",
    jobId: job.id,
    progress: Math.max(0, Math.min(100, progress * 100)),
    message,
  };
  reporter?.(event);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes.buffer;
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function savePdf(document: PDFDocument): Promise<ArrayBuffer> {
  const bytes = await document.save({
    addDefaultPage: false,
    useObjectStreams: true,
  });
  return toArrayBuffer(bytes);
}

async function loadPdf(input: PdfInput): Promise<PDFDocument> {
  try {
    const bytes = await input.blob.arrayBuffer();
    const document = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
    if (document.getPageCount() === 0) {
      throw new PdfToolError("empty-pdf");
    }
    return document;
  } catch (error) {
    if (error instanceof PdfToolError) {
      throw error;
    }
    if (
      error instanceof EncryptedPDFError ||
      (error instanceof Error && /encrypt|password/i.test(error.message))
    ) {
      throw new PdfToolError("encrypted-pdf");
    }
    throw new PdfToolError(
      "corrupt-pdf",
      undefined,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function mergePdfs(
  job: MergeJob,
  reporter?: PdfProgressReporter,
): Promise<ArrayBuffer> {
  const output = await PDFDocument.create();
  for (let sourceIndex = 0; sourceIndex < job.sources.length; sourceIndex += 1) {
    const source = job.sources[sourceIndex];
    const document = await loadPdf(source);
    const pageCount = document.getPageCount();
    const pages = await output.copyPages(document, document.getPageIndices());
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const page = pages[pageIndex];
      output.addPage(page);
      report(
        job,
        reporter,
        (sourceIndex + (pageIndex + 1) / pageCount) / job.sources.length,
        `Đang gộp file ${sourceIndex + 1}/${job.sources.length} · trang ${pageIndex + 1}/${pageCount}`,
      );
    }
  }

  return savePdf(output);
}

async function splitPdf(
  job: SplitJob,
  reporter?: PdfProgressReporter,
): Promise<ArrayBuffer> {
  const source = await loadPdf(job.source);
  const range = validatePageRange(job.range, source.getPageCount());
  const indices = Array.from(
    { length: range.end - range.start + 1 },
    (_, index) => range.start - 1 + index,
  );
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, indices);

  pages.forEach((page, index) => {
    output.addPage(page);
    report(
      job,
      reporter,
      (index + 1) / pages.length,
      `Đang trích trang ${range.start + index}/${range.end}`,
    );
  });
  return savePdf(output);
}

function applyNormalizedCrop(page: PDFPage, crop: CropMargins): void {
  const rotation = normalizeRotation(page.getRotation().angle);
  const next = normalizedCropToBox(page.getCropBox(), crop, rotation);
  page.setCropBox(next.x, next.y, next.width, next.height);
}

async function organizePdf(
  job: OrganizeJob,
  reporter?: PdfProgressReporter,
): Promise<ArrayBuffer> {
  const source = await loadPdf(job.source);
  const sourcePageCount = source.getPageCount();
  const output = await PDFDocument.create();

  for (const pageRef of job.pages) {
    if (pageRef.pageIndex >= sourcePageCount) {
      throw new PdfToolError(
        "invalid-input",
        `Trang ${pageRef.pageIndex + 1} không tồn tại trong file nguồn.`,
      );
    }
  }

  // One copier preserves shared fonts/images across every copied page. Calling
  // copyPages once per page duplicates those resources and can inflate output
  // dramatically for scanned or image-heavy documents.
  const copiedPages = await output.copyPages(
    source,
    job.pages.map((pageRef) => pageRef.pageIndex),
  );

  for (let index = 0; index < job.pages.length; index += 1) {
    const pageRef = job.pages[index];
    const page = copiedPages[index];
    const sourceRotation = page.getRotation().angle;
    page.setRotation(degrees(normalizeRotation(sourceRotation + pageRef.rotation)));
    if (pageRef.crop) {
      applyNormalizedCrop(page, pageRef.crop);
    }
    output.addPage(page);
    report(
      job,
      reporter,
      (index + 1) / job.pages.length,
      `Đang sắp xếp trang ${index + 1}/${job.pages.length}`,
    );
  }

  return savePdf(output);
}

async function addPageNumbers(
  job: NumberPagesJob,
  reporter?: PdfProgressReporter,
): Promise<ArrayBuffer> {
  const document = await loadPdf(job.source);
  const range = validatePageRange(job.range, document.getPageCount());
  const font = await document.embedFont(StandardFonts.Helvetica);
  const pageTotal = range.end - range.start + 1;

  for (let pageNumber = range.start; pageNumber <= range.end; pageNumber += 1) {
    const page = document.getPage(pageNumber - 1);
    const text = String(job.startNumber + pageNumber - range.start);
    const textWidth = font.widthOfTextAtSize(text, job.fontSize);
    const rotation = normalizeRotation(page.getRotation().angle);
    const placement = calculatePageNumberPlacement(
      page.getCropBox(),
      rotation,
      job.position,
      textWidth,
      job.fontSize,
      job.margin,
    );
    page.drawText(text, {
      x: placement.x,
      y: placement.y,
      size: job.fontSize,
      font,
      color: rgb(0.12, 0.12, 0.14),
      rotate: degrees(placement.rotation),
    });

    const completed = pageNumber - range.start + 1;
    report(
      job,
      reporter,
      completed / pageTotal,
      `Đang đánh số trang ${completed}/${pageTotal}`,
    );
  }
  return savePdf(document);
}

async function embedImage(
  document: PDFDocument,
  image: ImageInput,
): Promise<{ embedded: PDFImage; bytes: ArrayBuffer }> {
  try {
    const bytes = await image.blob.arrayBuffer();
    const embedded = image.mimeType === "image/png"
      ? await document.embedPng(bytes)
      : await document.embedJpg(stripJpegMetadata(bytes));
    return { embedded, bytes };
  } catch (error) {
    throw new PdfToolError(
      "unsupported-image",
      "Không thể đọc ảnh. File có thể bị hỏng hoặc sai định dạng.",
      error instanceof Error ? error.message : String(error),
    );
  }
}

function getA4PageSize(
  imageWidth: number,
  imageHeight: number,
  rotationClockwise: number,
): { width: number; height: number } {
  const swapsAxes = rotationClockwise === 90 || rotationClockwise === 270;
  const visualWidth = swapsAxes ? imageHeight : imageWidth;
  const visualHeight = swapsAxes ? imageWidth : imageHeight;
  return visualWidth > visualHeight
    ? { width: A4_PORTRAIT.height, height: A4_PORTRAIT.width }
    : A4_PORTRAIT;
}

function imageDrawingOrigin(layout: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotationClockwise: number;
  mirrored: boolean;
}): { x: number; y: number; signedWidth: number; pdfAngle: number } {
  const pdfAngle = -layout.rotationClockwise;
  const radians = (pdfAngle * Math.PI) / 180;
  const signedWidth = layout.mirrored ? -layout.width : layout.width;
  const widthVector = {
    x: Math.cos(radians) * signedWidth,
    y: Math.sin(radians) * signedWidth,
  };
  const heightVector = {
    x: -Math.sin(radians) * layout.height,
    y: Math.cos(radians) * layout.height,
  };
  const xs = [0, widthVector.x, heightVector.x, widthVector.x + heightVector.x];
  const ys = [0, widthVector.y, heightVector.y, widthVector.y + heightVector.y];
  return {
    x: layout.x - Math.min(...xs),
    y: layout.y - Math.min(...ys),
    signedWidth,
    pdfAngle,
  };
}

async function imagesToPdf(
  job: ImagesToPdfJob,
  reporter?: PdfProgressReporter,
): Promise<ArrayBuffer> {
  const document = await PDFDocument.create();
  const margin = job.margin ?? DEFAULT_IMAGE_MARGIN;

  for (let index = 0; index < job.images.length; index += 1) {
    const input = job.images[index];
    const { embedded: image, bytes } = await embedImage(document, input);
    const transform = getImageTransform(input, bytes);
    const pageSize = getA4PageSize(
      image.width,
      image.height,
      transform.rotationClockwise,
    );
    const page = document.addPage([pageSize.width, pageSize.height]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageSize.width,
      height: pageSize.height,
      color: rgb(1, 1, 1),
    });
    const layout = calculateContainedImageLayout(
      image.width,
      image.height,
      pageSize.width,
      pageSize.height,
      margin,
      transform,
    );
    const origin = imageDrawingOrigin(layout);
    page.drawImage(image, {
      x: origin.x,
      y: origin.y,
      width: origin.signedWidth,
      height: layout.height,
      rotate: degrees(origin.pdfAngle),
    });
    report(
      job,
      reporter,
      (index + 1) / job.images.length,
      `Đang thêm ảnh ${index + 1}/${job.images.length}`,
    );
  }

  return savePdf(document);
}

async function cropPdf(
  job: Extract<PdfJob, { type: "crop" }>,
  reporter?: PdfProgressReporter,
): Promise<ArrayBuffer> {
  const document = await loadPdf(job.source);
  const pageCount = document.getPageCount();
  const pageIndices = [...new Set(job.pageIndices)];

  for (let index = 0; index < pageIndices.length; index += 1) {
    const pageIndex = pageIndices[index];
    if (pageIndex >= pageCount) {
      throw new PdfToolError(
        "invalid-input",
        `Trang ${pageIndex + 1} không tồn tại trong file nguồn.`,
      );
    }
    applyNormalizedCrop(document.getPage(pageIndex), job.crop);
    report(
      job,
      reporter,
      (index + 1) / pageIndices.length,
      `Đang cắt trang ${index + 1}/${pageIndices.length}`,
    );
  }

  return savePdf(document);
}

export async function executePdfJob(
  job: PdfJob,
  reporter?: PdfProgressReporter,
): Promise<ArrayBuffer> {
  validatePdfJob(job);
  report(job, reporter, 0, "Đang chuẩn bị tài liệu");

  try {
    let result: ArrayBuffer;
    switch (job.type) {
      case "merge":
        result = await mergePdfs(job, reporter);
        break;
      case "split":
        result = await splitPdf(job, reporter);
        break;
      case "organize":
        result = await organizePdf(job, reporter);
        break;
      case "number-pages":
        result = await addPageNumbers(job, reporter);
        break;
      case "images-to-pdf":
        result = await imagesToPdf(job, reporter);
        break;
      case "crop":
        result = await cropPdf(job, reporter);
        break;
    }
    report(job, reporter, 1, "Hoàn tất");
    return result;
  } catch (error) {
    throw normalizePdfError(error);
  }
}
