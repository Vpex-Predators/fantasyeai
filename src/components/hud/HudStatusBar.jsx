import React from "react";
import { ArrowLeft, Radar } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

// Main bottom-tab roots: these screens are top-level destinations, so the
// status bar never shows a back affordance on them.
const TAB_ROOTS = ["/", "/waivers", "/warroom", "/dashboard", "/analyst"];

// Sticky HUD status bar shared by the briefing and the war room. The top
// safe-area padding keeps it clear of the Android status bar and camera cutout
// under edge-to-edge rendering.
export default function HudStatusBar({ title, sub, tag = "LIVE" }) {
  const { pathname } = useLocation();
  const isTabRoot = TAB_ROOTS.includes(pathname);
  const navigate = useNavigate();
  // Android-style back affordance on non-root screens: go back in history
  // when there is one, otherwise fall back to the briefing.
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/");
  };

  return (
    <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/55 pt-[env(safe-area-inset-top)] backdrop-blur-2xl">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {!isTabRoot && (
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back"
              className="no-callout flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/70 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <Radar className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="truncate font-heading text-sm font-bold uppercase tracking-[0.22em] text-white">{title}</h1>
            {sub && (
              <p className="truncate font-mono text-sm uppercase tracking-[0.12em] text-white/50">{sub}</p>
            )}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-sm font-bold uppercase tracking-[0.18em] text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.25)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
          {tag}
        </span>
      </div>
    </div>
  );
}