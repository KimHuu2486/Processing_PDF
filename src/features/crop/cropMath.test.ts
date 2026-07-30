import { describe, expect, it } from "vitest";

import { clampCropMargins } from "./cropMath";

describe("clampCropMargins", () => {
  it.each([
    [612, 792],
    [792, 612],
  ])(
    "keeps every margin valid and at least 36pt on a %ix%i page",
    (width, height) => {
      const crop = clampCropMargins(
        { left: 0, top: 0, right: 0.99, bottom: 0.99 },
        36 / width,
        36 / height,
      );

      expect(Object.values(crop).every((value) => value >= 0 && value < 1))
        .toBe(true);
      expect(width * (1 - crop.left - crop.right)).toBeGreaterThanOrEqual(36);
      expect(height * (1 - crop.top - crop.bottom)).toBeGreaterThanOrEqual(36);
    },
  );

  it("resolves opposing oversized margins without producing negatives", () => {
    const crop = clampCropMargins(
      { left: 0.8, top: 0.7, right: 0.8, bottom: 0.7 },
      0.1,
      0.1,
    );

    expect(crop).toEqual({
      left: expect.any(Number),
      top: expect.any(Number),
      right: expect.any(Number),
      bottom: expect.any(Number),
    });
    expect(crop.left).toBeGreaterThanOrEqual(0);
    expect(crop.top).toBeGreaterThanOrEqual(0);
    expect(1 - crop.left - crop.right).toBeGreaterThanOrEqual(0.1);
    expect(1 - crop.top - crop.bottom).toBeGreaterThanOrEqual(0.1);
  });
});
