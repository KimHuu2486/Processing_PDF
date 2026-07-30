import { Hash } from "lucide-react";
import { useCallback, useState } from "react";

import {
  Button,
  FileDropzone,
  InlineError,
  LargeFileWarningDialog,
  ProcessingProgress,
  ResultDownload,
  ToolLayout,
} from "../../components";
import {
  LARGE_FILE_BYTES,
  LARGE_PAGE_COUNT,
  defaultOutputName,
  sanitizePdfFilename,
  validatePageRange,
  type PageNumberPosition,
  type PdfJob,
} from "../../pdf";
import { cn } from "../../lib/cn";
import { PdfPageCanvas } from "../shared/pdfPreview";
import { usePdfDocument } from "../shared/usePdfDocument";
import { usePdfJob } from "../shared/usePdfJob";
import { useInputParsing } from "../shared/useInputParsing";
import {
  bytesLabel,
  makeJobId,
  pendingPdfBytes,
  pendingPdfPages,
  selectPdf,
  toPdfInput,
  type PendingSinglePdf,
  type SelectedPdf,
} from "../shared/toolUtils";

type NumberSource = SelectedPdf & { id: string };

const positions: Array<{ value: PageNumberPosition; label: string }> = [
  { value: "top-left", label: "Trên trái" },
  { value: "top-center", label: "Trên giữa" },
  { value: "top-right", label: "Trên phải" },
  { value: "bottom-left", label: "Dưới trái" },
  { value: "bottom-center", label: "Dưới giữa" },
  { value: "bottom-right", label: "Dưới phải" },
];

function previewPosition(position: PageNumberPosition) {
  return cn(
    "absolute rounded bg-white/90 px-1.5 py-0.5 font-semibold text-slate-900 shadow-sm",
    position.startsWith("top") ? "top-4" : "bottom-4",
    position.endsWith("left") && "left-4",
    position.endsWith("center") && "left-1/2 -translate-x-1/2",
    position.endsWith("right") && "right-4",
  );
}

export function PageNumbersTool() {
  const [source, setSource] = useState<NumberSource | null>(null);
  const [pending, setPending] =
    useState<PendingSinglePdf<NumberSource> | null>(null);
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(1);
  const [startNumber, setStartNumber] = useState(1);
  const [position, setPosition] =
    useState<PageNumberPosition>("bottom-center");
  const [fontSize, setFontSize] = useState(12);
  const [margin, setMargin] = useState(24);
  const [previewPage, setPreviewPage] = useState(1);
  const [outputName, setOutputName] = useState("numbered.pdf");
  const [inputError, setInputError] = useState<string | null>(null);
  const job = usePdfJob();
  const inputParsing = useInputParsing();
  const preview = usePdfDocument(source?.file ?? null);

  const applySource = useCallback(
    (next: NumberSource) => {
      setSource(next);
      setStart(1);
      setEnd(next.pageCount);
      setStartNumber(1);
      setPosition("bottom-center");
      setFontSize(12);
      setMargin(24);
      setPreviewPage(1);
      setOutputName(
        defaultOutputName("page-numbers", [{ name: next.file.name }]),
      );
      setInputError(null);
      job.reset();
    },
    [job],
  );

  async function parseSelection(file: File) {
    setInputError(null);
    try {
      const parsed = await inputParsing.runInputParsing(() => selectPdf(file));
      if (!parsed.current) return;
      const selected = parsed.value;
      const next = { ...selected, id: crypto.randomUUID() };
      if (next.pageCount > LARGE_PAGE_COUNT) {
        setPending({ kind: "parsed", value: next });
      } else {
        applySource(next);
      }
    } catch (error) {
      setInputError(
        error instanceof Error ? error.message : "Không thể đọc file PDF.",
      );
    }
  }

  async function choose(files: File[]) {
    if (inputParsing.isParsing) return;
    const file = files[0];
    if (!file) return;
    setInputError(null);
    if (file.size > LARGE_FILE_BYTES) {
      setPending({ kind: "raw-file", file });
      return;
    }
    await parseSelection(file);
  }

  async function process() {
    if (!source) return;
    setInputError(null);
    try {
      const range = validatePageRange({ start, end }, source.pageCount);
      if (
        !Number.isInteger(startNumber) ||
        fontSize < 8 ||
        fontSize > 48 ||
        margin < 0 ||
        margin > 72
      ) {
        throw new Error("Thiết lập đánh số trang chưa hợp lệ.");
      }
      await job.run(async () => {
        const pdfJob: PdfJob = {
          id: makeJobId("page-numbers"),
          type: "number-pages",
          source: await toPdfInput(source, source.id),
          range,
          startNumber,
          position,
          fontSize,
          margin,
        };
        return pdfJob;
      });
    } catch (error) {
      setInputError(
        error instanceof Error ? error.message : "Thiết lập chưa hợp lệ.",
      );
    }
  }

  function resetAll() {
    inputParsing.cancelInputParsing();
    setSource(null);
    setPending(null);
    setInputError(null);
    setOutputName("numbered.pdf");
    job.reset();
  }

  const shownNumber =
    startNumber + Math.max(0, Math.min(previewPage, end) - start);

  return (
    <ToolLayout
      title="Đánh số trang"
      description="Thêm số vào một khoảng trang với vị trí và kiểu hiển thị bạn chọn."
      icon={<Hash aria-hidden="true" />}
      onReset={resetAll}
      hasChanges={source !== null}
      notice="Các trang ngoài phạm vi sẽ được giữ nguyên và không có số mới."
    >
      <div className="space-y-6">
        {!source && (
          <FileDropzone
            accept={["application/pdf", ".pdf"]}
            disabled={inputParsing.isParsing}
            title="Chọn một file PDF để đánh số"
            onFiles={choose}
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
        {inputParsing.isParsing && (
          <p className="text-sm text-slate-600" role="status">
            Đang kiểm tra cấu trúc và số trang PDF…
          </p>
        )}

        {source && job.status !== "done" && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)]">
            <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
              <div>
                <p className="truncate font-semibold text-slate-900">
                  {source.file.name}
                </p>
                <p className="text-sm text-slate-500 tabular-nums">
                  {source.pageCount} trang · {bytesLabel(source.file.size)}
                </p>
              </div>

              <fieldset disabled={job.status === "processing"}>
                <legend className="text-sm font-semibold text-slate-900">
                  Phạm vi trang
                </legend>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    Từ trang
                    <input
                      type="number"
                      min={1}
                      max={source.pageCount}
                      value={start}
                      onChange={(event) => setStart(Number(event.target.value))}
                      className="min-h-11 w-full rounded-lg border border-slate-300 px-3 tabular-nums"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    Đến trang
                    <input
                      type="number"
                      min={1}
                      max={source.pageCount}
                      value={end}
                      onChange={(event) => setEnd(Number(event.target.value))}
                      className="min-h-11 w-full rounded-lg border border-slate-300 px-3 tabular-nums"
                    />
                  </label>
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Số bắt đầu
                  <input
                    type="number"
                    step={1}
                    value={startNumber}
                    disabled={job.status === "processing"}
                    onChange={(event) =>
                      setStartNumber(Number(event.target.value))
                    }
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 tabular-nums"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Vị trí
                  <select
                    value={position}
                    disabled={job.status === "processing"}
                    onChange={(event) =>
                      setPosition(event.target.value as PageNumberPosition)
                    }
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
                  >
                    {positions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Cỡ chữ (8–48 pt)
                  <input
                    type="number"
                    min={8}
                    max={48}
                    value={fontSize}
                    disabled={job.status === "processing"}
                    onChange={(event) =>
                      setFontSize(Number(event.target.value))
                    }
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 tabular-nums"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Lề (0–72 pt)
                  <input
                    type="number"
                    min={0}
                    max={72}
                    value={margin}
                    disabled={job.status === "processing"}
                    onChange={(event) => setMargin(Number(event.target.value))}
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 tabular-nums"
                  />
                </label>
              </div>

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
                isDisabled={job.status === "processing"}
              >
                Thêm số trang
              </Button>
            </section>

            <section
              aria-labelledby="number-preview-title"
              className="rounded-xl border border-slate-200 bg-slate-100 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2
                  id="number-preview-title"
                  className="font-semibold text-slate-900"
                >
                  Xem trước vị trí
                </h2>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  Trang
                  <input
                    type="number"
                    min={1}
                    max={source.pageCount}
                    value={previewPage}
                    disabled={job.status === "processing"}
                    onChange={(event) =>
                      setPreviewPage(
                        Math.max(
                          1,
                          Math.min(source.pageCount, Number(event.target.value)),
                        ),
                      )
                    }
                    className="min-h-11 w-20 rounded-lg border border-slate-300 bg-white px-2 tabular-nums"
                  />
                </label>
              </div>
              <div className="flex min-h-96 items-center justify-center overflow-auto">
                {preview.document && (
                  <div className="relative inline-block">
                    <PdfPageCanvas
                      document={preview.document}
                      pageNumber={previewPage}
                      maxWidth={360}
                    />
                    {previewPage >= start && previewPage <= end && (
                      <span
                        className={previewPosition(position)}
                        style={{ fontSize: `${Math.max(8, fontSize)}px` }}
                      >
                        {shownNumber}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-3 text-pretty text-xs text-slate-500">
                Bản xem trước minh họa vị trí; kích thước thật dùng đơn vị pt
                của PDF.
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
            fileName={sanitizePdfFilename(outputName, "numbered.pdf")}
            fileSize={job.resultSize ?? undefined}
            onReset={resetAll}
          />
        )}
      </div>

      <LargeFileWarningDialog
        isOpen={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        totalBytes={pendingPdfBytes(pending)}
        totalPages={pendingPdfPages(pending)}
        onContinue={() => {
          const approved = pending;
          setPending(null);
          if (approved?.kind === "raw-file") {
            void parseSelection(approved.file);
          } else if (approved?.kind === "parsed") {
            applySource(approved.value);
          }
        }}
        onCancel={() => setPending(null)}
      />
    </ToolLayout>
  );
}
