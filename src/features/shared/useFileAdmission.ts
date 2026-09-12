import { useEffect, useRef, useState } from "react";

import { LARGE_FILE_BYTES, LARGE_PAGE_COUNT } from "../../pdf/validation";
import { abortable } from "./abortable";

type InputItem = { file: File; pageCount?: number };
export type FileIssue = { name: string; message: string };
type Totals = { totalBytes: number; totalPages: number };
type Options<T extends InputItem> = {
  kind: "pdf" | "image";
  parse: (file: File, signal: AbortSignal) => Promise<T>;
  onAccepted: (items: T[]) => void;
  release?: (item: T) => void;
  existing?: readonly T[];
};
type Session<T extends InputItem> = {
  controller: AbortController;
  options: Options<T>;
  files: File[];
  accepted: T[];
  stage: "raw" | "reading" | "parsed";
  approvedBytes: boolean;
  approvedPages: boolean;
};

function totals(items: readonly InputItem[]): Totals {
  return items.reduce((sum, item) => ({
    totalBytes: sum.totalBytes + item.file.size,
    totalPages: sum.totalPages + (item.pageCount ?? 1),
  }), { totalBytes: 0, totalPages: 0 });
}

function dispose<T extends InputItem>(session: Session<T> | null) {
  if (!session) return;
  session.controller.abort();
  session.accepted.forEach((item) => session.options.release?.(item));
  session.accepted = [];
}

/** Owns temporary inputs; ownership transfers only when onAccepted is called. */
export function useFileAdmission<T extends InputItem>(options: Options<T>) {
  const current = useRef<Session<T> | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [errors, setErrors] = useState<FileIssue[]>([]);
  const [warning, setWarning] = useState<Totals | null>(null);

  useEffect(() => () => {
    dispose(current.current);
    current.current = null;
  }, []);

  function cancel() {
    dispose(current.current);
    current.current = null;
    setIsReading(false);
    setWarning(null);
  }

  function reset() {
    cancel();
    setErrors([]);
    setProgress({ completed: 0, total: 0 });
  }

  function accept(session: Session<T>) {
    if (current.current !== session) return;
    const items = session.accepted;
    session.accepted = [];
    current.current = null;
    setWarning(null);
    setIsReading(false);
    if (items.length) session.options.onAccepted(items);
  }

  async function read(session: Session<T>) {
    session.stage = "reading";
    const { signal } = session.controller;
    const issues: FileIssue[] = [];
    setIsReading(true);
    setWarning(null);
    setProgress({ completed: 0, total: session.files.length });
    for (let index = 0; index < session.files.length; index++) {
      if (signal.aborted) return;
      const file = session.files[index];
      try {
        const item = await session.options.parse(file, signal);
        if (signal.aborted) {
          session.options.release?.(item);
          return;
        }
        session.accepted.push(item);
      } catch (error) {
        if (signal.aborted) return;
        issues.push({
          name: file.name,
          message: error instanceof Error ? error.message : "Không thể đọc tệp.",
        });
      }
      setProgress({ completed: index + 1, total: session.files.length });
    }
    if (current.current !== session) return;
    setErrors(issues);
    setIsReading(false);
    const sum = totals([...(session.options.existing ?? []), ...session.accepted]);
    if (session.accepted.length && (
      (!session.approvedBytes && sum.totalBytes > LARGE_FILE_BYTES) ||
      (!session.approvedPages && sum.totalPages > LARGE_PAGE_COUNT)
    )) {
      session.stage = "parsed";
      setWarning(sum);
    } else {
      accept(session);
    }
  }

  async function addFiles(files: File[], selection?: Pick<Options<T>, "existing" | "onAccepted">) {
    if (!files.length) return;
    reset();
    const session: Session<T> = {
      controller: new AbortController(), options: { ...options, ...selection }, files,
      accepted: [], stage: "raw", approvedBytes: false, approvedPages: false,
    };
    current.current = session;
    const existing = totals(session.options.existing ?? []);
    const sum = {
      totalBytes: existing.totalBytes + files.reduce((bytes, file) => bytes + file.size, 0),
      totalPages: existing.totalPages + (options.kind === "image" ? files.length : 0),
    };
    if (sum.totalBytes > LARGE_FILE_BYTES || sum.totalPages > LARGE_PAGE_COUNT) {
      session.approvedBytes = sum.totalBytes > LARGE_FILE_BYTES;
      session.approvedPages = sum.totalPages > LARGE_PAGE_COUNT;
      setWarning(sum);
    } else {
      await runReading(session);
    }
  }

  async function runReading(session: Session<T>) {
    try {
      await abortable(read(session), session.controller.signal);
    } catch (error) {
      if (!session.controller.signal.aborted) throw error;
    }
  }

  async function continueReading() {
    const session = current.current;
    if (!session || session.stage === "reading") return;
    if (session.stage === "parsed") accept(session);
    else await runReading(session);
  }

  return {
    addFiles, cancel, reset, continueReading,
    dismissWarning: () => { if (current.current?.stage !== "reading") cancel(); },
    dismissErrors: () => setErrors([]),
    isReading, isBusy: isReading || warning !== null,
    progress, errors, warning,
  };
}

export type FileAdmissionState = Pick<ReturnType<typeof useFileAdmission>,
  "isReading" | "progress" | "errors" | "warning" | "cancel" | "continueReading" | "dismissErrors" | "dismissWarning"
>;
