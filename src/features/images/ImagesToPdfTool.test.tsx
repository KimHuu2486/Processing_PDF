import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ImagesToPdfTool } from "./ImagesToPdfTool";

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

function tinyImages(count: number) {
  return Array.from(
    { length: count },
    (_, index) =>
      new File(["x"], `image-${index + 1}.png`, { type: "image/png" }),
  );
}

describe("ImagesToPdfTool large-input admission", () => {
  it("warns at 201 image pages and lets the user cancel or continue", async () => {
    const user = userEvent.setup();
    const { container } = render(<ImagesToPdfTool />);
    const input = container.querySelector('input[type="file"]');

    await user.upload(input as HTMLInputElement, tinyImages(201));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("201 trang");
    await user.click(screen.getByRole("button", { name: "Hủy" }));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/201 ảnh/)).not.toBeInTheDocument();

    await user.upload(input as HTMLInputElement, tinyImages(201));
    await user.click(
      await screen.findByRole("button", { name: "Vẫn tiếp tục" }),
    );
    expect(await screen.findByText(/201 ảnh/)).toBeInTheDocument();
  });
});
