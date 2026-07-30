import { describe, expect, it } from "vitest";

import {
  calculatePageNumberPlacement,
  normalizedCropToBox,
  visualMarginsToPhysical,
} from "./geometry";
import type { PageRotation } from "./types";

describe("visualMarginsToPhysical", () => {
  const visualCrop = { left: 0.1, top: 0.2, right: 0.3, bottom: 0.15 };

  it.each([
    [0, { left: 0.1, top: 0.2, right: 0.3, bottom: 0.15 }],
    [90, { left: 0.2, top: 0.3, right: 0.15, bottom: 0.1 }],
    [180, { left: 0.3, top: 0.15, right: 0.1, bottom: 0.2 }],
    [270, { left: 0.15, top: 0.1, right: 0.2, bottom: 0.3 }],
  ] satisfies Array<[PageRotation, object]>)(
    "maps visual crop for a %i-degree page",
    (rotation, expected) => {
      expect(visualMarginsToPhysical(visualCrop, rotation)).toEqual(expected);
    },
  );

  it("preserves the non-zero CropBox origin", () => {
    const box = normalizedCropToBox(
      { x: 10, y: 20, width: 200, height: 300 },
      visualCrop,
      0,
    );
    expect(box.x).toBeCloseTo(30);
    expect(box.y).toBeCloseTo(65);
    expect(box.width).toBeCloseTo(120);
    expect(box.height).toBeCloseTo(195);
  });

  it("rejects a crop smaller than 36 points", () => {
    expect(() =>
      normalizedCropToBox(
        { x: 0, y: 0, width: 100, height: 100 },
        { left: 0.4, top: 0.4, right: 0.3, bottom: 0.3 },
        0,
      ),
    ).toThrow(/36 pt/);
  });
});

describe("calculatePageNumberPlacement", () => {
  it("centers a bottom number on an unrotated page", () => {
    expect(
      calculatePageNumberPlacement(
        { x: 10, y: 20, width: 200, height: 300 },
        0,
        "bottom-center",
        20,
        12,
        24,
      ),
    ).toEqual({ x: 100, y: 44, rotation: 0 });
  });

  it("maps top-left visual coordinates onto a 90-degree page", () => {
    expect(
      calculatePageNumberPlacement(
        { x: 0, y: 0, width: 200, height: 300 },
        90,
        "top-left",
        20,
        12,
        24,
      ),
    ).toEqual({ x: 36, y: 24, rotation: 90 });
  });
});
