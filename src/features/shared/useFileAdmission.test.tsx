import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useFileAdmission } from "./useFileAdmission";

type Item = { file: File; pageCount: number };
const file = (name: string) => new File(["data"], name);

describe("file admission", () => {
  it("keeps valid files in order when a middle file fails", async () => {
    let accepted: Item[] = [];
    const { result } = renderHook(() => useFileAdmission({
      kind: "pdf",
      parse: async (input: File) => {
        if (input.name === "bad.pdf") throw new Error("Unreadable PDF");
        return { file: input, pageCount: 1 };
      },
      onAccepted: (items) => { accepted = items; },
    }));
    await act(() => result.current.addFiles([file("a.pdf"), file("bad.pdf"), file("b.pdf")]));
    expect(accepted.map((item) => item.file.name)).toEqual(["a.pdf", "b.pdf"]);
    expect(result.current.errors).toEqual([{ name: "bad.pdf", message: "Unreadable PDF" }]);
    expect(result.current.isBusy).toBe(false);
  });

  it("aborts reading and releases late results instead of adding them", async () => {
    let finish!: (item: Item) => void;
    let signal!: AbortSignal;
    const accepted: Item[] = [];
    const released: string[] = [];
    const { result } = renderHook(() => useFileAdmission({
      kind: "image",
      parse: (_input: File, currentSignal: AbortSignal) => {
        signal = currentSignal;
        return new Promise<Item>((resolve) => { finish = resolve; });
      },
      release: (item) => { released.push(item.file.name); },
      onAccepted: (items) => { accepted.push(...items); },
    }));
    let reading!: Promise<void>;
    act(() => { reading = result.current.addFiles([file("a.png"), file("b.png")]); });
    act(() => result.current.cancel());
    expect(signal.aborted).toBe(true);
    await act(async () => { finish({ file: file("a.png"), pageCount: 1 }); await reading; });
    expect(accepted).toEqual([]);
    expect(released).toEqual(["a.png"]);
    expect(result.current.isBusy).toBe(false);
    expect(result.current.errors).toEqual([]);
  });

  it("asks before reading large bytes and disposes parsed files when page confirmation is cancelled", async () => {
    let reads = 0;
    const accepted: Item[] = [];
    const released: string[] = [];
    const input = file("large.pdf");
    Object.defineProperty(input, "size", { value: 51 * 1024 * 1024 });
    const { result } = renderHook(() => useFileAdmission({
      kind: "pdf",
      parse: async (file: File) => { reads++; return { file, pageCount: 201 }; },
      release: (item) => { released.push(item.file.name); },
      onAccepted: (items) => { accepted.push(...items); },
    }));
    await act(() => result.current.addFiles([input]));
    expect(reads).toBe(0);
    expect(result.current.warning?.totalBytes).toBe(51 * 1024 * 1024);
    await act(() => result.current.continueReading());
    expect(reads).toBe(1);
    expect(result.current.warning?.totalPages).toBe(201);
    act(() => result.current.cancel());
    expect(accepted).toEqual([]);
    expect(released).toEqual(["large.pdf"]);
  });

  it("releases a pending image selection on unmount", async () => {
    const released: string[] = [];
    const { result, unmount } = renderHook(() => useFileAdmission({
      kind: "pdf",
      parse: async (file: File) => ({ file, pageCount: 201 }),
      release: (item) => { released.push(item.file.name); },
      onAccepted: () => { throw new Error("Must not accept before confirmation"); },
    }));
    await act(() => result.current.addFiles([file("many.pdf")]));
    unmount();
    expect(released).toEqual(["many.pdf"]);
  });

  it("settles the dropzone callback on cancel even if its parser is still waiting", async () => {
    const { result } = renderHook(() => useFileAdmission({
      kind: "pdf",
      parse: () => new Promise<Item>(() => {}),
      onAccepted: () => { throw new Error("Unexpected acceptance"); },
    }));
    let reading!: Promise<void>;
    act(() => { reading = result.current.addFiles([file("waiting.pdf")]); });
    act(() => result.current.cancel());
    await reading;
    expect(result.current.isBusy).toBe(false);
  });

  it("disposes superseded results without replacing a newer accepted selection", async () => {
    let finish!: (item: Item) => void;
    const accepted: string[] = [];
    const released: string[] = [];
    const { result } = renderHook(() => useFileAdmission({
      kind: "image",
      parse: (input: File) => input.name === "old.png"
        ? new Promise<Item>((resolve) => { finish = resolve; })
        : Promise.resolve({ file: input, pageCount: 1 }),
      release: (item) => { released.push(item.file.name); },
      onAccepted: (items) => { accepted.push(...items.map((item) => item.file.name)); },
    }));
    let old!: Promise<void>;
    act(() => { old = result.current.addFiles([file("old.png")]); });
    await act(() => result.current.addFiles([file("new.png")]));
    await act(async () => { finish({ file: file("old.png"), pageCount: 1 }); await old; });
    expect(accepted).toEqual(["new.png"]);
    expect(released).toEqual(["old.png"]);
    expect(result.current.isBusy).toBe(false);
  });

  it("includes existing images in the warning without discarding them on cancel", async () => {
    const existing = Array.from({ length: 200 }, (_, index) => ({ file: file(`${index}.png`), pageCount: 1 }));
    const { result } = renderHook(() => useFileAdmission({
      kind: "image", existing,
      parse: async (input: File) => ({ file: input, pageCount: 1 }),
      release: () => { throw new Error("Existing selections belong to the feature"); },
      onAccepted: () => { throw new Error("User has not confirmed"); },
    }));
    await act(() => result.current.addFiles([file("new.png")]));
    expect(result.current.warning?.totalPages).toBe(201);
    act(() => result.current.cancel());
    expect(existing).toHaveLength(200);
  });
});
