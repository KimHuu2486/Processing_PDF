import { FilePlus2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { DropZone, FileTrigger } from "react-aria-components";

import { cn } from "../lib/cn";
import { Button } from "./Button";

export interface FileDropzoneProps {
  accept: readonly string[];
  onFiles: (files: File[]) => void | Promise<void>;
  onError?: (message: string) => void;
  multiple?: boolean;
  disabled?: boolean;
  camera?: "user" | "environment";
  title?: string;
  description?: string;
  buttonLabel?: string;
  className?: string;
}

export function FileDropzone({
  accept,
  onFiles,
  onError,
  multiple = false,
  disabled = false,
  camera,
  title = "Thả tệp vào đây",
  description = "Tệp chỉ được xử lý trong trình duyệt của bạn.",
  buttonLabel = "Chọn tệp",
  className,
}: FileDropzoneProps) {
  const [isReadingDrop, setIsReadingDrop] = useState(false);
  const readingRef = useRef(false);
  const isDisabled = disabled || isReadingDrop;

  const beginReading = () => {
    if (disabled || readingRef.current) return false;
    readingRef.current = true;
    setIsReadingDrop(true);
    return true;
  };

  const finishReading = () => {
    readingRef.current = false;
    setIsReadingDrop(false);
  };

  const dispatchFiles = (files: File[]) =>
    onFiles(multiple ? files : files.slice(0, 1));

  const submitFiles = async (files: File[]) => {
    if (files.length === 0 || !beginReading()) return;
    try {
      await dispatchFiles(files);
    } catch {
      onError?.("Không thể đọc tệp đã chọn. Vui lòng thử lại.");
    } finally {
      finishReading();
    }
  };

  return (
    <DropZone
      aria-label={title}
      isDisabled={isDisabled}
      getDropOperation={() => (isDisabled ? "cancel" : "copy")}
      onDrop={async (event) => {
        if (!beginReading()) return;
        try {
          const files = await Promise.all(
            event.items
              .filter((item) => item.kind === "file")
              .map((item) => item.getFile()),
          );
          if (files.length > 0) await dispatchFiles(files);
        } catch {
          onError?.("Không thể đọc tệp được thả. Vui lòng thử lại.");
        } finally {
          finishReading();
        }
      }}
      className={({ isDropTarget, isFocusVisible }) =>
        cn(
          "flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-6 py-10 text-center",
          isDropTarget
            ? "border-brand-500 bg-brand-50"
            : "border-slate-300",
          isFocusVisible && "ring-2 ring-brand-500 ring-offset-2",
          isDisabled && "cursor-not-allowed opacity-60",
          className,
        )
      }
    >
      <div
        className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"
        aria-hidden="true"
      >
        {camera ? <FilePlus2 className="size-7" /> : <UploadCloud className="size-7" />}
      </div>
      <h2 className="mt-4 text-balance text-lg font-bold text-slate-950">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-pretty text-sm leading-6 text-slate-600">
        {description}
      </p>
      <FileTrigger
        acceptedFileTypes={accept}
        allowsMultiple={multiple}
        defaultCamera={camera}
        onSelect={(fileList) => {
          void submitFiles(fileList ? Array.from(fileList) : []);
        }}
      >
        <Button
          variant="primary"
          className="mt-5"
          isDisabled={isDisabled}
        >
          {isReadingDrop ? "Đang đọc tệp…" : buttonLabel}
        </Button>
      </FileTrigger>
      <p className="mt-3 text-pretty text-xs text-slate-500">
        Bạn cũng có thể kéo và thả tệp vào vùng này.
      </p>
    </DropZone>
  );
}
