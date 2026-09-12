import { Scissors } from "lucide-react";
import { useState } from "react";

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
  validatePageRange,
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

export function SplitTool() {
  const [selected, setSelected] = useState<SelectedPdf | null>(null);
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(1);
  const [outputName, setOutputName] = useState("pages_1-1.pdf");
  const [outputNameCustomized, setOutputNameCustomized] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const job = usePdfJob();
  const admission = useFileAdmission({
    kind: "pdf",
    parse: selectPdf,
    onAccepted: (loaded) => applySelected(loaded[0]),
  });

  function applySelected(value: SelectedPdf) {
    setSelected(value);
    setStart(1);
    setEnd(value.pageCount);
    setOutputName(
      defaultOutputName(
        "split",
        [{ name: value.file.name }],
        { start: 1, end: value.pageCount },
      ),
    );
    setOutputNameCustomized(false);
    job.reset();
  }

  function changeStart(nextStart: number) {
    setStart(nextStart);
    if (!outputNameCustomized && selected) {
      setOutputName(
        defaultOutputName(
          "split",
          [{ name: selected.file.name }],
          { start: nextStart, end },
        ),
      );
    }
  }

  function changeEnd(nextEnd: number) {
    setEnd(nextEnd);
    if (!outputNameCustomized && selected) {
      setOutputName(
        defaultOutputName(
          "split",
          [{ name: selected.file.name }],
          { start, end: nextEnd },
        ),
      );
    }
  }

  async function process() {
    if (!selected) return;
    setInputError(null);
    try {
      const range = validatePageRange({ start, end }, selected.pageCount);
      await job.run(async () => {
        const pdfJob: PdfJob = {
          id: makeJobId("split"),
          type: "split",
          source: await toPdfInput(selected),
          range,
        };
        return pdfJob;
      });
    } catch (error) {
      setInputError(
        error instanceof Error ? error.message : "Khoảng trang chưa hợp lệ.",
      );
    }
  }

  function resetAll() {
    admission.reset();
    setSelected(null);
    setStart(1);
    setEnd(1);
    setOutputNameCustomized(false);
    setInputError(null);
    job.reset();
  }

  return (
    <ToolLayout
      title="Tách PDF"
      description="Trích một khoảng trang liên tục thành tài liệu mới."
      icon={<Scissors aria-hidden="true" />}
      onReset={resetAll}
      hasChanges={selected !== null || admission.isBusy}
      notice="Số trang bắt đầu từ 1 và bao gồm cả trang đầu lẫn trang cuối."
    >
      <div className="space-y-6">
        {!selected && (
          <FileDropzone
            accept={["application/pdf", ".pdf"]}
            disabled={admission.isBusy}
            title="Chọn một file PDF"
            onFiles={admission.addFiles}
            onError={setInputError}
          />
        )}

        {inputError && (
          <InlineError message={inputError} onDismiss={() => setInputError(null)} />
        )}
        {job.error && (
          <InlineError message={job.error} onDismiss={job.dismissError} />
        )}
        <FileAdmissionFeedback admission={admission} />

        {selected && job.status !== "done" && (
          <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="truncate font-semibold text-slate-900">
                {selected.file.name}
              </p>
              <p className="text-sm text-slate-500 tabular-nums">
                {selected.pageCount} trang · {bytesLabel(selected.file.size)}
              </p>
            </div>

            <PdfFileThumbnail
              file={selected.file}
              label={`Xem trước trang đầu của ${selected.file.name}`}
              maxWidth={280}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-800">
                Trang bắt đầu
                <input
                  type="number"
                  min={1}
                  max={selected.pageCount}
                  value={start}
                  disabled={job.status === "processing"}
                  onChange={(event) =>
                    changeStart(Number(event.target.value))
                  }
                  className="min-h-11 w-full rounded-lg border border-slate-300 px-3 tabular-nums"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-800">
                Trang kết thúc
                <input
                  type="number"
                  min={1}
                  max={selected.pageCount}
                  value={end}
                  disabled={job.status === "processing"}
                  onChange={(event) => changeEnd(Number(event.target.value))}
                  className="min-h-11 w-full rounded-lg border border-slate-300 px-3 tabular-nums"
                />
              </label>
            </div>

            <label className="block space-y-2 text-sm font-medium text-slate-800">
              Tên file kết quả
              <input
                value={outputName}
                disabled={job.status === "processing"}
                onChange={(event) => {
                  setOutputName(event.target.value);
                  setOutputNameCustomized(true);
                }}
                className="min-h-11 w-full rounded-lg border border-slate-300 px-3"
              />
            </label>

            <Button
              variant="primary"
              onPress={process}
              isDisabled={job.status === "processing"}
              className="w-full sm:w-auto"
            >
              Tách khoảng trang
            </Button>
          </section>
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
            fileName={sanitizePdfFilename(outputName, "split.pdf")}
            fileSize={job.resultSize ?? undefined}
            onReset={resetAll}
          />
        )}
      </div>

    </ToolLayout>
  );
}
