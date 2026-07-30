import { useSyncExternalStore } from "react";

function normalizePath(hash: string) {
  const path = hash.replace(/^#/, "").split("?")[0] || "/";
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  if (withLeadingSlash.length > 1) {
    return withLeadingSlash.replace(/\/+$/, "");
  }
  return withLeadingSlash;
}

function getSnapshot() {
  return normalizePath(window.location.hash);
}

function getServerSnapshot() {
  return "/";
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

export function useHashRoute() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export { normalizePath };
