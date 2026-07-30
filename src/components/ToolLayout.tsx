import { ArrowLeft, Info, ShieldCheck } from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "../lib/cn";
import { ResetButton } from "./Feedback";

export interface ToolLayoutProps {
  title: string;
  description: string;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  onReset?: () => void;
  hasChanges?: boolean;
  notice?: ReactNode;
  className?: string;
}

export function ToolLayout({
  title,
  description,
  icon,
  children,
  actions,
  onReset,
  hasChanges = false,
  notice,
  className,
}: ToolLayoutProps) {
  const hasCustomNotice = notice !== undefined && typeof notice !== "string";

  return (
    <section className={cn("mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8", className)}>
      <a
        href="#/"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Tất cả công cụ
      </a>

      <header className="mt-5 flex flex-col gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {icon ? (
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"
              aria-hidden="true"
            >
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-balance text-3xl font-bold text-slate-950 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-pretty leading-7 text-slate-600">
              {description}
            </p>
          </div>
        </div>
        {actions || (onReset && hasChanges) ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
            {onReset && hasChanges ? <ResetButton onReset={onReset} /> : null}
          </div>
        ) : null}
      </header>

      {hasCustomNotice ? (
        <div className="mt-5">{notice}</div>
      ) : (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {notice ? (
            <Info
              className="mt-0.5 size-4 shrink-0 text-brand-700"
              aria-hidden="true"
            />
          ) : (
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0 text-brand-700"
              aria-hidden="true"
            />
          )}
          <p className="text-pretty">
            {notice ??
              "Xử lý hoàn toàn trên thiết bị. Tệp không được tải lên máy chủ."}
          </p>
        </div>
      )}
      <div className="mt-7">{children}</div>
    </section>
  );
}
