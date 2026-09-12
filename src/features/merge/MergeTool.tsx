import { FileText, Merge, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Button,
  FileDropzone,
  IconButton,
  InlineError,
  ProcessingProgress,
  ResultDownload,
  SortableGrid,
  ToolLayout,
} from "../../components";
import {
  sanitizePdfFilename,
  type PdfJob,
} from "../../pdf";
import { usePdfJob } from "../shared/usePdfJob";
import {
  bytesLabel,
  makeJobId,
  selectPdf,
  toPdfInput,
  type SelectedPdf,
} from "../shared/toolUtils";
import { PdfFileThumbnail } from "../shared/PdfFileThumbnail";
import { useFileAdmission } from "../shared/useFileAdmission";
import { FileAdmissionFeedback } from "../shared/FileAdmissionFeedback";

type MergeItem = SelectedPdf & { id: string };
export function MergeTool() {
  const [items, setItems] = useState<MergeItem[]>([]);
  const [outputName, setOutputName] = useState("merged.pdf");
  const [inputError, setInputError] = useState<string | null>(null);
  const job = usePdfJob();
  const admission = useFileAdmission({
    kind: "pdf",
    parse: selectPdf,
    existing: items,
    onAccepted: (loaded) => setItems((current) => [
      ...current, ...loaded.map((item) => ({ ...item, id: crypto.randomUUID() })),
    ]),
  });

  const totals = useMemo(
    () => ({
      bytes: items.reduce((sum, item) => sum + item.file.size, 0),
      pages: items.reduce((sum, item) => sum + item.pageCount, 0),
    }),
    [items],
  );

  async function process() {
    if (items.length < 2) {
      setInputError("Cần ít nhất hai file PDF để gộp.");
      return;
    }
    await job.run(async () => {
      const sources = await Promise.all(
        items.map((item) => toPdfInput(item, item.id)),
      );
      const pdfJob: PdfJob = {
        id: makeJobId("merge"),
        type: "merge",
        sources,
      };
      return pdfJob;
    });
  }

  function resetAll() {
    admission.reset();
    setItems([]);
    setOutputName("merged.pdf");
    setInputError(null);
    job.reset();
  }

  return (
    <ToolLayout
      title="Gộp PDF"
      description="Kết hợp nhiều tài liệu theo đúng thứ tự bạn chọn."
      icon={<Merge aria-hidden="true" />}
      onReset={resetAll}
      hasChanges={items.length > 0 || admission.isBusy}
      notice="Mọi file chỉ được xử lý trong bộ nhớ của thiết bị."
    >
      <div className="space-y-6">
        <FileDropzone
          accept={["application/pdf", ".pdf"]}
          multiple
          disabled={
            admission.isBusy ||
            job.status === "processing" ||
            job.status === "done"
          }
          title="Thả các file PDF vào đây"
          description="Chọn từ hai file trở lên. Bạn có thể thêm file nhiều lần."
          onFiles={admission.addFiles}
          onError={setInputError}
        />

        {inputError && (
          <InlineError message={inputError} onDismiss={() => setInputError(null)} />
        )}
        <FileAdmissionFeedback admission={admission} />
        {job.error && (
          <InlineError message={job.error} onDismiss={job.dismissError} />
        )}

        {items.length > 0 && (
          <section aria-labelledby="merge-files-title" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="merge-files-title" className="font-semibold text-slate-900">
                Thứ tự tài liệu
              </h2>
              <p className="text-sm text-slate-500 tabular-nums">
                {items.length} file · {totals.pages} trang ·{" "}
                {bytesLabel(totals.bytes)}
              </p>
            </div>
            <SortableGrid
              items={items}
              getId={(item) => item.id}
              getLabel={(item) => item.file.name}
              onReorder={setItems}
              label="Các file PDF có thể sắp xếp"
              className="lg:grid-cols-2 xl:grid-cols-2"
              disabled={
                admission.isBusy ||
                job.status === "processing" ||
                job.status === "done"
              }
              renderItem={(item) => (
                <div className="space-y-3">
                  <PdfFileThumbnail
                    file={item.file}
                    label={`Xem trước trang đầu của ${item.file.name}`}
                  />
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <FileText className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900">
                        {item.file.name}
                      </span>
                      <span className="text-sm text-slate-500 tabular-nums">
                        {item.pageCount} trang · {bytesLabel(item.file.size)}
                      </span>
                    </span>
                    <IconButton
                      variant="ghost"
                      className="text-red-700 hover:bg-red-50"
                      isDisabled={
                        admission.isBusy ||
                        job.status === "processing" ||
                        job.status === "done"
                      }
                      onPress={() =>
                        setItems((current) =>
                          current.filter((entry) => entry.id !== item.id),
                        )
                      }
                      aria-label={`Xóa ${item.file.name}`}
                    >
                      <Trash2 className="size-5" aria-hidden="true" />
                    </IconButton>
                  </div>
                </div>
              )}
            />
          </section>
        )}

        {items.length > 0 && job.status !== "done" && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label
              htmlFor="merge-output-name"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Tên file kết quả
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="merge-output-name"
                value={outputName}
                onChange={(event) => setOutputName(event.target.value)}
                className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3"
              />
              <Button
                variant="primary"
                onPress={process}
                isDisabled={
                  admission.isBusy ||
                  items.length < 2 ||
                  job.status === "processing"
                }
              >
                Gộp PDF
              </Button>
            </div>
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
            fileName={sanitizePdfFilename(outputName, "merged.pdf")}
            fileSize={job.resultSize ?? undefined}
            onReset={resetAll}
          />
        )}
      </div>

    </ToolLayout>
  );
}
