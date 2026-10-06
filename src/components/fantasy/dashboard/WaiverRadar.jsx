import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Loader2, Newspaper, Radar, Trash2 } from "lucide-react";
import GlossaryChip from "@/components/hud/GlossaryChip";
import WireList from "@/components/waiver/WireList";
import WaiverPlayerNumbers from "@/components/waiver/WaiverPlayerNumbers";
import { buildShortNames, shortName } from "@/lib/playerNames";
import { realPos } from "@/lib/lineupOrder";

const CATEGORY_STYLES = {
  fills_weak_spot: { label: "Fills a hole", cls: "border-amber-400/30 bg-amber-400/15 text-amber-300" },
  handcuff: { label: "Handcuff", cls: "border-sky-400/30 bg-sky-400/15 text-sky-300" },
  overlooked: { label: "Overlooked", cls: "border-emerald-400/30 bg-emerald-400/15 text-emerald-300" },
  streamer: { label: "Streamer", cls: "border-violet-400/30 bg-violet-400/15 text-violet-300" }
};
const PRIORITY_STYLES = {
  high: { label: "Need", cls: "bg-emerald-400 text-slate-950" },
  medium: { label: "Consider", cls: "border border-amber-400/40 bg-amber-400/15 text-amber-300" },
  low: { label: "Watch", cls: "text-white/40" }
};
const POSITION_TABS = ["All", "QB", "RB", "WR", "TE", "D/ST", "K"];
const INJURY_LABELS = {
  QUESTIONABLE: "questionable", Q: "questionable",
  OUT: "out", O: "out",
  DOUBTFUL: "doubtful", D: "doubtful",
  INJURY_RESERVE: "on IR", IR: "on IR", PUP: "on IR", NFI: "on IR",
  SUSPENSION: "suspended", SSPD: "suspended", SSD: "suspended"
};
const positionLabel = pos => (pos === "DST" ? "D/ST" : pos);

export default function WaiverRadar({ freeAgents, bench, starters, onScanReady }) {
  const [targets, setTargets] = useState(null);
  const [weaknesses, setWeaknesses] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [openName, setOpenName] = useState(null);
  const [posTab, setPosTab] = useState("All");
  const [scannedAt, setScannedAt] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Quick live flags from the lineup: injured starters without a backup.
  const lineFlags = useMemo(() => {
    const benchPos = new Set((bench || []).map(realPos).filter(Boolean));
    return (starters || [])
      .filter(s => {
        const inj = INJURY_LABELS[String(s.injuryStatus || "").toUpperCase()];
        return inj && realPos(s) && !benchPos.has(realPos(s));
      })
      .map(s => `${shortName(s.name)} is ${INJURY_LABELS[String(s.injuryStatus || "").toUpperCase()]} and you have no backup ${realPos(s) || s.position}`);
  }, [starters, bench]);

  // force=true runs a fresh scan; force=false serves this week's cached scan instantly.
  const scan = async (force = true) => {
    setScanning(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("getWaiverTargets", { force });
      setTargets(res.data.targets || []);
      setWeaknesses(res.data.weaknesses || []);
      setScannedAt(res.data.scanned_at || null);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Scan failed — try again in a bit.");
    } finally {
      setScanning(false);
    }
  };

  // On open, load this week's scan from the cache — instant after the first scan of the week.
  useEffect(() => { scan(false); }, []);

  // Hand the scan handler to the page so pull-to-refresh can trigger it.
  useEffect(() => { onScanReady?.(scan); }, [onScanReady]);

  const matchesPos = p => posTab === "All" || positionLabel(p.position) === posTab;
  const shownTargets = (targets || []).filter(matchesPos);
  const wireCount = (freeAgents || []).filter(matchesPos).length;

  // Compact labels: targets, wire, and roster names share one collision set.
  const shortNames = useMemo(
    () =>
      buildShortNames([
        ...(targets || []).map(t => t.name),
        ...(freeAgents || []).map(p => p.name),
        ...(starters || []).map(p => p.name),
        ...(bench || []).map(p => p.name)
      ]),
    [targets, freeAgents, starters, bench]
  );
  const short = n => shortNames[n] || shortName(n);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-white/80">Waiver radar</h2>
        <button
          onClick={() => scan(true)}
          disabled={scanning}
          className="no-callout flex min-h-[44px] items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 text-sm font-bold uppercase tracking-wider text-emerald-300 transition-colors hover:bg-emerald-400/20 disabled:opacity-50"
        >
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
          {scanning ? "Scanning" : "Scan the wire"}
        </button>
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto">
        {POSITION_TABS.map(pos => (
          <button
            key={pos}
            onClick={() => setPosTab(pos)}
            className={`no-callout min-h-[44px] shrink-0 rounded-full px-3 text-sm font-bold uppercase tracking-wide transition-colors ${
              posTab === pos ? "bg-emerald-400 text-slate-950" : "border border-white/10 bg-white/5 text-white/50"
            }`}
          >
            {pos}
          </button>
        ))}
      </div>

      {lineFlags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {lineFlags.map(f => (
            <span key={f} className="flex items-center gap-1 rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-1 text-[10px] font-medium text-rose-300">
              <AlertTriangle className="h-3 w-3" /> {f}
            </span>
          ))}
        </div>
      )}

      {error && <p className="mb-2 text-xs text-rose-300">{error}</p>}

      {scanning && (
        <p className="py-2 text-xs text-white/50">Checking live news, injuries and the wire for your weak spots…</p>
      )}

      {!scanning && shownTargets.length > 0 && (
        <div className="space-y-2">
          {shownTargets.map(t => {
            const cat = CATEGORY_STYLES[t.category] || CATEGORY_STYLES.streamer;
            const pr = PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.low;
            const open = openName === t.name;
            return (
              <div
                key={t.name}
                className={`rounded-xl border bg-white/5 ${
                  t.priority === "high"
                    ? "border-emerald-400/50 shadow-[0_0_16px_rgba(52,211,153,0.18)]"
                    : "border-white/10"
                }`}
              >
                <button
                  onClick={() => setOpenName(open ? null : t.name)}
                  className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">
                      {short(t.name)}{" "}
                      <span className="text-white/40">
                        · {positionLabel(t.position) === "D/ST" ? <GlossaryChip term="dst" bare>D/ST</GlossaryChip> : positionLabel(t.position)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-white/55">{t.why_brief}</p>
                    {t.news_note && (
                      <p className="mt-1 flex items-start gap-1 text-[10px] leading-snug text-amber-200/80">
                        <Newspaper className="mt-0.5 h-3 w-3 shrink-0" /> {t.news_note}
                      </p>
                    )}
                    {t.priority === "high" && t.drop_suggestion && (
                      <p className="mt-1 text-[10px] font-semibold text-emerald-300">Drop {short(t.drop_suggestion)} to add {short(t.name)}.</p>
                    )}
                    {t.priority === "high" && !t.drop_suggestion && (
                      <p className="mt-1 text-[10px] text-white/45">{t.no_drop_reason || "No roster change needed."}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${cat.cls}`}>
                      {t.category === "handcuff" ? (
                        <GlossaryChip term="handcuff" bare>{cat.label}</GlossaryChip>
                      ) : t.category === "streamer" ? (
                        <GlossaryChip term="streaming" bare>{cat.label}</GlossaryChip>
                      ) : (
                        cat.label
                      )}
                    </span>
                    {t.priority && (
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${pr.cls}`}>
                        {pr.label}
                      </span>
                    )}
                  </div>
                </button>
                <WaiverPlayerNumbers target={t} players={freeAgents || []} />
                {open && (
                  <div className="space-y-1.5 border-t border-white/10 px-3 py-2 text-[10px] text-white/55">
                    {t.priority === "high" && t.drop_suggestion && (
                      <p className="flex items-start gap-1.5 text-amber-200/90">
                        <Trash2 className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>Drop <span className="font-bold">{short(t.drop_suggestion)}</span> to add {short(t.name)}.</span>
                      </p>
                    )}
                    {t.source_url && (
                      <a
                        href={t.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-300 transition-colors hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> {t.source || "Source"}
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-white/40">
              Tap a player for the source and a drop idea.
              {scannedAt && (
                <span className="ml-1 text-white/25">
                  Scanned {new Date(scannedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </p>
            <button onClick={() => scan(true)} className="no-callout min-h-[44px] px-1 text-sm font-semibold uppercase tracking-wider text-emerald-400/80 hover:text-emerald-300">
              Re-scan
            </button>
          </div>
        </div>
      )}

      {!scanning && targets && shownTargets.length === 0 && (
        <p className="text-xs text-white/50">
          No {posTab === "All" ? "" : posTab + " "}targets in this scan — try another position or re-scan.
        </p>
      )}

      {!scanning && !targets && (
        <p className="text-[10px] text-white/40">
          Hit “Scan the wire” for targets picked around your team’s weak spots, hidden gems and injury backups.
        </p>
      )}

      {/* Full wire browsing — one tool, collapsed behind Show more */}
      <div className="mt-3 border-t border-white/10 pt-3">
        <button
          onClick={() => setShowAll(o => !o)}
          className="no-callout flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-sm font-bold uppercase tracking-wider text-white/60 transition-colors hover:bg-white/10"
        >
          {showAll ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showAll ? "Show less" : "Show more +"}
          {!showAll && <span className="font-normal normal-case text-white/35">· {wireCount} available</span>}
        </button>
        {showAll && <WireList players={(freeAgents || []).filter(matchesPos)} />}
      </div>

      {targets && targets.length > 0 && weaknesses.length > 0 && (
        <p className="mt-3 border-t border-white/10 pt-2 text-[10px] leading-snug text-white/35">
          Scanned against: {weaknesses.slice(0, 3).join(" · ")}
        </p>
      )}
    </section>
  );
}