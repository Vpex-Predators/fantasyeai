import React from "react";
import { Link } from "react-router-dom";
import GlassBackdrop from "@/components/hud/GlassBackdrop";
import HudStatusBar from "@/components/hud/HudStatusBar";
import HudPanel from "@/components/hud/HudPanel";

// Public About page — what the app does, who it's for, and who builds it.
export default function About() {
  return (
    <div className="min-h-screen-safe bg-slate-950 pb-[calc(env(safe-area-inset-bottom)+7rem)] text-white">
      <GlassBackdrop />
      <HudStatusBar title="About" sub="What this app is & who it's for" tag="INFO" />

      <div className="relative z-10 mx-auto max-w-2xl space-y-2.5 px-3 pt-3">
        <HudPanel label="About FantasyEdge AI">
          <h1 className="font-heading text-lg font-bold tracking-tight text-white">FantasyEdge AI</h1>
          <p className="mt-1 font-mono text-sm uppercase tracking-[0.16em] text-emerald-300/70">
            NFL fantasy companion · numbers over vibes
          </p>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/75">
            <p>
              FantasyEdge AI is a fantasy football companion for NFL managers who want decisions backed
              by numbers, not vibes. Connect your ESPN league once and the app reads your live roster,
              matchups, projections, and scoring every time you open it — no manual stats entry, no
              screenshots required.
            </p>
            <p>
              The Command Center gives you a one-screen briefing: your matchup with live win
              probability, waiver targets for your weakest spots, your opponent's biggest threat, and
              your projected start/sit edge. The Waiver Wire surfaces high-upside free agents ranked by
              fit with your roster. The War Room breaks down the week's opponent with threat boards,
              power rankings, and trade simulations. The Trade Analyst answers plain-English questions
              using your real league numbers, and League Pulse scans the whole season's transactions
              for suspicious patterns — repeat trade partners, tanking, and wire games — as flags, not
              accusations.
            </p>
            <p>
              It's built by a small independent team of fantasy managers and engineers who got tired of
              night-before-lineup spreadsheet panic and wanted a tool that does the math for everyone
              in the league. Every recommendation shows its confidence level, and the app never invents
              stats — it works from your league's real data.
            </p>
          </div>
        </HudPanel>

        <HudPanel label="Questions">
          <p className="text-sm text-white/70">
            Feedback, bug reports, or league war stories — we read everything.
          </p>
          <Link
            to="/contact"
            className="no-callout mt-2.5 inline-flex rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-300 transition-colors hover:bg-emerald-400/20"
          >
            Contact us
          </Link>
        </HudPanel>
      </div>
    </div>
  );
}