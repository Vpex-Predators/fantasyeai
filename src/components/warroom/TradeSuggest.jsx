import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Wand2 } from "lucide-react";
import HudPanel from "@/components/hud/HudPanel";
import { usePlayerNames } from "@/components/PlayerNameProvider";

// AI-guided deals: the analyst proposes fair swaps for the chosen partner,
// and any proposal loads straight into the tap-to-build trade columns.
export default function TradeSuggest({ partnerId, partnerName, model, onLoad }) {
  const short = usePlayerNames();
  const [trades, setTrades] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("tradeIntel", { mode: "suggest", partnerTeamId: partnerId, model });
      setTrades(res.data.trades);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "The analyst could not propose deals right now.");
    } finally {
      setRunning(false);
    }
  };

  const list = trades || [];

  return (
    <HudPanel label="AI-guided deals" right={partnerName ? partnerName.trim().toUpperCase() : ""}>
      <p className="text-sm text-white/45">
        The analyst scouts mutually fair swaps with the latest news, injuries, projections, and QB history factored in.
      </p>
      <button
        onClick={run}
        disabled={running || !partnerId}
        className="mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 border border-emerald-400/40 bg-emerald-400/10 text-sm font-bold uppercase tracking-[0.18em] text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-50"
      >
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
        {running ? "Scouting deals…" : "Propose deals"}
      </button>

      {error && (
        <p className="mt-2 border border-rose-400/30 bg-rose-400/10 p-2 font-mono text-sm text-rose-300">{error}</p>
      )}

      {list.length > 0 && (
        <div className="mt-3 space-y-2">
          {list.map((t, i) => (
            <div key={i} className="border border-white/10 bg-white/[0.02] p-2.5">
              <p className="font-mono text-sm text-white/60">
                GIVE <span className="text-rose-300">{(t.give || []).map(short).join(", ")}</span>
              </p>
              <p className="mt-0.5 font-mono text-sm text-white/60">
                GET <span className="text-emerald-300">{(t.get || []).map(short).join(", ")}</span>
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/70">{t.rationale}</p>
              <button
                onClick={() => onLoad(t)}
                className="mt-2 w-full border border-emerald-400/40 bg-emerald-400/10 py-1.5 text-sm font-bold uppercase tracking-[0.18em] text-emerald-300 hover:bg-emerald-400/20"
              >
                Load into builder
              </button>
            </div>
          ))}
        </div>
      )}
      {trades && list.length === 0 && (
        <p className="mt-2 font-mono text-sm text-white/40">No fair deals found with this roster right now.</p>
      )}
    </HudPanel>
  );
}