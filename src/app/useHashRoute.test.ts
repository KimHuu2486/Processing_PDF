import { describe, expect, it } from "vitest";

import { normalizePath } from "./useHashRoute";

describe("normalizePath", () => {
  it.each([
    ["", "/"],
    ["#", "/"],
    ["#/", "/"],
    ["#/merge", "/merge"],
    ["#merge", "/merge"],
    ["#/crop/", "/crop"],
    ["#/split?source=home", "/split"],
  ])("chuẩn hóa %s thành %s", (hash, expected) => {
    expect(normalizePath(hash)).toBe(expected);
  });
});
