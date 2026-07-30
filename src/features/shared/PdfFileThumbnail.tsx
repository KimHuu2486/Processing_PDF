import { useEffect, useRef, useState } from "react";

import { LazyPdfPageCanvas } from "./pdfPreview";
import { usePdfDocument } from "./usePdfDocument";

type PdfFileThumbnailProps = {
  file: File;
  label?: string;
  maxWidth?: number;
};

function LoadedPdfFileThumbnail({
  file,
  maxWidth = 220,
}: Pick<PdfFileThumbnailProps, "file" | "maxWidth">) {
  const preview = usePdfDocument(file);

  return (
    <>
      {preview.loading && (
        <p className="text-sm text-slate-500" role="status">
          Đang tạo xem trước…
        </p>
      )}
      {preview.error && (
        <p className="text-pretty text-center text-sm text-slate-500">
          Không thể tạo hình xem trước.
        </p>
      )}
      {preview.document && (
        <LazyPdfPageCanvas
          document={preview.document}
          pageNumber={1}
          maxWidth={maxWidth}
        />
      )}
    </>
  );
}

export function PdfFileThumbnail({
  file,
  label = "Xem trước trang đầu",
  maxWidth = 220,
}: PdfFileThumbnailProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [shouldLoad, setShouldLoad] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    const element = rootRef.current;
    if (!element || shouldLoad || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <figure
      ref={rootRef}
      className="flex min-h-48 items-center justify-center overflow-hidden rounded-lg bg-slate-100 p-2"
    >
      {shouldLoad ? (
        <LoadedPdfFileThumbnail file={file} maxWidth={maxWidth} />
      ) : (
        <p className="text-sm text-slate-500">Xem trước sẽ tải khi cuộn tới…</p>
      )}
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
