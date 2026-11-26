import React, { useCallback, useEffect, useRef, useState } from "react";
import { invokeAppFunction } from "@/api/appBackend";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import AppNavBar from "@/components/AppNavBar";
import GlassBackdrop from "@/components/hud/GlassBackdrop";
import HudPanel from "@/components/hud/HudPanel";
import HudStatusBar from "@/components/hud/HudStatusBar";
import WaiverRadar from "@/components/fantasy/dashboard/WaiverRadar";
import usePullToRefresh from "@/hooks/usePullToRefresh";
import PullIndicator from "@/components/hud/PullIndicator";
import { PlayerNameProvider } from "@/components/PlayerNameProvider";

export default function WaiverWire() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scanRef = useRef(null);
  const handleScanReady = useCallback((scan) => { scanRef.current = scan; }, []);
  // Native pull-to-refresh at the top of the page re-runs the waiver scan —
  // the same handler as the "Scan the wire" button.
  const handlePullRefresh = useCallback(async () => { await scanRef.current?.(true); }, []);
  const { pull, refreshing: pulling } = usePullToRefresh(handlePullRefresh);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setLoading(true);
    invokeAppFunction("getWarRoomData", {})
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.error || err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const d = data?.locked ? data : null;
  const roster = d?.rosters?.[d.myTeam.id] || [];
  return (
    <div className="min-h-screen bg-slate-950 pb-[calc(env(safe-area-inset-bottom)+7rem)] text-white">
      <GlassBackdrop />
      <HudStatusBar title="Waiver wire" sub={d ? `${d.league.name.trim()} · WK ${d.league.week} · ${d.myTeam.name.trim()}` : "Available players & smart adds"} tag={d ? "LIVE" : "STANDBY"} />
      <PullIndicator pull={pull} refreshing={pulling} />
      <PlayerNameProvider names={[...roster, ...(d?.freeAgents || [])].map(p => p && p.name)}>
      <main className="relative z-10 mx-auto max-w-2xl space-y-3 px-3 pt-3">
        {isLoadingAuth || loading ? <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-emerald-400" /></div>
          : error ? <div className="border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-300">{error}</div>
          : !isAuthenticated ? <HudPanel label="Access restricted"><p className="text-xs text-white/60">Sign in to scan your league's waiver wire.</p><Link to="/" className="mt-3 inline-block no-callout inline-flex min-h-[44px] items-center bg-emerald-400 px-5 py-2.5 text-sm font-bold uppercase text-slate-950">Back to command</Link></HudPanel>
          : data && !data.locked ? <HudPanel label="Team lock required"><p className="text-xs text-white/60">Lock your team before scanning the wire.</p><Link to="/dashboard" className="mt-3 inline-block no-callout inline-flex min-h-[44px] items-center bg-emerald-400 px-5 py-2.5 text-sm font-bold uppercase text-slate-950">Lock my team</Link></HudPanel>
          : d ? <><WaiverRadar starters={roster.filter((p) => p.isStarter)} bench={roster.filter((p) => !p.isStarter)} freeAgents={d.freeAgents || []} onScanReady={handleScanReady} /></> : null}
      </main>
      </PlayerNameProvider>
      <AppNavBar />
    </div>
  );
}