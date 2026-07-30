import { type PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "../../lib/cn";

type ScheduledRender = {
  cancelled: boolean;
  run: () => Promise<void>;
};

const renderQueue: ScheduledRender[] = [];
let activeRenders = 0;
const MAX_CONCURRENT_RENDERS = 3;
const MAX_PREVIEW_CSS_PIXELS = 2_000_000;
const MAX_PREVIEW_CSS_DIMENSION = 4096;
const MAX_PREVIEW_DEVICE_PIXELS = 4_000_000;

function pumpRenderQueue() {
  while (activeRenders < MAX_CONCURRENT_RENDERS && renderQueue.length > 0) {
    const task = renderQueue.shift();
    if (!task || task.cancelled) continue;
    activeRenders += 1;
    void task
      .run()
      .finally(() => {
        activeRenders -= 1;
        pumpRenderQueue();
      });
  }
}

function scheduleRender(run: () => Promise<void>) {
  const task: ScheduledRender = { cancelled: false, run };
  renderQueue.push(task);
  pumpRenderQueue();
  return () => {
    task.cancelled = true;
    const index = renderQueue.indexOf(task);
    if (index >= 0) renderQueue.splice(index, 1);
  };
}

type PdfPageCanvasProps = {
  document: PDFDocumentProxy;
  pageNumber: number;
  rotation?: number;
  maxWidth?: number;
  className?: string;
  onSize?: (size: { width: number; height: number }) => void;
};

export function PdfPageCanvas({
  document,
  pageNumber,
  rotation = 0,
  maxWidth = 240,
  className,
  onSize,
}: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderError, setRenderError] = useState<{
    document: PDFDocumentProxy;
    pageNumber: number;
    rotation: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null =
      null;
    let loadedPage:
      | Awaited<ReturnType<PDFDocumentProxy["getPage"]>>
      | null = null;
    const canvas = canvasRef.current;

    const cancelScheduled = scheduleRender(async () => {
      try {
        const page = await document.getPage(pageNumber);
        loadedPage = page;
        if (cancelled) return;
        const displayedRotation = page.rotate + rotation;
        const initial = page.getViewport({
          scale: 1,
          rotation: displayedRotation,
        });
        const widthScale = maxWidth / Math.max(initial.width, 1);
        const areaScale = Math.sqrt(
          MAX_PREVIEW_CSS_PIXELS /
            Math.max(initial.width * initial.height, 1),
        );
        const dimensionScale =
          MAX_PREVIEW_CSS_DIMENSION /
          Math.max(initial.width, initial.height, 1);
        const scale = Math.min(widthScale, areaScale, dimensionScale, 1.5);
        const viewport = page.getViewport({
          scale,
          rotation: displayedRotation,
        });
        if (!canvas || cancelled) return;
        const ratio = Math.min(
          window.devicePixelRatio || 1,
          2,
          Math.sqrt(
            MAX_PREVIEW_DEVICE_PIXELS /
              Math.max(viewport.width * viewport.height, 1),
          ),
          MAX_PREVIEW_CSS_DIMENSION /
            Math.max(viewport.width, viewport.height, 1),
        );
        canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
        canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        onSize?.({ width: viewport.width, height: viewport.height });
        const context = canvas.getContext("2d");
        if (!context) return;
        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        await renderTask.promise;
      } catch (renderError: unknown) {
        if (
          !cancelled &&
          !(
            renderError instanceof Error &&
            renderError.name === "RenderingCancelledException"
          )
        ) {
          setRenderError({ document, pageNumber, rotation });
        }
      } finally {
        loadedPage?.cleanup();
        loadedPage = null;
      }
    });

    return () => {
      cancelled = true;
      cancelScheduled();
      renderTask?.cancel();
      if (canvas) {
        canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
        canvas.style.width = "";
        canvas.style.height = "";
      }
      loadedPage?.cleanup();
    };
  }, [document, maxWidth, onSize, pageNumber, rotation]);

  const hasError =
    renderError?.document === document &&
    renderError?.pageNumber === pageNumber &&
    renderError.rotation === rotation;

  if (hasError) {
    return (
      <div className="flex min-h-32 items-center justify-center text-sm text-slate-500">
        Không thể hiển thị trang
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={cn("block max-w-full bg-white shadow-sm", className)}
      aria-label={`Xem trước trang ${pageNumber}`}
    />
  );
}

type LazyPdfPageCanvasProps = PdfPageCanvasProps & {
  placeholderClassName?: string;
};

export function LazyPdfPageCanvas({
  placeholderClassName,
  onSize,
  ...canvasProps
}: LazyPdfPageCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  const [renderedSize, setRenderedSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const handleSize = useCallback(
    (size: { width: number; height: number }) => {
      setRenderedSize(size);
      onSize?.(size);
    },
    [onSize],
  );

  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        setIsVisible(entries.some((entry) => entry.isIntersecting));
      },
      { rootMargin: "240px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex min-h-48 w-full items-center justify-center",
        placeholderClassName,
      )}
      style={
        renderedSize
          ? {
              minHeight: `${Math.ceil(renderedSize.height)}px`,
            }
          : undefined
      }
    >
      {isVisible ? (
        <PdfPageCanvas {...canvasProps} onSize={handleSize} />
      ) : (
        <span className="text-xs text-slate-500">Đang chờ xem trước…</span>
      )}
    </div>
  );
}
