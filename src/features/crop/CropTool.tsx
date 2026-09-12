import { Crop, TriangleAlert } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  Button,
  FileDropzone,
  InlineError,
  ProcessingProgress,
  ResultDownload,
  ToolLayout,
} from "../../components";
import {
  defaultOutputName,
  sanitizePdfFilename,
  type CropMargins,
  type PdfJob,
} from "../../pdf";
import { cn } from "../../lib/cn";
import { PdfPageCanvas } from "../shared/pdfPreview";
import { usePdfDocument } from "../shared/usePdfDocument";
import { usePdfJob } from "../shared/usePdfJob";
import { useFileAdmission } from "../shared/useFileAdmission";
import { FileAdmissionFeedback } from "../shared/FileAdmissionFeedback";
import {
  bytesLabel,
  makeJobId,
  selectPdf,
  toPdfInput,
  type SelectedPdf,
} from "../shared/toolUtils";
import { clampCropMargins, clampNumber } from "./cropMath";

type CropSource = SelectedPdf & { id: string };
type DragMode = "move" | "north-west" | "north-east" | "south-west" | "south-east";
type DragState = {
  mode: DragMode;
  startX: number;
  startY: number;
  crop: CropMargins;
};

const emptyCrop: CropMargins = {
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
};

function percent(value: number) {
  return Math.round(value * 1000) / 10;
}

export function CropTool() {
  const [source, setSource] = useState<CropSource | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [applyToAll, setApplyToAll] = useState(false);
  const [crop, setCrop] = useState<CropMargins>(emptyCrop);
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 });
  const [outputName, setOutputName] = useState("cropped.pdf");
  const [inputError, setInputError] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const preview = usePdfDocument(source?.file ?? null);
  const job = usePdfJob();
  const admission = useFileAdmission({
    kind: "pdf",
    parse: selectPdf,
    onAccepted: (loaded) => applySource({ ...loaded[0], id: crypto.randomUUID() }),
  });

  useEffect(() => {
    let cancelled = false;
    if (!preview.document) return;
    void preview.document.getPage(currentPage).then((page) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 1 });
      setPageSize({ width: viewport.width, height: viewport.height });
    });
    return () => {
      cancelled = true;
    };
  }, [currentPage, preview.document]);

  function applySource(next: CropSource) {
    setSource(next);
    setCurrentPage(1);
    setApplyToAll(false);
    setCrop(emptyCrop);
    setOutputName(defaultOutputName("crop", [{ name: next.file.name }]));
    setInputError(null);
    job.reset();
  }

  const minWidth = Math.min(0.9, 36 / Math.max(36, pageSize.width));
  const minHeight = Math.min(0.9, 36 / Math.max(36, pageSize.height));

  function setSafeCrop(next: CropMargins) {
    setCrop(clampCropMargins(next, minWidth, minHeight));
  }

  function updateMargin(side: keyof CropMargins, value: number) {
    setSafeCrop({
      ...crop,
      [side]: clampNumber(value / 100, 0, 0.99),
    });
  }

  function startDrag(
    event: ReactPointerEvent<HTMLElement>,
    mode: DragMode,
  ) {
    event.preventDefault();
    frameRef.current?.parentElement?.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      crop,
    };
  }

  function drag(event: ReactPointerEvent<HTMLDivElement>) {
    const active = dragRef.current;
    const container = frameRef.current?.parentElement;
    if (!active || !container) return;
    const bounds = container.getBoundingClientRect();
    const dx = (event.clientX - active.startX) / Math.max(bounds.width, 1);
    const dy = (event.clientY - active.startY) / Math.max(bounds.height, 1);
    const next = { ...active.crop };

    if (active.mode === "move") {
      const width = 1 - active.crop.left - active.crop.right;
      const height = 1 - active.crop.top - active.crop.bottom;
      next.left = clampNumber(active.crop.left + dx, 0, 1 - width);
      next.right = 1 - width - next.left;
      next.top = clampNumber(active.crop.top + dy, 0, 1 - height);
      next.bottom = 1 - height - next.top;
    } else {
      if (active.mode.endsWith("west")) next.left = active.crop.left + dx;
      if (active.mode.endsWith("east")) next.right = active.crop.right - dx;
      if (active.mode.startsWith("north")) next.top = active.crop.top + dy;
      if (active.mode.startsWith("south")) {
        next.bottom = active.crop.bottom - dy;
      }
    }
    setSafeCrop(next);
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragRef.current = null;
    }
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.05 : 0.01;
    const width = 1 - crop.left - crop.right;
    const height = 1 - crop.top - crop.bottom;
    let left = crop.left;
    let top = crop.top;
    if (event.key === "ArrowLeft") left -= step;
    else if (event.key === "ArrowRight") left += step;
    else if (event.key === "ArrowUp") top -= step;
    else if (event.key === "ArrowDown") top += step;
    else return;
    event.preventDefault();
    left = clampNumber(left, 0, 1 - width);
    top = clampNumber(top, 0, 1 - height);
    setCrop({
      left,
      top,
      right: 1 - width - left,
      bottom: 1 - height - top,
    });
  }

  const handleSize = useCallback(() => {
    // Canvas sizing is handled by PDF.js; the crop overlay uses percentages.
  }, []);

  async function process() {
    if (!source) return;
    if (
      pageSize.width * (1 - crop.left - crop.right) < 36 ||
      pageSize.height * (1 - crop.top - crop.bottom) < 36
    ) {
      setInputError("Vùng giữ lại phải có kích thước tối thiểu 36 × 36 pt.");
      return;
    }
    setInputError(null);
    const pageIndices = applyToAll
      ? Array.from({ length: source.pageCount }, (_, index) => index)
      : [currentPage - 1];
    await job.run(async () => {
      const pdfJob: PdfJob = {
        id: makeJobId("crop"),
        type: "crop",
        source: await toPdfInput(source, source.id),
        pageIndices,
        crop,
      };
      return pdfJob;
    });
  }

  function resetCrop() {
    setCrop(emptyCrop);
  }

  function resetAll() {
    admission.reset();
    setSource(null);
    setCurrentPage(1);
    setApplyToAll(false);
    setCrop(emptyCrop);
    setInputError(null);
    setOutputName("cropped.pdf");
    job.reset();
  }

  return (
    <ToolLayout
      title="Cắt lề PDF"
      description="Chọn vùng hiển thị cần giữ lại trên một trang hoặc toàn bộ tài liệu."
      icon={<Crop aria-hidden="true" />}
      onReset={resetAll}
      hasChanges={source !== null || admission.isBusy}
      notice={
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
        >
          <TriangleAlert
            className="mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <p className="text-pretty text-sm leading-6">
            <strong>Crop không phải redaction.</strong> Nội dung bên ngoài vùng
            nhìn chỉ bị ẩn bằng CropBox và vẫn có thể được khôi phục. Không dùng
            công cụ này để xóa dữ liệu nhạy cảm.
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        {!source && (
          <FileDropzone
            accept={["application/pdf", ".pdf"]}
            disabled={admission.isBusy}
            title="Chọn một file PDF để cắt lề"
            onFiles={admission.addFiles}
            onError={setInputError}
          />
        )}

        {inputError && (
          <InlineError
            message={inputError}
            onDismiss={() => setInputError(null)}
          />
        )}
        {preview.error && <InlineError message={preview.error} />}
        {job.error && (
          <InlineError message={job.error} onDismiss={job.dismissError} />
        )}
        <FileAdmissionFeedback admission={admission} />

        {source && job.status !== "done" && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <section className="rounded-xl border border-slate-200 bg-slate-100 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {source.file.name}
                  </p>
                  <p className="text-sm text-slate-500 tabular-nums">
                    {source.pageCount} trang · {bytesLabel(source.file.size)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onPress={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    isDisabled={
                      currentPage === 1 || job.status === "processing"
                    }
                  >
                    Trước
                  </Button>
                  <span className="min-w-20 text-center text-sm font-medium text-slate-700 tabular-nums">
                    {currentPage}/{source.pageCount}
                  </span>
                  <Button
                    size="sm"
                    onPress={() =>
                      setCurrentPage((page) =>
                        Math.min(source.pageCount, page + 1),
                      )
                    }
                    isDisabled={
                      currentPage === source.pageCount ||
                      job.status === "processing"
                    }
                  >
                    Sau
                  </Button>
                </div>
              </div>

              <div className="flex min-h-[32rem] items-center justify-center overflow-auto p-5">
                {preview.document && (
                  <div
                    className="relative inline-block touch-none leading-none"
                    onPointerMove={drag}
                    onPointerUp={finishDrag}
                    onPointerCancel={finishDrag}
                  >
                    <PdfPageCanvas
                      document={preview.document}
                      pageNumber={currentPage}
                      maxWidth={620}
                      onSize={handleSize}
                    />
                    <div
                    ref={frameRef}
                      tabIndex={job.status === "processing" ? -1 : 0}
                      role="group"
                      aria-disabled={job.status === "processing"}
                      aria-label="Khung vùng PDF được giữ lại. Dùng phím mũi tên để di chuyển, giữ Shift để di chuyển nhanh."
                      onPointerDown={(event) => {
                        if (job.status !== "processing") {
                          startDrag(event, "move");
                        }
                      }}
                      onKeyDown={(event) => {
                        if (job.status !== "processing") {
                          moveWithKeyboard(event);
                        }
                      }}
                      className={cn(
                        "absolute z-10 cursor-move border-2 border-brand-600 bg-brand-500/10 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                        job.status === "processing" &&
                          "pointer-events-none cursor-not-allowed opacity-70",
                      )}
                      style={{
                        left: `${crop.left * 100}%`,
                        top: `${crop.top * 100}%`,
                        right: `${crop.right * 100}%`,
                        bottom: `${crop.bottom * 100}%`,
                      }}
                    >
                      {(
                        [
                          ["north-west", "-left-5 -top-5 cursor-nwse-resize"],
                          ["north-east", "-right-5 -top-5 cursor-nesw-resize"],
                          ["south-west", "-bottom-5 -left-5 cursor-nesw-resize"],
                          ["south-east", "-bottom-5 -right-5 cursor-nwse-resize"],
                        ] as const
                      ).map(([mode, classes]) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={job.status === "processing"}
                          aria-label={`Thay đổi góc ${mode} của vùng cắt`}
                          className={cn(
                            "absolute flex size-11 items-center justify-center rounded-full bg-transparent",
                            classes,
                          )}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            startDrag(event, mode);
                          }}
                        >
                          <span className="size-4 rounded-full border-2 border-white bg-brand-600 shadow" />
                        </button>
                      ))}
                    </div>
                    {(crop.top > 0 ||
                      crop.right > 0 ||
                      crop.bottom > 0 ||
                      crop.left > 0) && (
                      <>
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-0 top-0 bg-slate-950/45"
                          style={{ height: `${crop.top * 100}%` }}
                        />
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-0 bottom-0 bg-slate-950/45"
                          style={{ height: `${crop.bottom * 100}%` }}
                        />
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute bg-slate-950/45"
                          style={{
                            left: 0,
                            top: `${crop.top * 100}%`,
                            bottom: `${crop.bottom * 100}%`,
                            width: `${crop.left * 100}%`,
                          }}
                        />
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute bg-slate-950/45"
                          style={{
                            right: 0,
                            top: `${crop.top * 100}%`,
                            bottom: `${crop.bottom * 100}%`,
                            width: `${crop.right * 100}%`,
                          }}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-slate-900">
                  Lề cần ẩn (%)
                </h2>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={resetCrop}
                  isDisabled={job.status === "processing"}
                >
                  Đặt lại khung
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {(
                  [
                    ["top", "Trên"],
                    ["right", "Phải"],
                    ["bottom", "Dưới"],
                    ["left", "Trái"],
                  ] as const
                ).map(([side, label]) => (
                  <label
                    key={side}
                    className="space-y-2 text-sm font-medium text-slate-700"
                  >
                    {label}
                    <input
                      type="number"
                      min={0}
                      max={99}
                      step={0.1}
                      value={percent(crop[side])}
                      disabled={job.status === "processing"}
                      onChange={(event) =>
                        updateMargin(side, Number(event.target.value))
                      }
                      className="min-h-11 w-full rounded-lg border border-slate-300 px-3 tabular-nums"
                    />
                  </label>
                ))}
              </div>

              <fieldset>
                <legend className="text-sm font-semibold text-slate-900">
                  Áp dụng khung này
                </legend>
                <div className="mt-3 space-y-2">
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3">
                    <input
                      type="radio"
                      name="crop-scope"
                      checked={!applyToAll}
                      disabled={job.status === "processing"}
                      onChange={() => setApplyToAll(false)}
                    />
                    Chỉ trang {currentPage}
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3">
                    <input
                      type="radio"
                      name="crop-scope"
                      checked={applyToAll}
                      disabled={job.status === "processing"}
                      onChange={() => setApplyToAll(true)}
                    />
                    Tất cả {source.pageCount} trang theo cùng tỷ lệ
                  </label>
                </div>
              </fieldset>

              <label className="block space-y-2 text-sm font-medium text-slate-700">
                Tên file kết quả
                <input
                  value={outputName}
                  disabled={job.status === "processing"}
                  onChange={(event) => setOutputName(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 px-3"
                />
              </label>

              <Button
                variant="primary"
                onPress={process}
                className="w-full"
                isDisabled={job.status === "processing"}
              >
                Áp dụng CropBox
              </Button>
              <p className="text-pretty text-xs leading-5 text-slate-500">
                Vùng giữ lại tối thiểu 36 × 36 pt. Tỷ lệ lề được áp dụng theo
                hướng hiển thị của từng trang.
              </p>
            </section>
          </div>
        )}

        {job.status === "processing" && (
          <ProcessingProgress
            label={job.message}
            value={job.progress}
            onCancel={job.cancel}
          />
        )}
        {job.resultUrl && (
          <ResultDownload
            url={job.resultUrl}
            fileName={sanitizePdfFilename(outputName, "cropped.pdf")}
            fileSize={job.resultSize ?? undefined}
            onReset={resetAll}
          />
        )}
      </div>

    </ToolLayout>
  );
}
