import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FileDropzone } from "./FileDropzone";

describe("FileDropzone", () => {
  it("chuyển các tệp đã chọn cho tính năng", async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    const file = new File(["pdf"], "tai-lieu.pdf", {
      type: "application/pdf",
    });
    const { container } = render(
      <FileDropzone
        accept={["application/pdf", ".pdf"]}
        multiple
        onFiles={onFiles}
      />,
    );
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeInstanceOf(HTMLInputElement);

    await user.upload(input as HTMLInputElement, file);

    await waitFor(() => expect(onFiles).toHaveBeenCalledWith([file]));
    expect(
      screen.getByRole("button", { name: "Chọn tệp" }),
    ).toBeInTheDocument();
  });
});
