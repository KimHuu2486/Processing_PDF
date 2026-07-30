import { ArrowRight, ShieldCheck } from "lucide-react";

import { toolRoutes } from "./toolRegistry";

export function HomePage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <section className="max-w-4xl">
        <div className="inline-flex min-h-9 items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Riêng tư ngay từ thiết kế
        </div>
        <h1 className="mt-5 text-balance text-4xl font-bold text-slate-950 sm:text-5xl">
          Mọi công cụ PDF bạn cần, chạy ngay trên thiết bị
        </h1>
        <p className="mt-4 max-w-3xl text-pretty text-lg leading-8 text-slate-600">
          Gộp, tách, sắp xếp và chỉnh sửa PDF mà không tải tài liệu lên bất kỳ
          máy chủ nào. Chọn một công cụ để bắt đầu.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="tools-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2
              id="tools-title"
              className="text-balance text-2xl font-bold text-slate-950"
            >
              Công cụ PDF
            </h2>
            <p className="mt-1 text-pretty text-sm text-slate-600">
              Không cần đăng ký, cài đặt hoặc tải tệp lên mạng.
            </p>
          </div>
          <span className="tabular-nums text-sm font-medium text-slate-500">
            {toolRoutes.length} công cụ
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {toolRoutes.map((route) => {
            const Icon = route.icon;
            return (
              <a
                key={route.id}
                href={route.hash}
                className="group flex min-h-56 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-balance text-xl font-bold text-slate-950">
                  {route.title}
                </h3>
                <p className="mt-2 flex-1 text-pretty text-sm leading-6 text-slate-600">
                  {route.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 group-hover:text-brand-800">
                  Mở công cụ
                  <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </a>
            );
          })}
        </div>
      </section>

      <section className="mt-12 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-3 sm:p-8">
        <div>
          <p className="font-bold text-slate-950">Không upload</p>
          <p className="mt-1 text-pretty text-sm leading-6 text-slate-600">
            Tài liệu chỉ tồn tại trong bộ nhớ của tab hiện tại.
          </p>
        </div>
        <div>
          <p className="font-bold text-slate-950">Không tài khoản</p>
          <p className="mt-1 text-pretty text-sm leading-6 text-slate-600">
            Mở công cụ và xử lý ngay, không cần đăng nhập.
          </p>
        </div>
        <div>
          <p className="font-bold text-slate-950">Không phí máy chủ</p>
          <p className="mt-1 text-pretty text-sm leading-6 text-slate-600">
            Ứng dụng tĩnh có thể được triển khai miễn phí trên GitHub Pages.
          </p>
        </div>
      </section>
    </div>
  );
}
