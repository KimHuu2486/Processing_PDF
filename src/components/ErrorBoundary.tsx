import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "./Button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("PDF Tools UI error", error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <section
        role="alert"
        className="mx-auto my-12 max-w-xl rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm sm:p-8"
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-red-50 text-red-700">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-balance text-2xl font-bold text-slate-950">
          Công cụ gặp sự cố
        </h1>
        <p className="mt-2 text-pretty leading-7 text-slate-600">
          Tài liệu của bạn vẫn chỉ nằm trên thiết bị. Hãy tải lại trang để bắt
          đầu một phiên mới.
        </p>
        <Button
          variant="primary"
          className="mt-6"
          onPress={() => window.location.reload()}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Tải lại trang
        </Button>
      </section>
    );
  }
}
