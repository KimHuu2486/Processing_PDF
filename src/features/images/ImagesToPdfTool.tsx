import { Images } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  defaultOutputName,
  fileToImageInput,
  sanitizePdfFilename,
  type PdfJob,
} from "../../pdf";
import { ImageGridEditor } from "../shared/ImageGridEditor";
import {
  createSelectedImages,
  releaseSelectedImage,
  rotateImage,
  shouldWarnImageCollection,
  type SelectedImage,
} from "../shared/imageItems";
import { usePdfJob } from "../shared/usePdfJob";
import { bytesLabel, makeJobId } from "../shared/toolUtils";

type PendingImages = {
  all: SelectedImage[];
  added: SelectedImage[];
};

export function ImagesToPdfTool() {
  const [items, setItems] = useState<SelectedImage[]>([]);
  const [pending, setPending] = useState<PendingImages | null>(null);
  const [outputName, setOutputName] = useState("images.pdf");
  const [inputError, setInputError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  const pendingRef = useRef(pending);
  const job = usePdfJob();

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(
    () => () => {
      itemsRef.current.forEach(releaseSelectedImage);
      pendingRef.current?.added.forEach(releaseSelectedImage);
    },
    [],
  );

  function discardPending() {
    pending?.added.forEach(releaseSelectedImage);
    setPending(null);
  }

  async function addFiles(files: File[]) {
    setInputError(null);
    try {
      const added = createSelectedImages(files);
      const next = [...items, ...added];
      if (shouldWarnImageCollection(next)) {
        setPending({ all: next, added });
      } else {
        setItems(next);
        if (items.length === 0 && added[0]) {
          setOutputName(
            defaultOutputName("images-to-pdf", [
              { name: added[0].file.name },
            ]),
          );
        }
      }
    } catch (error) {
      setInputError(
        error instanceof Error ? error.message : "Không thể thêm ảnh.",
      );
    }
  }

  function remove(id: string) {
    setItems((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) releaseSelectedImage(removed);
      return current.filter((item) => item.id !== id);
    });
  }

  function rotate(id: string) {
    setItems((current) =>
      current.map((item) => (item.id === id ? rotateImage(item) : item)),
    );
  }

  async function process() {
    if (items.length === 0) {
      setInputError("Hãy chọn ít nhất một ảnh.");
      return;
    }
    setInputError(null);
    try {
      await job.run(async () => {
        const images = await Promise.all(
          items.map((item) =>
            fileToImageInput(item.file, item.id, item.rotation),
          ),
        );
        const pdfJob: PdfJob = {
          id: makeJobId("images"),
          type: "images-to-pdf",
          images,
          margin: 24,
        };
        return pdfJob;
      });
    } catch (error) {
      setInputError(
        error instanceof Error ? error.message : "Không thể đọc ảnh.",
      );
    }
  }

  function resetAll() {
    items.forEach(releaseSelectedImage);
    pending?.added.forEach(releaseSelectedImage);
    setItems([]);
    setPending(null);
    setOutputName("images.pdf");
    setInputError(null);
    job.reset();
  }

  const totalBytes = items.reduce(
    (total, image) => total + image.file.size,
    0,
  );

  return (
    <ToolLayout
      title="Ảnh sang PDF"
      description="Ghép nhiều ảnh JPG hoặc PNG thành các trang PDF A4 rõ nét."
      icon={<Images aria-hidden="true" />}
      onReset={resetAll}
      hasChanges={items.length > 0}
      notice="Mỗi ảnh tạo thành một trang A4 tự chọn dọc hoặc ngang, nền trắng và lề 24 pt."
    >
      <div className="space-y-6">
        <FileDropzone
          accept={["image/jpeg", "image/png", ".jpg", ".jpeg", ".png"]}
          multiple
          disabled={
            job.status === "processing" || job.status === "done"
          }
          title="Thả ảnh JPG hoặc PNG vào đây"
          description="Bạn có thể thêm nhiều lần, rồi sắp xếp và xoay từng ảnh."
          buttonLabel="Chọn ảnh"
          onFiles={addFiles}
          onError={setInputError}
        />

        {inputError && (
          <InlineError
            message={inputError}
            onDismiss={() => setInputError(null)}
          />
        )}
        {job.error && (
          <InlineError message={job.error} onDismiss={job.dismissError} />
        )}

        {items.length > 0 && job.status !== "done" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-900">Thứ tự ảnh</h2>
              <p className="text-sm text-slate-500 tabular-nums">
                {items.length} ảnh · {bytesLabel(totalBytes)}
              </p>
            </div>
            <ImageGridEditor
              items={items}
              onReorder={setItems}
              onRotate={rotate}
              onDelete={remove}
              disabled={job.status === "processing"}
            />

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <label
                htmlFor="images-output-name"
                className="mb-2 block text-sm font-medium text-slate-800"
              >
                Tên file kết quả
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="images-output-name"
                  value={outputName}
                  onChange={(event) => setOutputName(event.target.value)}
                  className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3"
                />
                <Button
                  variant="primary"
                  onPress={process}
                  isDisabled={job.status === "processing"}
                >
                  Tạo PDF từ ảnh
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
            fileName={sanitizePdfFilename(outputName, "images.pdf")}
            fileSize={job.resultSize ?? undefined}
            onReset={resetAll}
          />
        )}
      </div>

      <LargeFileWarningDialog
        isOpen={pending !== null}
        onOpenChange={(open) => {
          if (!open) discardPending();
        }}
        totalBytes={
          pending?.all.reduce(
            (total, image) => total + image.file.size,
            0,
          ) ?? 0
        }
        totalPages={pending?.all.length ?? 0}
        onContinue={() => {
          if (pending) {
            const wasEmpty = items.length === 0;
            setItems(pending.all);
            if (wasEmpty && pending.added[0]) {
              setOutputName(
                defaultOutputName("images-to-pdf", [
                  { name: pending.added[0].file.name },
                ]),
              );
            }
          }
          setPending(null);
        }}
        onCancel={discardPending}
      />
    </ToolLayout>
  );
}
