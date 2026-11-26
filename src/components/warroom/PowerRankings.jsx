import React, { useState } from "react";
import { invokeAppFunction } from "@/api/appBackend";
import { base44 } from "@/api/base44Client";
import { Loader2, Sparkles } from "lucide-react";
import HudPanel from "@/components/hud/HudPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AI_MODELS } from "@/lib/aiModels";

const sameName = (a, b) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();

export default function PowerRankings({ data }) {
  const [model, setModel] = useState("automatic");
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await invokeAppFunction("generatePowerRankings", { model });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "The analyst could not run right now.");
    } finally {
      setRunning(false);
    }
  };

  const rankings = result && Array.isArray(result.rankings) ? result.rankings : [];

  return (
    <HudPanel label="AI power rankings" right={result ? `WK ${result.week}` : "TRASH TALK"}>
      <p className="text-[10px] text-white/45">
        True-strength rankings for all 12 teams with a stats-anchored roast — luck factor exposed.
      </p>

      <div className="mt-2.5 flex gap-2">
        <Select value={model} onValueChange={setModel} disabled={running}>
          <SelectTrigger className="h-11 min-h-[44px] min-w-0 flex-1 rounded-none border-white/10 bg-slate-900 font-mono text-sm text-white focus:border-emerald-400/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none border-white/10 bg-slate-900 text-white">
            {AI_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id} className="min-h-[44px] rounded-none py-2.5 text-sm focus:bg-white/10">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={run}
          disabled={running}
          className="no-callout flex h-11 min-h-[44px] shrink-0 items-center gap-1.5 bg-emerald-400 px-4 text-sm font-bold uppercase tracking-[0.15em] text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {running ? "Ranking…" : result ? "Re-run" : "Generate"}
        </button>
      </div>
      <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-white/35">
        Premium engines use more AI credits · auto & Gemini Flash pull live web context.
      </p>

      {error && (
        <p className="mt-2 border border-rose-400/30 bg-rose-400/10 p-2 font-mono text-[10px] text-rose-300">{error}</p>
      )}

      {rankings.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {rankings.map((r) => {
            const mine = sameName(r.team, data.myTeam.name);
            return (
              <div
                key={r.rank}
                className={`border px-2.5 py-2 ${
                  mine ? "border-emerald-400/40 bg-emerald-400/[0.08]" : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-lg font-bold leading-none ${mine ? "text-emerald-300" : "text-white/70"}`}>
                    {String(r.rank).padStart(2, "0")}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-xs font-bold ${mine ? "text-emerald-200" : "text-white"}`}>
                    {r.team}
                  </span>
                  {mine && (
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.15em] text-emerald-300">You</span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-white/75">{r.verdict}</p>
                <p className="mt-0.5 text-[11px] italic text-white/45">"{r.roast}"</p>
              </div>
            );
          })}
          <p className="border-t border-dashed border-white/10 pt-2 font-mono text-[9px] uppercase tracking-[0.15em] text-white/35">
            {result.model} · {result.webContext ? "live web context" : "ESPN league data only"} ·{" "}
            {new Date(result.generatedAt).toLocaleString()}
          </p>
        </div>
      )}
    </HudPanel>
  );
}