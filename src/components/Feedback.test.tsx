import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProcessingProgress, ResetButton } from "./Feedback";

describe("ProcessingProgress", () => {
  it("giới hạn và hiển thị phần trăm theo dạng tabular", () => {
    render(<ProcessingProgress label="Đang gộp" value={120} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});

describe("ResetButton", () => {
  it("yêu cầu xác nhận trước khi xóa phiên", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<ResetButton onReset={onReset} />);

    await user.click(screen.getByRole("button", { name: "Làm lại" }));
    expect(
      screen.getByRole("alertdialog", { name: "Bắt đầu lại?" }),
    ).toBeInTheDocument();
    expect(onReset).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Bắt đầu lại" }),
    );
    expect(onReset).toHaveBeenCalledOnce();
  });
});
