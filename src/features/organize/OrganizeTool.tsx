import { FileStack, RotateCw, Trash2, Undo2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  Button,
  FileDropzone,
  IconButton,
  InlineError,
  LargeFileWarningDialog,
  ProcessingProgress,
  ResultDownload,
  SortableGrid,
  ToolLayout,
} from "../../components";
import {
  LARGE_FILE_BYTES,
  LARGE_PAGE_COUNT,
  defaultOutputName,
  sanitizePdfFilename,
  type PageRef,
  type PageRotation,
  type PdfJob,
} from "../../pdf";
import { LazyPdfPageCanvas } from "../shared/pdfPreview";
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

type OrganizeSource = SelectedPdf & { id: string };

function makePages(source: OrganizeSource): PageRef[] {
  return Array.from({ length: source.pageCount }, (_, pageIndex) => ({
    id: `${source.id}-page-${pageIndex}`,
    sourceId: source.id,
    pageIndex,
    rotation: 0,
  }));
}

export function OrganizeTool() {
  const [source, setSource] = useState<OrganizeSource | null>(null);
  const [pending, setPending] =
    useState<PendingSinglePdf<OrganizeSource> | null>(null);
  const [pages, setPages] = useState<PageRef[]>([]);
  const [outputName, setOutputName] = useState("organized.pdf");
  const [inputError, setInputError] = useState<string | null>(null);
  const job = usePdfJob();
  const inputParsing = useInputParsing();
  const preview = usePdfDocument(source?.file ?? null);

  const hasPageChanges = useMemo(
    () =>
      source !== null &&
      (pages.length !== source.pageCount ||
        pages.some(
          (page, index) => page.pageIndex !== index || page.rotation !== 0,
        )),
    [pages, source],
  );

  const applySource = useCallback(
    (next: OrganizeSource) => {
      setSource(next);
      setPages(makePages(next));
      setOutputName(defaultOutputName("organize", [{ name: next.file.name }]));
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

  function rotate(pageId: string) {
    setPages((current) =>
      current.map((page) =>
        page.id === pageId
          ? {
              ...page,
              rotation: ((page.rotation + 90) % 360) as PageRotation,
            }
          : page,
      ),
    );
  }

  function remove(pageId: string) {
    if (pages.length === 1) {
      setInputError("PDF kết quả phải còn ít nhất một trang.");
      return;
    }
    setPages((current) => current.filter((page) => page.id !== pageId));
  }

  async function process() {
    if (!source || pages.length === 0) return;
    setInputError(null);
    await job.run(async () => {
      const pdfJob: PdfJob = {
        id: makeJobId("organize"),
        type: "organize",
        source: await toPdfInput(source, source.id),
        pages,
      };
      return pdfJob;
    });
  }

  function restorePages() {
    if (source) setPages(makePages(source));
  }

  function resetAll() {
    inputParsing.cancelInputParsing();
    setSource(null);
    setPending(null);
    setPages([]);
    setOutputName("organized.pdf");
    setInputError(null);
    job.reset();
  }

  return (
    <ToolLayout
      title="Sắp xếp PDF"
      description="Đổi thứ tự, xoay hoặc loại bỏ trang trước khi tạo tài liệu mới."
      icon={<FileStack aria-hidden="true" />}
      onReset={resetAll}
      hasChanges={source !== null}
      actions={
        source &&
        hasPageChanges &&
        job.status !== "processing" &&
        job.status !== "done" ? (
          <Button variant="ghost" onPress={restorePages}>
            <Undo2 className="size-4" aria-hidden="true" />
            Khôi phục trang
          </Button>
        ) : undefined
      }
      notice="Kéo thả để sắp xếp, hoặc dùng các nút di chuyển trên từng trang."
    >
      <div className="space-y-6">
        {!source && (
          <FileDropzone
            accept={["application/pdf", ".pdf"]}
            disabled={inputParsing.isParsing}
            title="Chọn một file PDF để sắp xếp"
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
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  {source.file.name}
                </p>
                <p className="text-sm text-slate-500 tabular-nums">
                  Còn {pages.length}/{source.pageCount} trang ·{" "}
                  {bytesLabel(source.file.size)}
                </p>
              </div>
              {preview.loading && (
                <p className="text-sm text-slate-500" role="status">
                  Đang tạo hình xem trước…
                </p>
              )}
            </div>

            {preview.document && (
              <SortableGrid
                items={pages}
                getId={(page) => page.id}
                getLabel={(page) => `trang gốc ${page.pageIndex + 1}`}
                onReorder={setPages}
                label="Các trang PDF có thể sắp xếp"
                disabled={job.status === "processing"}
                renderItem={(page, index) => (
                  <div className="space-y-3">
                    <div className="flex min-h-52 items-center justify-center overflow-hidden rounded-lg bg-slate-100 p-2">
                      <LazyPdfPageCanvas
                        document={preview.document!}
                        pageNumber={page.pageIndex + 1}
                        rotation={page.rotation}
                        maxWidth={220}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-700 tabular-nums">
                        Vị trí {index + 1} · Trang {page.pageIndex + 1}
                      </span>
                      <div className="flex gap-1">
                        <IconButton
                          variant="ghost"
                          isDisabled={job.status === "processing"}
                          aria-label={`Xoay trang ${page.pageIndex + 1} sang phải`}
                          onPress={() => rotate(page.id)}
                        >
                          <RotateCw className="size-4" aria-hidden="true" />
                        </IconButton>
                        <IconButton
                          variant="ghost"
                          className="text-red-700 hover:bg-red-50"
                          aria-label={`Xóa trang ${page.pageIndex + 1}`}
                          isDisabled={
                            job.status === "processing" || pages.length === 1
                          }
                          onPress={() => remove(page.id)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                )}
              />
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <label
                htmlFor="organize-output-name"
                className="mb-2 block text-sm font-medium text-slate-800"
              >
                Tên file kết quả
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="organize-output-name"
                  value={outputName}
                  onChange={(event) => setOutputName(event.target.value)}
                  className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3"
                />
                <Button
                  variant="primary"
                  onPress={process}
                  isDisabled={job.status === "processing" || pages.length === 0}
                >
                  Tạo PDF đã sắp xếp
                </Button>
              </div>
            </section>
          </>
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
            fileName={sanitizePdfFilename(outputName, "organized.pdf")}
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
