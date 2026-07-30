import { Home, SearchX } from "lucide-react";

export function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[60dvh] max-w-xl flex-col items-center justify-center px-4 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <SearchX className="size-7" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-balance text-3xl font-bold text-slate-950">
        Không tìm thấy công cụ
      </h1>
      <p className="mt-3 text-pretty leading-7 text-slate-600">
        Đường dẫn này không tồn tại hoặc công cụ đã được đổi tên.
      </p>
      <a
        href="#/"
        className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-600 bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        <Home className="size-4" aria-hidden="true" />
        Về trang chủ
      </a>
    </section>
  );
}
