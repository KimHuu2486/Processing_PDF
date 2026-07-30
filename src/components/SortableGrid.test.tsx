import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SortableGrid } from "./SortableGrid";

type Item = {
  id: string;
  name: string;
};

const items: Item[] = [
  { id: "one", name: "Trang một" },
  { id: "two", name: "Trang hai" },
  { id: "three", name: "Trang ba" },
];

describe("SortableGrid", () => {
  it("có nút thay thế kéo-thả để sắp xếp bằng bàn phím", async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn();

    render(
      <SortableGrid
        items={items}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        onReorder={onReorder}
        renderItem={(item) => <p>{item.name}</p>}
      />,
    );

    const moveButton = screen.getByRole("button", {
      name: "Di chuyển Trang hai về trước",
    });
    act(() => moveButton.focus());
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(onReorder).toHaveBeenCalledWith([
        items[1],
        items[0],
        items[2],
      ]),
    );
    expect(moveButton).toHaveFocus();
  });

  it("vô hiệu hóa điều khiển khi đang xử lý", () => {
    render(
      <SortableGrid
        items={items}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        onReorder={() => undefined}
        renderItem={(item) => <p>{item.name}</p>}
        disabled
      />,
    );

    expect(
      screen.getByRole("button", { name: "Kéo để sắp xếp Trang một" }),
    ).toBeDisabled();
  });
});
