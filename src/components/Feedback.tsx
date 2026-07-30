import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileQuestion,
  RotateCcw,
  X,
} from "lucide-react";
import { useId, type ReactNode } from "react";
import {
  Link,
  ProgressBar,
  type LinkProps,
} from "react-aria-components";

import { cn } from "../lib/cn";
import { Button, IconButton } from "./Button";
import { ConfirmDialog } from "./Dialog";
import { formatBytes } from "./formatBytes";

export interface InlineErrorProps {
  message: ReactNode;
  title?: string;
  onDismiss?: () => void;
  className?: string;
}

export function InlineError({
  message,
  title = "Không thể hoàn tất",
  onDismiss,
  className,
}: InlineErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-950",
        className,
      )}
    >
      <AlertCircle
        className="mt-0.5 size-5 shrink-0 text-red-700"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <div className="mt-1 text-pretty text-sm leading-6 text-red-900">
          {message}
        </div>
      </div>
      {onDismiss ? (
        <IconButton
          variant="ghost"
          className="size-11 shrink-0 text-red-900 hover:bg-red-100"
          aria-label="Đóng thông báo lỗi"
          onPress={onDismiss}
        >
          <X className="size-4" aria-hidden="true" />
        </IconButton>
      ) : null}
    </div>
  );
}

export interface ProcessingProgressProps {
  label?: string;
  value?: number;
  onCancel?: () => void;
  className?: string;
}

export function ProcessingProgress({
  label = "Đang xử lý tệp",
  value,
  onCancel,
  className,
}: ProcessingProgressProps) {
  const safeValue =
    value === undefined ? undefined : Math.min(100, Math.max(0, value));

  return (
    <ProgressBar
      aria-label={label}
      aria-live="polite"
      value={safeValue}
      minValue={0}
      maxValue={100}
      isIndeterminate={safeValue === undefined}
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-pretty text-sm font-semibold text-slate-800">
          {label}
        </span>
        {safeValue === undefined ? (
          <span className="text-sm text-slate-500">Vui lòng chờ…</span>
        ) : (
          <span className="tabular-nums text-sm font-semibold text-slate-700">
            {Math.round(safeValue)}%
          </span>
        )}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn(
            "h-full rounded-full bg-brand-600",
            safeValue === undefined && "w-1/3",
          )}
          style={
            safeValue === undefined ? undefined : { width: `${safeValue}%` }
          }
        />
      </div>
      {onCancel ? (
        <div className="mt-4 flex justify-end">
          <Button size="sm" onPress={onCancel}>
            Hủy xử lý
          </Button>
        </div>
      ) : null}
    </ProgressBar>
  );
}

function DownloadLink({
  className,
  ...props
}: Omit<LinkProps, "className"> & { className?: string }) {
  return (
    <Link
      className={({ isFocusVisible, isDisabled }) =>
        cn(
          "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-brand-600 bg-brand-600 px-5 py-2.5 text-base font-semibold text-white shadow-sm",
          "hover:border-brand-700 hover:bg-brand-700",
          isFocusVisible && "ring-2 ring-brand-500 ring-offset-2 outline-none",
          isDisabled && "cursor-not-allowed opacity-50",
          className,
        )
      }
      {...props}
    />
  );
}

export interface ResultDownloadProps {
  url: string;
  fileName: string;
  fileSize?: number;
  onReset?: () => void;
  className?: string;
}

export function ResultDownload({
  url,
  fileName,
  fileSize,
  onReset,
  className,
}: ResultDownloadProps) {
  const resultTitleId = useId();

  return (
    <section
      aria-labelledby={resultTitleId}
      className={cn(
        "rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6",
        className,
      )}
    >
      <div
        role="status"
        aria-live="polite"
        className="flex items-start gap-3"
      >
        <CheckCircle2
          className="mt-0.5 size-6 shrink-0 text-emerald-700"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2
            id={resultTitleId}
            className="text-balance text-lg font-bold text-emerald-950"
          >
            Tệp của bạn đã sẵn sàng
          </h2>
          <p className="mt-1 truncate text-sm text-emerald-900">
            {fileName}
            {fileSize !== undefined ? ` · ${formatBytes(fileSize)}` : ""}
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <DownloadLink href={url} download={fileName}>
          <Download className="size-5" aria-hidden="true" />
          Tải PDF xuống
        </DownloadLink>
        {onReset ? (
          <Button onPress={onReset}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Xử lý tệp khác
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export interface ResetButtonProps {
  onReset: () => void;
  disabled?: boolean;
  label?: string;
  confirmTitle?: string;
  confirmDescription?: string;
}

export function ResetButton({
  onReset,
  disabled = false,
  label = "Làm lại",
  confirmTitle = "Bắt đầu lại?",
  confirmDescription = "Tệp và mọi thay đổi trong phiên hiện tại sẽ bị xóa khỏi bộ nhớ của trình duyệt.",
}: ResetButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" isDisabled={disabled}>
          <RotateCcw className="size-4" aria-hidden="true" />
          {label}
        </Button>
      }
      title={confirmTitle}
      description={confirmDescription}
      confirmLabel="Bắt đầu lại"
      confirmVariant="danger"
      onConfirm={onReset}
    />
  );
}

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center",
        className,
      )}
    >
      <div
        className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
        aria-hidden="true"
      >
        {icon ?? <FileQuestion className="size-6" />}
      </div>
      <h2 className="mt-4 text-balance text-lg font-bold text-slate-950">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-pretty text-sm leading-6 text-slate-600">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
