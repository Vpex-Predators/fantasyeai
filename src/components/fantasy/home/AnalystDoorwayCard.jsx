import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import HudPanel from "@/components/hud/HudPanel";
import OpenButton from "@/components/hud/OpenButton";

// Trade analyst doorway: the latest suggested question built from your live
// roster. A tap opens the full analyst chat.
export default function AnalystDoorwayCard({ delay = 0 }) {
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke("getAnalystSuggestions", {});
        if (!cancelled) setQuestion((res.data && res.data.questions && res.data.questions[0]) || null);
      } catch {
        if (!cancelled) setQuestion(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link to="/analyst" className="no-callout block rounded-2xl transition-transform duration-200 active:scale-[0.99]">
      <HudPanel label="Trade analyst" right="ASK AI" delay={delay} compact>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-white/55">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
            Reading your roster…
          </p>
        ) : question ? (
          <>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-white/60">Suggested ask</p>
            <p className="mt-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-sm leading-snug text-white/85">
              “{question}”
            </p>
          </>
        ) : (
          <p className="text-sm text-white/55">
            Ask anything — the analyst reads your live ESPN data.
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-sm text-white/55">
          <span className="min-w-0">Plain-English verdicts with real numbers</span>
          <OpenButton>Open analyst</OpenButton>
        </div>
      </HudPanel>
    </Link>
  );
}