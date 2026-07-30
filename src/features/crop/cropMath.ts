import type { CropMargins } from "../../pdf";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function clampCropMargins(
  crop: CropMargins,
  minimumWidth: number,
  minimumHeight: number,
): CropMargins {
  // Keep a microscopic safety margin so floating-point subtraction cannot
  // produce a retained box just below the required physical dimensions.
  const safeMinimumWidth = Math.min(1, Math.max(0, minimumWidth) + 1e-12);
  const safeMinimumHeight = Math.min(1, Math.max(0, minimumHeight) + 1e-12);
  const left = clamp(
    crop.left,
    0,
    Math.max(0, 1 - crop.right - safeMinimumWidth),
  );
  const right = clamp(
    crop.right,
    0,
    Math.max(0, 1 - left - safeMinimumWidth),
  );
  const top = clamp(
    crop.top,
    0,
    Math.max(0, 1 - crop.bottom - safeMinimumHeight),
  );
  const bottom = clamp(
    crop.bottom,
    0,
    Math.max(0, 1 - top - safeMinimumHeight),
  );
  return { left, top, right, bottom };
}

export function clampNumber(
  value: number,
  minimum: number,
  maximum: number,
) {
  return clamp(value, minimum, maximum);
}
