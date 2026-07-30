import { Suspense, useEffect, useRef } from "react";

import { ErrorBoundary } from "../components";
import { AppShell } from "./AppShell";
import { HomePage } from "./HomePage";
import { NotFoundPage } from "./NotFoundPage";
import { toolRoutes } from "./toolRegistry";
import { useHashRoute } from "./useHashRoute";

export function App() {
  const currentPath = useHashRoute();
  const route = toolRoutes.find((item) => item.path === currentPath);
  const previousPath = useRef(currentPath);
  const pageTitle =
    currentPath === "/"
      ? "PDF Tools — Xử lý PDF ngay trên thiết bị"
      : route
        ? `${route.title} — PDF Tools`
        : "Không tìm thấy — PDF Tools";

  useEffect(() => {
    document.title = pageTitle;

    if (previousPath.current !== currentPath) {
      window.scrollTo({ top: 0 });
      document.getElementById("main-content")?.focus();
      previousPath.current = currentPath;
    }
  }, [currentPath, pageTitle]);

  let content;
  if (currentPath === "/") {
    content = <HomePage />;
  } else if (route) {
    const Tool = route.component;
    content = <Tool />;
  } else {
    content = <NotFoundPage />;
  }

  return (
    <AppShell currentPath={currentPath}>
      <ErrorBoundary key={currentPath}>
        <Suspense
          fallback={
            <div
              className="mx-auto flex min-h-80 max-w-7xl items-center justify-center px-4 text-sm font-medium text-slate-600"
              role="status"
            >
              Đang mở công cụ…
            </div>
          }
        >
          {content}
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
