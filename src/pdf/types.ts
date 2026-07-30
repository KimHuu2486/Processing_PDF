export type ToolId =
  | "merge"
  | "split"
  | "organize"
  | "page-numbers"
  | "images-to-pdf"
  | "scan-to-pdf"
  | "crop";

export type SourceKind = "pdf" | "image";
export type PageRotation = 0 | 90 | 180 | 270;
export type ImageMimeType = "image/jpeg" | "image/png";
export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface SourceFile {
  id: string;
  file: File;
  kind: SourceKind;
  name: string;
  size: number;
  mimeType: string;
  pageCount?: number;
}

export interface PdfInput {
  id: string;
  name: string;
  /**
   * Blob/File is structured-cloned to the worker without eagerly duplicating
   * the complete document in main-thread JavaScript memory.
   */
  blob: Blob;
}

export interface ImageInput extends PdfInput {
  mimeType: ImageMimeType;
  rotation: PageRotation;
  exifOrientation?: ExifOrientation;
}

export interface CropMargins {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PageRef {
  id: string;
  sourceId: string;
  pageIndex: number;
  rotation: PageRotation;
  crop?: CropMargins;
}

export interface PageRange {
  start: number;
  end: number;
}

export type PageNumberPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

interface JobBase {
  id: string;
}

export interface MergeJob extends JobBase {
  type: "merge";
  sources: PdfInput[];
}

export interface SplitJob extends JobBase {
  type: "split";
  source: PdfInput;
  /** One-based, inclusive page range. */
  range: PageRange;
}

export interface OrganizeJob extends JobBase {
  type: "organize";
  source: PdfInput;
  pages: PageRef[];
}

export interface NumberPagesJob extends JobBase {
  type: "number-pages";
  source: PdfInput;
  /** One-based, inclusive page range. */
  range: PageRange;
  startNumber: number;
  position: PageNumberPosition;
  fontSize: number;
  margin: number;
}

export interface ImagesToPdfJob extends JobBase {
  type: "images-to-pdf";
  images: ImageInput[];
  margin?: number;
}

export interface CropJob extends JobBase {
  type: "crop";
  source: PdfInput;
  /** Zero-based page indices to receive the same visual crop. */
  pageIndices: number[];
  /** Normalized margins (0..1), relative to the currently displayed page. */
  crop: CropMargins;
}

export type PdfJob =
  | MergeJob
  | SplitJob
  | OrganizeJob
  | NumberPagesJob
  | ImagesToPdfJob
  | CropJob;

export type PdfJobType = PdfJob["type"];

export type PdfErrorCode =
  | "busy"
  | "cancelled"
  | "corrupt-pdf"
  | "crop-too-small"
  | "empty-pdf"
  | "encrypted-pdf"
  | "invalid-input"
  | "invalid-page-range"
  | "processing-failed"
  | "unsupported-image";

export interface PdfErrorInfo {
  code: PdfErrorCode;
  message: string;
  details?: string;
}

export interface WorkerProgressEvent {
  type: "progress";
  jobId: string;
  /** Completion percentage from 0 through 100. */
  progress: number;
  message: string;
}

export interface WorkerResultEvent {
  type: "result";
  jobId: string;
  bytes: ArrayBuffer;
  mimeType: "application/pdf";
}

export interface WorkerErrorEvent {
  type: "error";
  jobId: string;
  error: PdfErrorInfo;
}

export interface WorkerCancelledEvent {
  type: "cancelled";
  jobId: string;
}

export type WorkerEvent =
  | WorkerProgressEvent
  | WorkerResultEvent
  | WorkerErrorEvent
  | WorkerCancelledEvent;

export interface RunWorkerRequest {
  type: "run";
  job: PdfJob;
}

export type WorkerRequest = RunWorkerRequest;

export type PdfProgressReporter = (event: WorkerProgressEvent) => void;

export interface InputSizeWarning {
  totalBytes: number;
  totalPages: number;
  exceedsBytes: boolean;
  exceedsPages: boolean;
  message: string;
}
