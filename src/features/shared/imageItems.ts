import {
  LARGE_FILE_BYTES,
  LARGE_PAGE_COUNT,
  type PageRotation,
} from "../../pdf";

export type SelectedImage = {
  id: string;
  file: File;
  previewUrl: string;
  rotation: PageRotation;
};

function isSupportedImage(file: File) {
  return (
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    /\.(?:jpe?g|png)$/i.test(file.name)
  );
}

export function createSelectedImages(files: readonly File[]): SelectedImage[] {
  const unsupported = files.find((file) => !isSupportedImage(file));
  if (unsupported) {
    throw new Error(`“${unsupported.name}” không phải ảnh JPG hoặc PNG.`);
  }

  return files.map((file) => ({
    id: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(file),
    rotation: 0,
  }));
}

export function releaseSelectedImage(image: SelectedImage) {
  URL.revokeObjectURL(image.previewUrl);
}

export function shouldWarnImageCollection(
  images: ReadonlyArray<Pick<SelectedImage, "file">>,
) {
  const totalBytes = images.reduce(
    (total, image) => total + image.file.size,
    0,
  );
  return (
    totalBytes > LARGE_FILE_BYTES ||
    images.length > LARGE_PAGE_COUNT
  );
}

export function rotateImage(
  image: SelectedImage,
  direction: 90 | -90 = 90,
): SelectedImage {
  const rotation = ((image.rotation + direction + 360) % 360) as PageRotation;
  return { ...image, rotation };
}
