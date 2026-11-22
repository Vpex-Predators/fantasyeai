import React, { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { usePlayerNames } from "@/components/PlayerNameProvider";

const positionLabel = pos => (pos === "DST" ? "D/ST" : pos || "—");

// Searchable player picker for the compare tool — any roster or free agent.
export default function ComparePicker({ player, placeholder, pool, onPick }) {
  const short = usePlayerNames();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? pool.filter(p => p.name.toLowerCase().includes(q)) : pool;
    return [...list].sort((a, b) => (b.weeklyProj || 0) - (a.weeklyProj || 0)).slice(0, 8);
  }, [pool, query]);

  const choose = p => {
    onPick(p);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="min-w-0">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex w-full items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${
          player ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"
        }`}
      >
        {player ? (
          <span className="min-w-0 truncate text-sm font-semibold text-white">
            {short(player.name)} <span className="font-normal text-white/60">· {positionLabel(player.position)}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-white/60">
            <Search className="h-3 w-3 shrink-0" /> {placeholder}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-1.5 rounded-xl border border-white/10 bg-slate-900/95 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search players…"
            className="w-full rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-white/60 outline-none focus:border-emerald-400/60"
          />
          <div className="mt-1.5 max-h-56 space-y-0.5 overflow-y-auto">
            {results.map(p => (
              <button
                key={p.id}
                onClick={() => choose(p)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/10"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-white">
                  {short(p.name)} <span className="font-normal text-white/60">{positionLabel(p.position)}</span>
                </span>
                <span className="shrink-0 font-mono text-sm text-white/70">
                  {p.teamLabel} · {p.weeklyProj != null ? p.weeklyProj.toFixed(1) : "—"} wk
                </span>
              </button>
            ))}
            {!results.length && (
              <p className="px-2 py-2 text-sm text-white/70">No players match “{query}”.</p>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="mt-1 flex w-full items-center justify-center gap-1 py-1 text-sm font-bold uppercase tracking-wider text-white/70 transition-colors hover:text-white"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}