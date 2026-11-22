import React from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import useOnlineStatus from "@/hooks/useOnlineStatus";

// Snackbar-style offline notice, parked above the bottom nav so it never
// covers the header or the tab bar.
export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.75rem)] z-[60] flex justify-center px-3"
    >
      <div className="no-callout pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl border border-amber-400/40 bg-slate-950/92 px-3 py-2 text-sm text-amber-200 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 leading-snug">
          You're offline. Showing the data already loaded.
        </span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex min-h-[48px] shrink-0 items-center gap-1 rounded-full bg-amber-400 px-3 text-sm font-semibold text-slate-950"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </div>
    </div>
  );
}