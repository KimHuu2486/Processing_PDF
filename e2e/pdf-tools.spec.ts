import AxeBuilder from "@axe-core/playwright";
import { PDFDocument } from "pdf-lib";
import {
  expect,
  test,
  type Download,
  type Page,
} from "@playwright/test";

import { makePdf, makePng } from "./fixtures";

type UploadFile = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

function pdfFile(name: string, buffer: Buffer): UploadFile {
  return { name, mimeType: "application/pdf", buffer };
}

function pngFile(name: string, buffer = makePng()): UploadFile {
  return { name, mimeType: "image/png", buffer };
}

function jpegFile(name: string, buffer: Buffer): UploadFile {
  return { name, mimeType: "image/jpeg", buffer };
}

async function openTool(page: Page, route: string, title: string) {
  await page.goto(`/processing-pdf/#/${route}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

async function upload(page: Page, files: UploadFile | UploadFile[]) {
  await page.locator('input[type="file"]').first().setInputFiles(files);
}

async function expectPdfDownload(
  page: Page,
): Promise<{ download: Download; bytes: Buffer }> {
  const link = page.getByRole("link", { name: "Tải PDF xuống" });
  await expect(link).toBeVisible({ timeout: 20_000 });
  const downloadPromise = page.waitForEvent("download");
  await link.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  if (stream) {
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  }
  const bytes = Buffer.concat(chunks);
  expect(bytes.subarray(0, 4).toString("ascii")).toBe("%PDF");
  return { download, bytes };
}

test("trang chủ hiển thị đủ công cụ và không có lỗi accessibility tự động", async ({
  page,
}) => {
  await page.goto("/processing-pdf/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Mọi công cụ PDF bạn cần, chạy ngay trên thiết bị",
    }),
  ).toBeVisible();
  await expect(page.getByText("7 công cụ")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("gộp PDF theo đúng thứ tự đã chọn", async ({ page }) => {
  await openTool(page, "merge", "Gộp PDF");
  await upload(page, [
    pdfFile("trung-ten.pdf", await makePdf(1)),
    pdfFile("trung-ten.pdf", await makePdf(2)),
  ]);
  await expect(page.getByText(/2 file · 3 trang/)).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "Gộp PDF" }).click();
  const { bytes } = await expectPdfDownload(page);
  const output = await PDFDocument.load(bytes);
  expect(output.getPages().map((pdfPage) => pdfPage.getSize())).toEqual([
    { width: 420, height: 595 },
    { width: 420, height: 595 },
    { width: 430, height: 605 },
  ]);
  await expect(
    page.getByRole("button", { name: "Chọn tệp" }),
  ).toBeDisabled();
});

test("tên, metadata và bytes tài liệu không rời trình duyệt khi offline", async ({
  context,
  page,
}) => {
  test.skip(
    test.info().project.name !== "chromium",
    "Một phép chứng minh offline trên Chromium là đủ; các engine khác vẫn chạy toàn bộ happy path.",
  );
  await openTool(page, "merge", "Gộp PDF");
  await page.waitForLoadState("networkidle");
  const requestsAfterOffline: string[] = [];
  page.on("request", (request) => {
    requestsAfterOffline.push(
      `${request.method()} ${request.url()} ${request.postData() ?? ""}`,
    );
  });
  await context.setOffline(true);
  await upload(page, [
    pdfFile("noi-bo-a.pdf", await makePdf(1)),
    pdfFile("noi-bo-b.pdf", await makePdf(1)),
  ]);
  await expect(page.getByText(/2 file · 2 trang/)).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator("canvas").first()).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Gộp PDF" }).click();
  const { bytes } = await expectPdfDownload(page);
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  expect(requestsAfterOffline).toEqual([]);
});

test("tách khoảng trang theo chỉ số 1-based và inclusive", async ({ page }) => {
  await openTool(page, "split", "Tách PDF");
  await upload(page, pdfFile("nguon.pdf", await makePdf(4)));
  await expect(page.getByText(/4 trang/)).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("spinbutton", { name: "Trang bắt đầu" }).fill("2");
  await page.getByRole("spinbutton", { name: "Trang kết thúc" }).fill("3");
  await page.getByRole("button", { name: "Tách khoảng trang" }).click();
  const { bytes } = await expectPdfDownload(page);
  const output = await PDFDocument.load(bytes);
  expect(output.getPages().map((pdfPage) => pdfPage.getSize())).toEqual([
    { width: 430, height: 605 },
    { width: 440, height: 615 },
  ]);
});

test("từ chối PDF hỏng và giữ người dùng tại công cụ", async ({ page }) => {
  await openTool(page, "split", "Tách PDF");
  await upload(
    page,
    pdfFile("hong.pdf", Buffer.from("%PDF-1.7\nnot-a-valid-document")),
  );
  await expect(page.getByRole("alert")).toContainText(
    "PDF có thể bị hỏng hoặc có mật khẩu",
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Tách PDF" }),
  ).toBeVisible();
});

test("sắp xếp hỗ trợ xoay, xóa và nút di chuyển thay cho kéo thả", async ({
  page,
}) => {
  await openTool(page, "organize", "Sắp xếp PDF");
  await upload(page, pdfFile("sap-xep.pdf", await makePdf(3)));
  await expect(
    page.getByRole("button", { name: "Xoay trang 1 sang phải" }),
  ).toBeVisible({ timeout: 20_000 });
  await page
    .getByRole("button", { name: "Di chuyển trang gốc 2 về trước" })
    .click();
  await page.getByRole("button", { name: "Xoay trang 1 sang phải" }).click();
  await page.getByRole("button", { name: "Xóa trang 3" }).click();
  await page
    .getByRole("button", { name: "Tạo PDF đã sắp xếp" })
    .click();
  const { bytes } = await expectPdfDownload(page);
  const output = await PDFDocument.load(bytes);
  expect(output.getPages().map((pdfPage) => pdfPage.getSize())).toEqual([
    { width: 430, height: 605 },
    { width: 420, height: 595 },
  ]);
  expect(
    output.getPages().map((pdfPage) => pdfPage.getRotation().angle),
  ).toEqual([0, 90]);
});

test("đánh số trang với phạm vi và vị trí tùy chọn", async ({ page }) => {
  await openTool(page, "page-numbers", "Đánh số trang");
  await upload(page, pdfFile("danh-so.pdf", await makePdf(3)));
  await expect(page.getByText(/3 trang/)).toBeVisible();
  await page.getByRole("spinbutton", { name: "Từ trang" }).fill("2");
  await page.getByRole("spinbutton", { name: "Đến trang" }).fill("3");
  await page.getByRole("spinbutton", { name: "Số bắt đầu" }).fill("7");
  await page
    .getByRole("combobox", { name: "Vị trí" })
    .selectOption("top-right");
  await page.getByRole("button", { name: "Thêm số trang" }).click();
  const { bytes } = await expectPdfDownload(page);
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
});

test("chuyển JPG và PNG alpha thành PDF", async ({ page }) => {
  await openTool(page, "images-to-pdf", "Ảnh sang PDF");
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const browserJpeg = await page.screenshot({ type: "jpeg", quality: 70 });
  await upload(page, [
    pngFile("doc.png", makePng(8, 12, true)),
    jpegFile("anh-chup.jpg", browserJpeg),
  ]);
  await expect(page.getByText(/2 ảnh/)).toBeVisible();
  await page.getByRole("button", { name: "Xoay doc.png sang phải" }).click();
  await page.getByRole("button", { name: "Tạo PDF từ ảnh" }).click();
  const { bytes } = await expectPdfDownload(page);
  const output = await PDFDocument.load(bytes);
  expect(output.getPageCount()).toBe(2);
  const jpegPageSize =
    viewport && viewport.width > viewport.height
      ? { width: 841.89, height: 595.28 }
      : { width: 595.28, height: 841.89 };
  expect(output.getPages().map((pdfPage) => pdfPage.getSize())).toEqual([
    { width: 841.89, height: 595.28 },
    jpegPageSize,
  ]);
});

test("scan dùng ảnh fallback và tạo PDF không OCR", async ({ page }) => {
  await openTool(page, "scan-to-pdf", "Quét ảnh thành PDF");
  await upload(page, pngFile("scan.png"));
  await expect(page.getByText(/1 ảnh/)).toBeVisible();
  await page.getByRole("button", { name: "Tạo PDF bản quét" }).click();
  const { bytes } = await expectPdfDownload(page);
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
});

test("scan báo lỗi quyền camera nhưng vẫn giữ lựa chọn ảnh fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(new DOMException("Denied", "NotAllowedError")),
      },
    });
  });
  await openTool(page, "scan-to-pdf", "Quét ảnh thành PDF");
  await page.getByRole("button", { name: "Mở camera" }).click();
  await expect(
    page.getByText(
      "Quyền camera bị từ chối. Bạn vẫn có thể chọn ảnh từ thiết bị.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Chọn ảnh", exact: true }),
  ).toBeVisible();
});

test("scan gắn camera mock, chụp ảnh và dừng track khi rời route", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let stopped = false;
    Object.defineProperty(window, "__cameraStopped", {
      configurable: true,
      get: () => stopped,
    });
    const track = {
      stop: () => {
        stopped = true;
      },
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.resolve(
            { getTracks: () => [track] } as unknown as MediaStream,
          ),
      },
    });
    Object.defineProperty(HTMLVideoElement.prototype, "srcObject", {
      configurable: true,
      get(this: HTMLVideoElement) {
        return (this as HTMLVideoElement & { __stream?: MediaStream }).__stream;
      },
      set(this: HTMLVideoElement, value: MediaStream | null) {
        (this as HTMLVideoElement & { __stream?: MediaStream | null }).__stream =
          value;
      },
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
      configurable: true,
      get: () => 320,
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
      configurable: true,
      get: () => 240,
    });
    HTMLVideoElement.prototype.play = () => Promise.resolve();
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      options?: unknown,
    ) {
      const context = originalGetContext.call(
        this,
        contextId as "2d",
        options as CanvasRenderingContext2DSettings,
      );
      if (context && "drawImage" in context) {
        context.drawImage = () => undefined;
      }
      return context;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  await openTool(page, "scan-to-pdf", "Quét ảnh thành PDF");
  await page.getByRole("button", { name: "Mở camera" }).click();
  await expect(
    page.getByLabel("Hình ảnh trực tiếp từ camera"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Chụp trang" }).click();
  await expect(page.getByText(/1 ảnh/)).toBeVisible();
  await page.goto("/processing-pdf/#/");
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__cameraStopped)))
    .toBe(true);
});

test("crop áp dụng cùng tỷ lệ cho toàn bộ trang và luôn cảnh báo redaction", async ({
  page,
}) => {
  await openTool(page, "crop", "Cắt lề PDF");
  await expect(page.getByText("Crop không phải redaction.")).toBeVisible();
  await upload(page, pdfFile("crop.pdf", await makePdf(3)));
  await expect(page.getByText("1/3")).toBeVisible();
  await page.getByRole("spinbutton", { name: "Trên" }).fill("5");
  await page
    .getByRole("radio", { name: "Tất cả 3 trang theo cùng tỷ lệ" })
    .check();
  await page.getByRole("button", { name: "Áp dụng CropBox" }).click();
  const { bytes } = await expectPdfDownload(page);
  const output = await PDFDocument.load(bytes);
  expect(output.getPageCount()).toBe(3);
  output.getPages().forEach((pdfPage, index) => {
    const originalHeight = 595 + index * 10;
    expect(pdfPage.getMediaBox()).toEqual({
      x: 0,
      y: 0,
      width: 420 + index * 10,
      height: originalHeight,
    });
    expect(pdfPage.getCropBox().height).toBeCloseTo(originalHeight * 0.95);
  });
});

declare global {
  interface Window {
    __cameraStopped?: boolean;
  }
}
