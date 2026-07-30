import type { PageRange, ToolId } from "./types";

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function withoutExtension(name: string): string {
  const trimmed = name.trim();
  const lastDot = trimmed.lastIndexOf(".");
  return lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
}

export function sanitizePdfFilename(name: string, fallback = "tai-lieu.pdf"): string {
  const fallbackBase = fallback.replace(/\.pdf$/i, "").trim() || "tai-lieu";
  let base = name
    .trim()
    .replace(/\.pdf$/i, "")
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/g, "")
    .trim();

  if (!base || WINDOWS_RESERVED_NAMES.test(base)) {
    base = fallbackBase;
  }

  base = [...base].slice(0, 116).join("").replace(/[.\s]+$/g, "") || fallbackBase;
  return `${base}.pdf`;
}

export function defaultOutputName(
  tool: ToolId,
  sources: ReadonlyArray<Pick<{ name: string }, "name">>,
  range?: PageRange,
): string {
  const firstBase = sources[0] ? withoutExtension(sources[0].name) : "tai-lieu";

  switch (tool) {
    case "merge":
      return sanitizePdfFilename(`${firstBase}_merged`);
    case "split":
      return sanitizePdfFilename(
        range
          ? `${firstBase}_pages_${range.start}-${range.end}`
          : `${firstBase}_pages`,
      );
    case "organize":
      return sanitizePdfFilename(`${firstBase}_organized`);
    case "page-numbers":
      return sanitizePdfFilename(`${firstBase}_numbered`);
    case "images-to-pdf":
      return sanitizePdfFilename(`${firstBase}_images`);
    case "scan-to-pdf":
      return sanitizePdfFilename(`${firstBase || "scan"}_scan`);
    case "crop":
      return sanitizePdfFilename(`${firstBase}_cropped`);
  }
}
