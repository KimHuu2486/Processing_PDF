import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { imageFile, stubImageDecoder } from "../../test/images";

import { ScanToPdfTool } from "./ScanToPdfTool";

vi.mock("../shared/usePdfJob", () => ({
  usePdfJob: () => ({
    status: "idle",
    progress: 0,
    message: "",
    error: null,
    resultUrl: null,
    resultSize: null,
    run: vi.fn(),
    reset: vi.fn(),
    cancel: vi.fn(),
    dismissError: vi.fn(),
  }),
}));

const originalMediaDevices = navigator.mediaDevices;

describe("ScanToPdfTool", () => {
  beforeEach(stubImageDecoder);
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    });
  });

  it("shows the image fallback when camera permission is denied", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(
      new DOMException("Permission denied", "NotAllowedError"),
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    const user = userEvent.setup();
    const { container } = render(<ScanToPdfTool />);

    await user.click(screen.getByRole("button", { name: "Mở camera" }));

    expect(
      await screen.findByText(
        "Quyền camera bị từ chối. Bạn vẫn có thể chọn ảnh từ thiết bị.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Chọn ảnh" }),
    ).toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).not.toHaveAttribute(
      "capture",
    );
  });

  it("stops a camera stream that resolves after the route unmounts", async () => {
    let resolveStream!: (stream: MediaStream) => void;
    const pendingStream = new Promise<MediaStream>((resolve) => {
      resolveStream = resolve;
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(() => pendingStream) },
    });
    const stop = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(<ScanToPdfTool />);

    await user.click(screen.getByRole("button", { name: "Mở camera" }));
    unmount();
    resolveStream({
      getTracks: () => [{ stop }],
    } as unknown as MediaStream);
    await pendingStream;
    await Promise.resolve();

    expect(stop).toHaveBeenCalledOnce();
  });

  it("clears camera busy state when reset interrupts a pending retake", async () => {
    let resolveStream!: (stream: MediaStream) => void;
    const pendingStream = new Promise<MediaStream>((resolve) => {
      resolveStream = resolve;
    });
    const stop = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(() => pendingStream) },
    });
    const user = userEvent.setup();
    const { container } = render(<ScanToPdfTool />);

    await user.upload(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      imageFile(),
    );
    await user.click(
      await screen.findByRole("button", { name: "Chụp lại" }),
    );
    expect(
      screen.getByRole("button", { name: "Đang mở camera…" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Làm lại" }));
    await user.click(
      screen.getByRole("button", { name: "Bắt đầu lại" }),
    );
    expect(
      screen.getByRole("button", { name: "Mở camera" }),
    ).toBeEnabled();

    resolveStream({
      getTracks: () => [{ stop }],
    } as unknown as MediaStream);
    await pendingStream;
    await Promise.resolve();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("discards an encoded capture that finishes after unmount", async () => {
    const stop = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop }],
        })),
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(
      320,
    );
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(
      240,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    let finishEncoding:
      | BlobCallback
      | undefined;
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => {
        finishEncoding = callback;
      },
    );
    const createUrl = vi.spyOn(URL, "createObjectURL");
    const user = userEvent.setup();
    const { unmount } = render(<ScanToPdfTool />);

    await user.click(screen.getByRole("button", { name: "Mở camera" }));
    await screen.findByLabelText("Hình ảnh trực tiếp từ camera");
    await user.click(screen.getByRole("button", { name: "Chụp trang" }));
    expect(
      screen.getByRole("button", { name: "Đang lưu ảnh…" }),
    ).toBeDisabled();
    unmount();
    finishEncoding?.(new Blob(["jpeg"], { type: "image/jpeg" }));
    await Promise.resolve();

    expect(createUrl).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });
});
