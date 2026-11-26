import React, { useState } from "react";
import { invokeAppFunction } from "@/api/appBackend";
import { base44 } from "@/api/base44Client";
import { Loader2, Crosshair, Sparkles, RotateCcw } from "lucide-react";
import HudPanel from "@/components/hud/HudPanel";
import TradeRoster from "@/components/warroom/TradeRoster";
import SimCrushReplay from "@/components/warroom/SimCrushReplay";
import TradeSuggest from "@/components/warroom/TradeSuggest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AI_MODELS } from "@/lib/aiModels";

// Tap-to-build trade simulator: pick a partner, tap players on each side,
// re-run the playoff engine with swapped lineups, then get the AI verdict.
export default function TradeSimulator({ data }) {
  const { myTeam, teams, rosters, league } = data;
  const partnerOptions = teams.filter((t) => t.id !== myTeam.id);

  const [partnerId, setPartnerId] = useState(partnerOptions[0]?.id || "");
  const [give, setGive] = useState([]);
  const [get, setGet] = useState([]);
  const [odds, setOdds] = useState(null);
  const [simRunning, setSimRunning] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [verdictRunning, setVerdictRunning] = useState(false);
  const [model, setModel] = useState("automatic");
  const [error, setError] = useState(null);

  const partner = partnerOptions.find((t) => t.id === partnerId);
  const myRoster = rosters[myTeam.id] || [];
  const theirRoster = rosters[partnerId] || [];

  const resetResults = () => {
    setOdds(null);
    setVerdict(null);
    setError(null);
  };

  const pickPartner = (id) => {
    setPartnerId(id);
    setGive([]);
    setGet([]);
    resetResults();
  };

  const toggle = (setter, list, id) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
    resetResults();
  };

  const clear = () => {
    setGive([]);
    setGet([]);
    resetResults();
  };

  const invokeIntel = async (mode) => {
    const res = await invokeAppFunction("tradeIntel", { mode, partnerTeamId: partnerId, give, get, model });
    return res.data;
  };

  const needBothSides = () => {
    if (!give.length || !get.length) {
      setError("Tap at least one player on each side of the trade.");
      return true;
    }
    return false;
  };

  const runSim = async () => {
    if (needBothSides()) return;
    setSimRunning(true);
    setError(null);
    try {
      setOdds(await invokeIntel("simulate"));
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Simulation failed.");
    } finally {
      setSimRunning(false);
    }
  };

  const runVerdict = async () => {
    if (needBothSides()) return;
    setVerdictRunning(true);
    setError(null);
    try {
      const d = await invokeIntel("verdict");
      setOdds({ before: d.before, after: d.after, lineupDelta: d.lineupDelta, week: d.week });
      setVerdict(d.verdict);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "The verdict failed.");
    } finally {
      setVerdictRunning(false);
    }
  };

  const loadSuggestion = (s) => {
    const findIds = (names, roster) =>
      (names || [])
        .map((n) => roster.find((p) => p.name.trim().toLowerCase() === String(n).trim().toLowerCase())?.id)
        .filter(Boolean);
    setGive(findIds(s.give, myRoster));
    setGet(findIds(s.get, theirRoster));
    resetResults();
  };

  const verdictLabel =
    verdict && verdict.prediction === "favor_me" ? "FAVORS ME"
    : verdict && verdict.prediction === "favor_them" ? "FAVORS THEM"
    : "EVEN";
  const verdictTone =
    verdict && verdict.prediction === "favor_me" ? "text-emerald-300"
    : verdict && verdict.prediction === "favor_them" ? "text-rose-300"
    : "text-amber-300";

  return (
    <div className="space-y-3">
      <HudPanel label="Trade impact simulator" right={`WK ${league.week}`}>
        <div className="flex items-center gap-2">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-white/45">PARTNER</span>
          <Select value={partnerId} onValueChange={(id) => pickPartner(id)}>
            <SelectTrigger className="h-11 min-h-[44px] min-w-0 flex-1 rounded-none border-white/10 bg-slate-900 font-mono text-sm text-white focus:border-emerald-400/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none border-white/10 bg-slate-900 text-white">
              {partnerOptions.map((t) => (
                <SelectItem key={t.id} value={t.id} className="min-h-[44px] rounded-none py-2.5 text-sm focus:bg-white/10">
                  {t.name} ({t.wins}-{t.losses})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {partner && (
          <p className="mt-2 border border-white/10 bg-white/[0.02] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white/60">
            {myTeam.name.trim()} ⇄ {partner.name.trim()} — tap players to build the trade
          </p>
        )}
      </HudPanel>

      <TradeRoster
        title="My assets — give"
        players={myRoster}
        selected={give}
        onToggle={(id) => toggle(setGive, give, id)}
        selectedLabel="OUT"
        tone="emerald"
      />
      <TradeRoster
        title={`${partner ? partner.name.trim() : "Their"} assets — get`}
        players={theirRoster}
        selected={get}
        onToggle={(id) => toggle(setGet, get, id)}
        selectedLabel="IN"
        tone="rose"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={runSim}
          disabled={simRunning}
          className="no-callout flex h-11 min-h-[44px] flex-1 items-center justify-center gap-1.5 bg-emerald-400 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
        >
          {simRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
          Run simulation
        </button>
        <button
          onClick={clear}
          className="no-callout flex h-11 min-h-[44px] shrink-0 items-center gap-1.5 border border-white/15 px-3 text-sm font-bold uppercase tracking-[0.18em] text-white/60 hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Clear
        </button>
      </div>

      {error && (
        <p className="border border-rose-400/30 bg-rose-400/10 p-2 font-mono text-[10px] text-rose-300">{error}</p>
      )}

      {odds && <SimCrushReplay odds={odds} myName={myTeam.name.trim()} partnerName={partner ? partner.name.trim() : ""} />}

      {odds && (
        <HudPanel label="AI verdict" right="WEB + LIVE DATA">
          <div className="flex gap-2">
            <Select value={model} onValueChange={setModel} disabled={verdictRunning}>
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
              onClick={runVerdict}
              disabled={verdictRunning}
              className="no-callout flex h-11 min-h-[44px] shrink-0 items-center gap-1.5 bg-emerald-400 px-4 text-sm font-bold uppercase tracking-[0.15em] text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
            >
              {verdictRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {verdictRunning ? "Judging…" : "Get verdict"}
            </button>
          </div>

          {verdict && (
            <div className="mt-3 border border-white/10 bg-slate-950/60 p-3">
              <p className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.15em]">
                <span className={verdictTone}>● {verdictLabel}</span>
                <span className="text-white/45">CONFIDENCE {String(verdict.confidence || "").toUpperCase()}</span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/80">{verdict.summary}</p>
            </div>
          )}
        </HudPanel>
      )}

      <TradeSuggest partnerId={partnerId} partnerName={partner ? partner.name : ""} model={model} onLoad={loadSuggestion} />
    </div>
  );
}