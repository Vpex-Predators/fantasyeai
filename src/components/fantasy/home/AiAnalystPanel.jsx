import React, { useState } from "react";
import { invokeAppFunction } from "@/api/appBackend";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";
import { Loader2, Sparkles } from "lucide-react";
import HudPanel from "@/components/hud/HudPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AI_MODELS } from "@/lib/aiModels";

export default function AiAnalystPanel({ data, delay = 0 }) {
  const [model, setModel] = useState("automatic");
  const [briefing, setBriefing] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await invokeAppFunction("analyzeBriefing", { model });
      setBriefing(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "The analyst could not run right now.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <HudPanel label="On-demand AI analyst" right="ANALYTICS" delay={delay}>
      <p className="text-[10px] text-white/45">
        Live league data plus the latest news, injuries, and QB history — answers come back short and in plain English.
      </p>

      <div className="mt-2.5 flex gap-2">
        <Select value={model} onValueChange={setModel} disabled={running}>
          <SelectTrigger
            aria-label="AI engine"
            className="h-8 min-w-0 flex-1 rounded-lg border-white/10 bg-slate-900/70 px-2 font-mono text-[11px] text-white shadow-none focus:ring-emerald-400/60 disabled:opacity-50"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-slate-900 text-white">
            {AI_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs text-white/85 focus:bg-white/10 focus:text-white">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={run}
          disabled={running || !data?.locked}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-3.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-950 shadow-[0_0_16px_rgba(52,211,153,0.35)] transition-all hover:from-emerald-300 hover:to-cyan-300 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {running ? "Analyzing…" : briefing ? "Re-run" : "Run analyst"}
        </button>
      </div>
      <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-white/35">
        Premium engines use more AI credits · engines without web access still read live ESPN league data.
      </p>

      {error && (
        <p className="mt-2 border border-rose-400/30 bg-rose-400/10 p-2 font-mono text-[10px] text-rose-300">{error}</p>
      )}

      {briefing && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3.5 text-sm leading-relaxed text-white/80 backdrop-blur-xl [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-xs [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-widest [&_h3]:text-emerald-300 [&_li]:mt-0.5 [&_strong]:text-white [&_ul]:list-disc [&_ul]:pl-5">
          <ReactMarkdown>{briefing.briefing}</ReactMarkdown>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.15em] text-white/35">
            {briefing.model} · {briefing.webContext ? "with live web context" : "ESPN league data only"} ·{" "}
            {new Date(briefing.generatedAt).toLocaleString()}
          </p>
        </div>
      )}
    </HudPanel>
  );
}