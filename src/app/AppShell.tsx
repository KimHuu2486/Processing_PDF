import { FileText, Menu, ShieldCheck } from "lucide-react";
import { type ReactNode } from "react";

import { Button, PrivacyDialog } from "../components";
import { cn } from "../lib/cn";
import { toolRoutes } from "./toolRegistry";

interface AppShellProps {
  currentPath: string;
  children: ReactNode;
}

function NavLink({
  href,
  currentPath,
  path,
  children,
  className,
}: {
  href: string;
  currentPath: string;
  path: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      aria-current={currentPath === path ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        currentPath === path && "bg-brand-50 text-brand-800",
        className,
      )}
    >
      {children}
    </a>
  );
}

function AppHeader({ currentPath }: { currentPath: string }) {
  const primaryRoutes = toolRoutes.slice(0, 4);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <a
          href="#/"
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg pr-2 font-bold text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label="PDF Tools — Trang chủ"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-white">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <span>PDF Tools</span>
        </a>

        <nav
          aria-label="Công cụ chính"
          className="hidden min-w-0 flex-1 items-center gap-1 lg:flex"
        >
          {primaryRoutes.map((route) => (
            <NavLink
              key={route.id}
              href={route.hash}
              path={route.path}
              currentPath={currentPath}
            >
              {route.shortTitle}
            </NavLink>
          ))}
          <NavLink href="#/" path="/" currentPath={currentPath}>
            Tất cả công cụ
          </NavLink>
        </nav>

        <div className="ml-auto hidden sm:block">
          <PrivacyDialog />
        </div>

        <details key={currentPath} className="relative ml-auto lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden">
            <Menu className="size-5" aria-hidden="true" />
            Công cụ
          </summary>
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <nav aria-label="Tất cả công cụ" className="grid gap-1">
              <NavLink href="#/" path="/" currentPath={currentPath}>
                Trang chủ
              </NavLink>
              {toolRoutes.map((route) => (
                <NavLink
                  key={route.id}
                  href={route.hash}
                  path={route.path}
                  currentPath={currentPath}
                >
                  {route.title}
                </NavLink>
              ))}
            </nav>
            <div className="mt-2 border-t border-slate-200 pt-2 sm:hidden">
              <PrivacyDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                  >
                    <ShieldCheck className="size-4" aria-hidden="true" />
                    Quyền riêng tư
                  </Button>
                }
              />
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="text-pretty">
          PDF Tools chạy hoàn toàn trong trình duyệt, không cần máy chủ.
        </p>
        <PrivacyDialog />
      </div>
    </footer>
  );
}

export function AppShell({ currentPath, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-950">
      <a
        href="#/"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
        className="absolute left-4 top-2 z-50 -translate-y-20 rounded-lg bg-white px-4 py-2 font-semibold text-slate-950 shadow-lg focus:translate-y-0"
      >
        Chuyển đến nội dung chính
      </a>
      <AppHeader currentPath={currentPath} />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
