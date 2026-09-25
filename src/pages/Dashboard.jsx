import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Loader2 } from "lucide-react";
import AppNavBar from "@/components/AppNavBar";
import GlassBackdrop from "@/components/hud/GlassBackdrop";
import HudStatusBar from "@/components/hud/HudStatusBar";
import HudPanel from "@/components/hud/HudPanel";
import TeamScoreboard from "@/components/fantasy/dashboard/TeamScoreboard";
import TeamLockOverlay from "@/components/fantasy/dashboard/TeamLockOverlay";
import usePullToRefresh from "@/hooks/usePullToRefresh";
import PullIndicator from "@/components/hud/PullIndicator";
import TabFade from "@/components/hud/TabFade";
import RouteFallback from "@/components/RouteFallback";

// Heavy chart chunk loads only when the Season tab is opened.
const SeasonScoreChart = lazy(() => import("@/components/fantasy/dashboard/SeasonScoreChart"));
import MatchupEngine from "@/components/fantasy/dashboard/MatchupEngine";
import RosterCompare from "@/components/fantasy/dashboard/RosterCompare";
import SwapView from "@/components/fantasy/dashboard/SwapView";
import PlayoffRunway from "@/components/fantasy/dashboard/PlayoffRunway";
import LeaguePulse from "@/components/fantasy/dashboard/LeaguePulse";
import AdminPanel from "@/components/fantasy/dashboard/AdminPanel";
import { PlayerNameProvider } from "@/components/PlayerNameProvider";
import { localDateString } from "@/lib/localDate";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [matchup, setMatchup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return ["matchup", "swap", "season", "league"].includes(t) ? t : "matchup";
  });
  const hasTrackedView = useRef(false);
  const loadBoard = useCallback(async () => {
    const res = await base44.functions.invoke("getDashboardData", { localDate: localDateString() });
    setData(res.data);
    if (res.data && !hasTrackedView.current) {
      hasTrackedView.current = true;
      base44.analytics.track({ eventName: "dashboard_viewed" });
    }
    return res.data;
  }, []);

  // Live data loads once per visit — all refreshing is manual (button taps).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadBoard();
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || err.message || "Could not load your dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadBoard]);

  const analyzeOne = async player => {
    setAnalyzing(true);
    try {
      await base44.functions.invoke("analyzePlayers", {
        players: [{
          id: player.id,
          name: player.name,
          position: player.position,
          opponent: data?.opponent ? data.opponent.name : "TBD",
          weeklyProj: player.weeklyProj,
          seasonAvg: player.seasonAvg,
          injuryStatus: player.injuryStatus
        }],
        week: data?.league?.week
      });
      await loadBoard();
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeMatchupNow = async () => {
    setAnalyzing(true);
    try {
      const res = await base44.functions.invoke("analyzeMatchup", {});
      setMatchup(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Manual refresh: cheap live-scores update only — no AI re-analysis.
  const lightRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await base44.functions.invoke("getLiveScores", { localDate: localDateString() });
      const live = res.data;
      const mine = new Map((live.mine || []).map(p => [p.id, p]));
      const opp = new Map((live.opponent || []).map(p => [p.id, p]));
      const merge = (list, map) => (list || []).map(p => {
        const u = map.get(p.id);
        return u ? { ...p, livePoints: u.livePoints, weeklyProj: u.weeklyProj, injuryStatus: u.injuryStatus } : p;
      });
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          lastRefresh: live.refreshedAt || new Date().toISOString(),
          playoffOdds: live.playoffOdds || prev.playoffOdds,
          myTeam: prev.myTeam ? {
            ...prev.myTeam,
            starters: merge(prev.myTeam.starters, mine),
            bench: merge(prev.myTeam.bench, mine)
          } : prev.myTeam,
          opponentStarters: merge(prev.opponentStarters, opp),
          opponentBench: merge(prev.opponentBench, opp)
        };
      });
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Native-style pull-to-refresh: drag down from the top to run the same
  // cheap live-scores refresh as the refresh button.
  const { pull, refreshing: pulling } = usePullToRefresh(lightRefresh);

  // Highlights stay until the user actually opens that card.
  const markSeen = useCallback(keys => {
    if (!keys || !keys.length) return;
    setData(prev => (prev ? { ...prev, pending: (prev.pending || []).filter(k => !keys.includes(k)) } : prev));
    base44.functions.invoke("markUpdatesSeen", { keys }).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-white">
        <p className="text-sm text-white/60">{error}</p>
        <button
          onClick={() => loadBoard().catch(err => setError(err.response?.data?.error || err.message))}
          className="rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950"
        >
          Try again
        </button>
        <AppNavBar />
      </div>
    );
  }

  if (!data.locked) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
        <GlassBackdrop />
        <HudStatusBar title="My team command" sub={`${data.league.name.trim()} · WK ${data.league.week}`} tag="STANDBY" />
        <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400/80">
            {data.league.name} · Week {data.league.week}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-bold">Your live league HQ</h1>
          <p className="mt-2 max-w-xs text-sm text-white/50">
            Live scores, projections, matchup intel, waiver radar — all locked to your team.
          </p>
          {error && <p className="mt-4 max-w-xs text-xs text-rose-300">{error}</p>}
        </div>
        <TeamLockOverlay teams={data.teams} onLocked={() => loadBoard().catch(() => {})} />
        <AppNavBar />
      </div>
    );
  }

  // This week's headline score: actual points for games live/over, projections before kickoff.
  const eff = p => (p.livePoints != null ? p.livePoints : (p.weeklyProj || 0));
  const myScore = (data.myTeam.starters || []).reduce((s, p) => s + eff(p), 0);
  const oppScore = (data.opponentStarters || []).reduce((s, p) => s + eff(p), 0);
  const anyLive = [...(data.myTeam.starters || []), ...(data.opponentStarters || [])].some(p => p.livePoints != null);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 pb-[calc(env(safe-area-inset-bottom)+7rem)] text-white">
      <GlassBackdrop />
      <HudStatusBar
        title="My team command"
        sub={`${data.league.name.trim()} · WK ${data.league.week} · ${data.myTeam.name.trim()}`}
        tag={anyLive ? "LIVE" : "READY"}
      />
      <PullIndicator pull={pull} refreshing={pulling} />
      <PlayerNameProvider
        names={[
          ...(data.myTeam?.starters || []),
          ...(data.myTeam?.bench || []),
          ...(data.opponentStarters || []),
          ...(data.opponentBench || [])
        ].map(p => p.name)}
      >
      <div className="relative z-10 mx-auto max-w-2xl space-y-3 px-3 pt-3">
        {error && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-300">{error}</div>
        )}

        <TeamScoreboard
          data={data}
          myScore={myScore}
          oppScore={oppScore}
          anyLive={anyLive}
          refreshing={refreshing}
          analyzing={analyzing}
          onRefresh={lightRefresh}
        />

        <div className="grid grid-cols-4 gap-1 rounded-full border border-white/10 bg-white/[0.05] p-1 backdrop-blur-xl">
          {[
            { id: "matchup", label: "This week" },
            { id: "swap", label: "Swap" },
            { id: "season", label: "Season" },
            { id: "league", label: "League" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`no-callout min-h-[44px] rounded-full px-1 text-sm font-bold uppercase tracking-[0.15em] transition-all duration-300 ${
                tab === t.id
                  ? "bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 shadow-[0_0_16px_rgba(52,211,153,0.45)]"
                  : "text-white/55 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <TabFade tabKey={tab}>
        {tab === "season" ? (
          <>
            <HudPanel label="Season totals">
              <p className="text-sm text-white/70">
                <span className="font-semibold text-white">{data.myTeam.pointsFor} pts for</span> ·{" "}
                <span className="font-semibold text-white">{data.myTeam.pointsAgainst} against</span>
              </p>
              <p className="mt-0.5 text-[10px] text-white/60">Starters-only scoring across completed weeks.</p>
            </HudPanel>
            <Suspense fallback={<RouteFallback compact />}>
              <SeasonScoreChart
                myTeam={data.myTeam}
                teams={data.teams}
                headToHead={data.headToHead}
                weeklyScores={data.weeklyScores}
              />
            </Suspense>
          </>
        ) : tab === "swap" ? (
          <SwapView starters={data.myTeam.starters} bench={data.myTeam.bench} />
        ) : tab === "league" ? (
          <LeaguePulse pulse={data.leaguePulse} teams={data.teams} myTeam={data.myTeam} />
        ) : (
          <>
            <MatchupEngine
              myTeam={data.myTeam}
              opponent={data.opponent}
              opponentStarters={data.opponentStarters}
              opponentBench={data.opponentBench}
              matchup={matchup}
              week={data.league.week}
              analyzing={analyzing}
              onAnalyze={analyzeMatchupNow}
              pending={data.pending}
              onSeen={markSeen}
            />

            <RosterCompare
              starters={data.myTeam.starters}
              bench={data.myTeam.bench}
              pending={data.pending}
              onSeen={markSeen}
              onAnalyze={analyzeOne}
              analyzing={analyzing}
            />

            <PlayoffRunway playoffOdds={data.playoffOdds} />

            <AdminPanel isAdmin={user?.role === "admin"} teams={data.teams} />
          </>
        )}
        </TabFade>
      </div>
      </PlayerNameProvider>
      <AppNavBar />
    </div>
  );
}