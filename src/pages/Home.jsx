import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Loader2, Lock, Radar } from "lucide-react";
import AppNavBar from "@/components/AppNavBar";
import OpenButton from "@/components/hud/OpenButton";
import GlassBackdrop from "@/components/hud/GlassBackdrop";
import HudStatusBar from "@/components/hud/HudStatusBar";
import FloatingAuthCard from "@/components/fantasy/home/FloatingAuthCard";
import MatchupHero from "@/components/fantasy/home/MatchupHero";
import WaiverLineupCard from "@/components/fantasy/home/WaiverLineupCard";
import WarRoomCard from "@/components/fantasy/home/WarRoomCard";
import TeamStatusCard from "@/components/fantasy/home/TeamStatusCard";
import LeagueRivalsCard from "@/components/fantasy/home/LeagueRivalsCard";
import LeaguePulseCard from "@/components/fantasy/home/LeaguePulseCard";
import AnalystDoorwayCard from "@/components/fantasy/home/AnalystDoorwayCard";
import AiAnalystPanel from "@/components/fantasy/home/AiAnalystPanel";
import { PlayerNameProvider } from "@/components/PlayerNameProvider";
import { localDateString } from "@/lib/localDate";

function LockedSkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="border border-white/10 bg-white/[0.03] p-4 opacity-40 blur-[3px]">
          <div className="mb-2 h-2 w-28 bg-white/25" />
          <div className="space-y-1.5">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="h-5 bg-white/15" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke("getDashboardData", { localDate: localDateString() });
        if (!cancelled) {
          setData(res.data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || err.message || "Could not load your briefing.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const loadingBriefing = isLoadingAuth || (isAuthenticated && loading && !data);
  const d = data && data.locked ? data : null;

  return (
    <div className="min-h-screen bg-slate-950 pb-[calc(env(safe-area-inset-bottom)+7rem)] text-white">
      <GlassBackdrop />
      <HudStatusBar
        title="Command center"
        sub={d ? `${d.league.name.trim()} · WK ${d.league.week} · ${d.myTeam.wins}-${d.myTeam.losses}` : "Live scores, odds & waiver picks"}
        tag={d ? "LIVE" : "STANDBY"}
      />

      <div className="relative z-10 mx-auto max-w-2xl space-y-2.5 px-3 pt-3">
        <FloatingAuthCard />

        {loadingBriefing ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
          </div>
        ) : !isAuthenticated ? (
          <>
            <p className="flex items-center justify-center gap-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
              <Radar className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              Matchup, waiver & league previews load here
            </p>
            <LockedSkeleton />
          </>
        ) : error ? (
          <div className="border border-rose-400/30 bg-rose-400/10 p-3 font-mono text-xs text-rose-300">{error}</div>
        ) : data && !data.locked ? (
          <div className="border border-emerald-400/25 bg-emerald-400/10 p-5 text-center">
            <Lock className="mx-auto h-6 w-6 text-emerald-300" />
            <p className="mt-2 font-heading text-sm font-bold uppercase tracking-widest text-white">
              Lock in your team to activate the briefing
            </p>
            <p className="mt-1 text-xs text-white/50">One-time verification anchors your account to your roster.</p>
            <Link
              to="/dashboard"
              className="no-callout mt-3 inline-flex"
            >
              <OpenButton>Go to my team</OpenButton>
            </Link>
          </div>
        ) : d ? (
          <PlayerNameProvider
            names={[...(d.myTeam.starters || []), ...(d.myTeam.bench || []), ...(d.opponentStarters || [])].map(p => p.name)}
          >
            <MatchupHero data={d} delay={0} />
            <WaiverLineupCard data={d} delay={90} />
            <WarRoomCard data={d} delay={180} />
            <TeamStatusCard data={d} delay={270} />
            <LeagueRivalsCard data={d} delay={360} />
            <LeaguePulseCard data={d} delay={450} />
            <AnalystDoorwayCard delay={540} />
            <AiAnalystPanel data={d} delay={630} />
          </PlayerNameProvider>
        ) : null}

        <footer className="flex items-center justify-center gap-3 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
          <Link to="/about" className="no-callout transition-colors hover:text-white/70">About</Link>
          <span aria-hidden="true">·</span>
          <Link to="/contact" className="no-callout transition-colors hover:text-white/70">Contact</Link>
        </footer>
      </div>
      <AppNavBar />
    </div>
  );
}