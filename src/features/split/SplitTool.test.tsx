import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LARGE_FILE_BYTES } from "../../pdf";
import { SplitTool } from "./SplitTool";

const mocks = vi.hoisted(() => ({
  run: vi.fn(async (job: unknown) => {
    void job;
  }),
  reset: vi.fn(),
  cancel: vi.fn(),
  dismissError: vi.fn(),
  selectPdf: vi.fn(),
  toPdfInput: vi.fn(),
}));

vi.mock("../shared/usePdfJob", () => ({
  usePdfJob: () => ({
    status: "idle",
    progress: 0,
    message: "",
    error: null,
    resultUrl: null,
    resultSize: null,
    run: mocks.run,
    reset: mocks.reset,
    cancel: mocks.cancel,
    dismissError: mocks.dismissError,
  }),
}));

vi.mock("../shared/toolUtils", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../shared/toolUtils")>();
  return {
    ...original,
    selectPdf: mocks.selectPdf,
    toPdfInput: mocks.toPdfInput,
    makeJobId: () => "split-test",
  };
});

describe("SplitTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectPdf.mockResolvedValue({
      file: new File(["pdf"], "bao-cao.pdf", { type: "application/pdf" }),
      pageCount: 5,
    });
    mocks.toPdfInput.mockResolvedValue({
      id: "source",
      name: "bao-cao.pdf",
      bytes: new ArrayBuffer(3),
    });
  });

  it("uploads a PDF and creates an inclusive page-range job", async () => {
    const user = userEvent.setup();
    const { container } = render(<SplitTool />);
    const file = new File(["pdf"], "bao-cao.pdf", {
      type: "application/pdf",
    });
    const input = container.querySelector('input[type="file"]');

    await user.upload(input as HTMLInputElement, file);
    await screen.findByText("5 trang · 3 B");

    const start = screen.getByRole("spinbutton", { name: "Trang bắt đầu" });
    const end = screen.getByRole("spinbutton", { name: "Trang kết thúc" });
    await user.clear(start);
    await user.type(start, "2");
    await user.clear(end);
    await user.type(end, "4");
    expect(
      screen.getByRole("textbox", { name: "Tên file kết quả" }),
    ).toHaveValue("bao-cao_pages_2-4.pdf");
    await user.click(
      screen.getByRole("button", { name: "Tách khoảng trang" }),
    );

    await waitFor(() => expect(mocks.run).toHaveBeenCalledOnce());
    const factory = mocks.run.mock.calls[0]?.[0] as () => Promise<unknown>;
    await expect(factory()).resolves.toEqual(
      expect.objectContaining({
        id: "split-test",
        type: "split",
        range: { start: 2, end: 4 },
      }),
    );
  });

  it("shows inline validation and keeps inputs when the range is invalid", async () => {
    const user = userEvent.setup();
    const { container } = render(<SplitTool />);
    const input = container.querySelector('input[type="file"]');
    await user.upload(
      input as HTMLInputElement,
      new File(["pdf"], "bao-cao.pdf", { type: "application/pdf" }),
    );
    await screen.findByText("5 trang · 3 B");

    const start = screen.getByRole("spinbutton", { name: "Trang bắt đầu" });
    const end = screen.getByRole("spinbutton", { name: "Trang kết thúc" });
    await user.clear(start);
    await user.type(start, "5");
    await user.clear(end);
    await user.type(end, "2");
    await user.click(
      screen.getByRole("button", { name: "Tách khoảng trang" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Khoảng trang phải nằm trong 1–5",
    );
    expect(start).toHaveValue(5);
    expect(end).toHaveValue(2);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("asks before parsing a PDF over 50 MiB", async () => {
    const user = userEvent.setup();
    const { container } = render(<SplitTool />);
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
});
