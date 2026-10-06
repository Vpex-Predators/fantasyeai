import { RefreshCw } from "lucide-react";

function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function RefreshBar({ lastRefresh, refreshing, analyzing, pendingCount, onRefresh }) {
  const busy = refreshing || analyzing;
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        onClick={onRefresh}
        disabled={busy}
        title="Refresh live scores"
        className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all active:scale-95 ${
          pendingCount > 0
            ? "animate-pulse border-emerald-400/60 bg-emerald-400/15"
            : "border-white/15 bg-white/5 hover:bg-white/10"
        }`}
      >
        <RefreshCw className="h-5 w-5 text-emerald-300" />
      </button>
      <span className="text-[9px] font-medium uppercase tracking-wide text-white/40">
        {busy ? "Syncing…" : lastRefresh ? timeAgo(lastRefresh) : "Never"}
      </span>
      {pendingCount > 0 && !busy && (
        <span className="rounded-full bg-emerald-400 px-1.5 text-[9px] font-bold text-slate-950">
          {pendingCount} new
        </span>
      )}
    </div>
  );
}