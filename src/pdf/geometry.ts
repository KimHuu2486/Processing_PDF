import type {
  CropMargins,
  PageNumberPosition,
  PageRotation,
} from "./types";
import { PdfToolError } from "./errors";
import { MIN_CROP_SIZE_POINTS, validateCropMargins } from "./validation";

export interface PdfBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageNumberPlacement {
  x: number;
  y: number;
  rotation: PageRotation;
}

export function normalizeRotation(angle: number): PageRotation {
  const normalized = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  return normalized as PageRotation;
}

type PhysicalMargins = CropMargins;

export function visualMarginsToPhysical(
  crop: CropMargins,
  rotation: PageRotation,
): PhysicalMargins {
  validateCropMargins(crop);
  switch (rotation) {
    case 0:
      return { ...crop };
    case 90:
      return {
        left: crop.top,
        top: crop.right,
        right: crop.bottom,
        bottom: crop.left,
      };
    case 180:
      return {
        left: crop.right,
        top: crop.bottom,
        right: crop.left,
        bottom: crop.top,
      };
    case 270:
      return {
        left: crop.bottom,
        top: crop.left,
        right: crop.top,
        bottom: crop.right,
      };
  }
}

export function normalizedCropToBox(
  box: PdfBox,
  crop: CropMargins,
  rotation: PageRotation,
): PdfBox {
  const physical = visualMarginsToPhysical(crop, rotation);
  const next = {
    x: box.x + box.width * physical.left,
    y: box.y + box.height * physical.bottom,
    width: box.width * (1 - physical.left - physical.right),
    height: box.height * (1 - physical.top - physical.bottom),
  };

  if (
    next.width < MIN_CROP_SIZE_POINTS ||
    next.height < MIN_CROP_SIZE_POINTS
  ) {
    throw new PdfToolError("crop-too-small");
  }
  return next;
}

function visualPageSize(box: PdfBox, rotation: PageRotation): {
  width: number;
  height: number;
} {
  return rotation === 90 || rotation === 270
    ? { width: box.height, height: box.width }
    : { width: box.width, height: box.height };
}

function visualToPdfPoint(
  box: PdfBox,
  rotation: PageRotation,
  visualX: number,
  visualY: number,
): { x: number; y: number } {
  switch (rotation) {
    case 0:
      return { x: box.x + visualX, y: box.y + visualY };
    case 90:
      return {
        x: box.x + box.width - visualY,
        y: box.y + visualX,
      };
    case 180:
      return {
        x: box.x + box.width - visualX,
        y: box.y + box.height - visualY,
      };
    case 270:
      return {
        x: box.x + visualY,
        y: box.y + box.height - visualX,
      };
  }
}

export function calculatePageNumberPlacement(
  box: PdfBox,
  rotation: PageRotation,
  position: PageNumberPosition,
  textWidth: number,
  fontSize: number,
  margin: number,
): PageNumberPlacement {
  const visual = visualPageSize(box, rotation);
  const horizontal = position.endsWith("left")
    ? margin
    : position.endsWith("right")
      ? visual.width - margin - textWidth
      : (visual.width - textWidth) / 2;
  const vertical = position.startsWith("top")
    ? visual.height - margin - fontSize
    : margin;
  const point = visualToPdfPoint(box, rotation, horizontal, vertical);

  return { ...point, rotation };
}
