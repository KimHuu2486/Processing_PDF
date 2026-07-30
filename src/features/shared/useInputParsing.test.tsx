import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useInputParsing } from "./useInputParsing";

describe("useInputParsing", () => {
  it("marks a pending result stale after cancellation", async () => {
    let resolve!: (value: string) => void;
    const deferred = new Promise<string>((done) => {
      resolve = done;
    });
    const { result } = renderHook(() => useInputParsing());

    let parsing!: Promise<
      { current: true; value: string } | { current: false }
    >;
    act(() => {
      parsing = result.current.runInputParsing(() => deferred);
    });
    expect(result.current.isParsing).toBe(true);

    act(() => result.current.cancelInputParsing());
    expect(result.current.isParsing).toBe(false);

    resolve("old-result");
    await expect(parsing).resolves.toEqual({ current: false });
  });

  it("only accepts the newest overlapping operation", async () => {
    let resolveFirst!: (value: string) => void;
    let resolveSecond!: (value: string) => void;
    const first = new Promise<string>((done) => {
      resolveFirst = done;
    });
    const second = new Promise<string>((done) => {
      resolveSecond = done;
    });
    const { result } = renderHook(() => useInputParsing());

    let firstRun!: Promise<
      { current: true; value: string } | { current: false }
    >;
    let secondRun!: Promise<
      { current: true; value: string } | { current: false }
    >;
    act(() => {
      firstRun = result.current.runInputParsing(() => first);
      secondRun = result.current.runInputParsing(() => second);
    });

    resolveFirst("first");
    resolveSecond("second");
    await expect(firstRun).resolves.toEqual({ current: false });
    await expect(secondRun).resolves.toEqual({
      current: true,
      value: "second",
    });
  });
});
