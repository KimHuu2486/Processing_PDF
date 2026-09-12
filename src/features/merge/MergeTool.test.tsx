import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LARGE_FILE_BYTES } from "../../pdf";
import { MergeTool } from "./MergeTool";

const mocks = vi.hoisted(() => ({
  selectPdf: vi.fn(),
}));

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

vi.mock("../shared/toolUtils", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../shared/toolUtils")>();
  return {
    ...original,
    selectPdf: mocks.selectPdf,
  };
});

vi.mock("../shared/PdfFileThumbnail", () => ({
  PdfFileThumbnail: ({ label }: { label: string }) => (
    <div aria-label={label}>thumbnail</div>
  ),
}));

describe("MergeTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectPdf.mockImplementation(async (file: File) => ({
      file,
      pageCount: 1,
    }));
  });

  it("asks before parsing cumulative input over 50 MiB", async () => {
    const user = userEvent.setup();
    const { container } = render(<MergeTool />);
    const file = new File(["pdf"], "rat-lon.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "size", {
      configurable: true,
      value: LARGE_FILE_BYTES + 1,
    });

    await user.upload(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      file,
    );

    expect(mocks.selectPdf).not.toHaveBeenCalled();
    expect(
      screen.getByRole("alertdialog", {
        name: "Tệp lớn có thể làm trình duyệt chậm",
      }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Vẫn tiếp tục" }),
    );
    await waitFor(() => expect(mocks.selectPdf).toHaveBeenCalledWith(file, expect.any(AbortSignal)));
  });

  it("parses multiple PDFs sequentially to limit peak memory", async () => {
    const user = userEvent.setup();
    let active = 0;
    let peak = 0;
    mocks.selectPdf.mockImplementation(async (file: File) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { file, pageCount: 1 };
    });
    const { container } = render(<MergeTool />);
    const files = [
      new File(["a"], "a.pdf", { type: "application/pdf" }),
      new File(["b"], "b.pdf", { type: "application/pdf" }),
    ];

    await user.upload(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      files,
    );

    await screen.findByText(/2 file · 2 trang/);
    expect(peak).toBe(1);
  });

  it("adds valid siblings and names the rejected PDF in a mixed batch", async () => {
    mocks.selectPdf.mockImplementation(async (file: File) => {
      if (file.name === "broken.pdf") throw new Error("PDF hỏng");
      return { file, pageCount: 1 };
    });
    const user = userEvent.setup();
    const { container } = render(<MergeTool />);
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, [
      new File(["a"], "a.pdf", { type: "application/pdf" }),
      new File(["bad"], "broken.pdf", { type: "application/pdf" }),
      new File(["b"], "b.pdf", { type: "application/pdf" }),
    ]);
    expect(await screen.findByText(/2 file · 2 trang/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("broken.pdf");
    expect(screen.getByRole("button", { name: "Gộp PDF" })).toBeEnabled();
  });
});
