import type { PdfInput } from "../../pdf";
import { fileToPdfInput } from "../../pdf";
import { readPdfMetadata } from "./pdfMetadata";

export type SelectedPdf = {
  file: File;
  pageCount: number;
};

export type PendingSinglePdf<T extends SelectedPdf = SelectedPdf> =
  | { kind: "raw-file"; file: File }
  | { kind: "parsed"; value: T };

export function pendingPdfBytes<T extends SelectedPdf>(
  pending: PendingSinglePdf<T> | null,
): number {
  if (!pending) return 0;
  return pending.kind === "raw-file"
    ? pending.file.size
    : pending.value.file.size;
}

export function pendingPdfPages<T extends SelectedPdf>(
  pending: PendingSinglePdf<T> | null,
): number | undefined {
  return pending?.kind === "parsed" ? pending.value.pageCount : undefined;
}

export async function selectPdf(file: File): Promise<SelectedPdf> {
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    throw new Error("Vui lòng chọn file PDF.");
  }
  const { pageCount } = await readPdfMetadata(file);
  return { file, pageCount };
}

export async function toPdfInput(
  selected: SelectedPdf,
  id?: string,
): Promise<PdfInput> {
  return fileToPdfInput(selected.file, id);
}

export function makeJobId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function bytesLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
