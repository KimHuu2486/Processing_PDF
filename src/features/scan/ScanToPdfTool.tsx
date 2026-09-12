import { Camera, CameraOff, ScanLine } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Button,
  FileDropzone,
  InlineError,
  ProcessingProgress,
  ResultDownload,
  ToolLayout,
} from "../../components";
import {
  fileToImageInput,
  sanitizePdfFilename,
  type PdfJob,
} from "../../pdf";
import { useFileAdmission } from "../shared/useFileAdmission";
import { FileAdmissionFeedback } from "../shared/FileAdmissionFeedback";
import { ImageGridEditor } from "../shared/ImageGridEditor";
import {
  selectImage,
  releaseSelectedImage,
  rotateImage,
  type SelectedImage,
} from "../shared/imageItems";
import { usePdfJob } from "../shared/usePdfJob";
import { bytesLabel, makeJobId } from "../shared/toolUtils";

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Quyền camera bị từ chối. Bạn vẫn có thể chọn ảnh từ thiết bị.";
    }
    if (error.name === "NotFoundError") {
      return "Không tìm thấy camera. Bạn vẫn có thể chọn ảnh từ thiết bị.";
    }
  }
  return "Không thể mở camera. Hãy kiểm tra quyền truy cập hoặc chọn ảnh từ thiết bị.";
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Không thể tạo ảnh từ camera.")),
      "image/jpeg",
      0.92,
    );
  });
}

export function ScanToPdfTool() {
  const [items, setItems] = useState<SelectedImage[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retakeId, setRetakeId] = useState<string | null>(null);
  const [outputName, setOutputName] = useState("scan.pdf");
  const [inputError, setInputError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const itemsRef = useRef(items);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraGeneration = useRef(0);
  const mountedRef = useRef(true);
  const captureRun = useRef(false);
  const job = usePdfJob();
  const admission = useFileAdmission({
    kind: "image",
    parse: selectImage,
    release: releaseSelectedImage,
    existing: items,
    onAccepted: (added) => setItems((current) => [...current, ...added]),
  });

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !video) return;
    video.srcObject = stream;
    void video.play().catch(() => {
      setCameraError(
        "Camera đã mở nhưng không thể phát hình ảnh. Hãy thử lại hoặc chọn ảnh từ thiết bị.",
      );
    });
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  const stopCamera = useCallback(() => {
    cameraGeneration.current += 1;
    captureRun.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
    setRetakeId(null);
    setCameraBusy(false);
    setCapturing(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cameraGeneration.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      itemsRef.current.forEach(releaseSelectedImage);
    };
  }, []);

  async function startCamera(targetId?: string) {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Trình duyệt này không hỗ trợ camera. Hãy chọn ảnh từ thiết bị.",
      );
      return;
    }
    stopCamera();
    setCameraBusy(true);
    const requestGeneration = cameraGeneration.current;
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      if (
        !mountedRef.current ||
        cameraGeneration.current !== requestGeneration
      ) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = nextStream;
      setStream(nextStream);
      setRetakeId(targetId ?? null);
    } catch (error) {
      if (
        mountedRef.current &&
        cameraGeneration.current === requestGeneration
      ) {
        setCameraError(cameraErrorMessage(error));
      }
    } finally {
      if (
        mountedRef.current &&
        cameraGeneration.current === requestGeneration
      ) {
        setCameraBusy(false);
      }
    }
  }

  async function capture() {
    if (captureRun.current) return;
    const video = videoRef.current;
    if (!video || video.videoWidth < 1 || video.videoHeight < 1) {
      setCameraError("Camera chưa sẵn sàng. Vui lòng chờ một chút rồi thử lại.");
      return;
    }
    captureRun.current = true;
    setCapturing(true);
    const captureGeneration = cameraGeneration.current;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Không thể đọc khung hình camera.");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToJpeg(canvas);
      if (
        !mountedRef.current ||
        cameraGeneration.current !== captureGeneration
      ) {
        return;
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = new File([blob], `scan-${timestamp}.jpg`, {
        type: "image/jpeg",
      });
      const replaced = items.find((item) => item.id === retakeId);
      if (retakeId && !replaced) return;
      await admission.addFiles([file], {
        existing: replaced ? items.filter((item) => item.id !== replaced.id) : items,
        onAccepted: (added) => {
          if (!mountedRef.current || cameraGeneration.current !== captureGeneration) {
            added.forEach(releaseSelectedImage);
            return;
          }
          const captured = added[0];
          if (replaced) {
            releaseSelectedImage(replaced);
            setItems((current) => current.map((item) =>
              item.id === replaced.id ? { ...captured, id: replaced.id } : item,
            ));
          } else {
            setItems((current) => [...current, captured]);
          }
          setRetakeId(null);
          setInputError(null);
        },
      });
    } catch (error) {
      setCameraError(
        error instanceof Error ? error.message : "Không thể chụp ảnh.",
      );
    } finally {
      captureRun.current = false;
      if (
        mountedRef.current &&
        cameraGeneration.current === captureGeneration
      ) {
        setCapturing(false);
      }
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
      setInputError("Hãy chụp hoặc chọn ít nhất một ảnh.");
      return;
    }
    setInputError(null);
    stopCamera();
    try {
      await job.run(async () => {
        const images = await Promise.all(
          items.map((item) =>
            fileToImageInput(item.file, item.id, item.rotation),
          ),
        );
        const pdfJob: PdfJob = {
          id: makeJobId("scan"),
          type: "images-to-pdf",
          images,
          margin: 24,
        };
        return pdfJob;
      });
    } catch (error) {
      setInputError(
        error instanceof Error ? error.message : "Không thể tạo PDF.",
      );
    }
  }

  function resetAll() {
    stopCamera();
    items.forEach(releaseSelectedImage);
    admission.reset();
    setItems([]);
    setCameraError(null);
    setCapturing(false);
    captureRun.current = false;
    setInputError(null);
    setOutputName("scan.pdf");
    job.reset();
  }

  const totalBytes = items.reduce(
    (total, image) => total + image.file.size,
    0,
  );

  return (
    <ToolLayout
      title="Quét ảnh thành PDF"
      description="Chụp nhiều trang bằng camera sau hoặc chọn ảnh có sẵn rồi ghép thành PDF."
      icon={<ScanLine aria-hidden="true" />}
      onReset={resetAll}
      hasChanges={items.length > 0 || stream !== null || admission.isBusy}
      notice="Tính năng này chỉ tạo PDF chứa ảnh, không nhận dạng ký tự (OCR). Camera cần HTTPS và quyền truy cập của bạn."
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Camera tài liệu</h2>
              <p className="mt-1 text-sm text-slate-600">
                Ưu tiên camera sau trên điện thoại.
              </p>
            </div>
            {!stream ? (
              <Button
                variant="primary"
                onPress={() => startCamera()}
                isDisabled={
                  admission.isBusy || cameraBusy ||
                  job.status === "processing" ||
                  job.status === "done"
                }
              >
                <Camera className="size-4" aria-hidden="true" />
                {cameraBusy ? "Đang mở camera…" : "Mở camera"}
              </Button>
            ) : (
              <Button variant="secondary" onPress={() => { admission.cancel(); stopCamera(); }}>
                <CameraOff className="size-4" aria-hidden="true" />
                Tắt camera
              </Button>
            )}
          </div>

          {stream && (
            <div className="mt-4">
              <div className="overflow-hidden rounded-xl bg-slate-950">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="max-h-[65dvh] w-full object-contain"
                  aria-label="Hình ảnh trực tiếp từ camera"
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  onPress={capture}
                  isDisabled={capturing || admission.isBusy}
                >
                  <Camera className="size-5" aria-hidden="true" />
                  {capturing
                    ? "Đang lưu ảnh…"
                    : retakeId
                      ? "Chụp ảnh thay thế"
                      : "Chụp trang"}
                </Button>
                {retakeId && (
                  <Button
                    onPress={() => setRetakeId(null)}
                    variant="ghost"
                    isDisabled={capturing || admission.isBusy}
                  >
                    Hủy chụp lại
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>

        {cameraError && (
          <InlineError
            title="Không thể dùng camera"
            message={cameraError}
            onDismiss={() => setCameraError(null)}
          />
        )}

        <FileDropzone
          accept={["image/jpeg", "image/png", ".jpg", ".jpeg", ".png"]}
          multiple
          disabled={
            admission.isBusy || job.status === "processing" ||
            job.status === "done" ||
            capturing
          }
          title="Hoặc chọn ảnh từ thiết bị"
          description="Dùng khi không có camera, quyền bị từ chối hoặc bạn đã chụp ảnh trước đó."
          buttonLabel="Chọn ảnh"
          onFiles={admission.addFiles}
          onError={setInputError}
          className="min-h-52"
        />

        <FileAdmissionFeedback admission={admission} />

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
              <h2 className="font-semibold text-slate-900">Các trang đã quét</h2>
              <p className="text-sm text-slate-500 tabular-nums">
                {items.length} ảnh · {bytesLabel(totalBytes)}
              </p>
            </div>
            <ImageGridEditor
              items={items}
              onReorder={setItems}
              onRotate={rotate}
              onDelete={remove}
              onRetake={(id) => startCamera(id)}
              label="Các trang quét có thể sắp xếp"
              disabled={
                admission.isBusy || job.status === "processing" || capturing || cameraBusy
              }
            />

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <label
                htmlFor="scan-output-name"
                className="mb-2 block text-sm font-medium text-slate-800"
              >
                Tên file kết quả
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="scan-output-name"
                  value={outputName}
                  onChange={(event) => setOutputName(event.target.value)}
                  className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3"
                />
                <Button
                  variant="primary"
                  onPress={process}
                  isDisabled={admission.isBusy || job.status === "processing"}
                >
                  Tạo PDF bản quét
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
            fileName={sanitizePdfFilename(outputName, "scan.pdf")}
            fileSize={job.resultSize ?? undefined}
            onReset={resetAll}
          />
        )}
      </div>

    </ToolLayout>
  );
}
