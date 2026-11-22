import React, { useState } from "react";
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, ReferenceArea } from "recharts";

const COLORS = { me: "#34d399", opp: "#fbbf24", vs: "#60a5fa", loss: "#f43f5e" };

function ChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-bold text-white">Week {row.week}</p>
      <p className="text-emerald-300">You · <span className="font-semibold">{row.mine} pts</span></p>
      <p className="text-amber-300">{row.oppName} · <span className="font-semibold">{row.opp} pts</span></p>
      {row.vs !== undefined && (
        <p className="text-sky-300">{row.vsName} · <span className="font-semibold">{row.vs} pts</span></p>
      )}
      <p className={`mt-1 font-bold ${row.win ? "text-emerald-400" : "text-rose-400"}`}>
        {row.win ? "WIN" : "LOSS"}
      </p>
    </div>
  );
}

export default function SeasonScoreChart({ myTeam, teams, headToHead, weeklyScores }) {
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [visible, setVisible] = useState({ me: true, opp: true, vs: true });
  const [selectedWeek, setSelectedWeek] = useState(null);

  const games = headToHead || [];
  const wins = games.filter(g => g.win).length;
  const losses = games.length - wins;
  const otherTeams = (teams || []).filter(t => t.id !== myTeam?.id);

  const chartData = games.map(g => {
    const row = { ...g };
    if (selectedOpp) {
      const oppWeek = ((weeklyScores || {})[selectedOpp.id] || []).find(w => w.week === g.week);
      if (oppWeek) {
        row.vs = oppWeek.points;
        row.vsName = selectedOpp.name;
      }
    }
    return row;
  });

  const detail = chartData.find(r => r.week === selectedWeek) || null;

  const seriesChips = [
    { key: "me", label: myTeam?.name || "My score", color: COLORS.me },
    { key: "opp", label: "Weekly opponent", color: COLORS.opp },
    ...(selectedOpp ? [{ key: "vs", label: `vs ${selectedOpp.name}`, color: COLORS.vs }] : [])
  ];

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-heading text-sm font-bold uppercase tracking-widest text-white/80">Season scoring</h2>
        <span className={`text-sm font-bold ${wins > losses ? "text-emerald-400" : "text-white/40"}`}>
          {wins}-{losses} head-to-head
        </span>
      </div>

      <div className="scroll-strip -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {otherTeams.map(t => (
          <button
            key={t.id}
            onClick={() => setSelectedOpp(s => (s && s.id === t.id ? null : t))}
            className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-sm transition-colors ${
              selectedOpp?.id === t.id
                ? "border-sky-400 bg-sky-400/20 text-sky-200"
                : "border-white/15 bg-white/5 text-white/60"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {games.length < 1 ? (
        <p className="py-8 text-center text-xs text-white/50">
          Not enough games yet — the chart appears after week 1.
        </p>
      ) : (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
              {chartData.map(r => (
                <ReferenceArea
                  key={r.week}
                  x1={r.week - 0.45}
                  x2={r.week + 0.45}
                  fill={r.win ? COLORS.me : COLORS.loss}
                  fillOpacity={0.05}
                />
              ))}
              <XAxis
                dataKey="week"
                type="number"
                domain={[0.5, chartData.length + 0.5]}
                ticks={chartData.map(r => r.week)}
                tick={{ fill: "currentColor", fontSize: 14, className: "text-white/60" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "currentColor", fontSize: 14, className: "text-white/60" }}
                axisLine={false}
                tickLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<ChartTooltip />} />
              {visible.opp && (
                <Line type="monotone" dataKey="opp" name="Weekly opponent" stroke={COLORS.opp} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              )}
              {selectedOpp && visible.vs && (
                <Line type="monotone" dataKey="vs" name={selectedOpp.name} stroke={COLORS.vs} strokeWidth={2} dot={false} connectNulls />
              )}
              {visible.me && (
                <Line
                  type="monotone"
                  dataKey="mine"
                  name="My score"
                  stroke={COLORS.me}
                  strokeWidth={2.5}
                  animationDuration={1600}
                  animationEasing="ease-out"
                  dot={({ cx, cy, payload }) =>
                    cx == null || cy == null ? null : (
                      <g
                        key={payload.week}
                        onClick={() => setSelectedWeek(w => (w === payload.week ? null : payload.week))}
                        style={{ cursor: "pointer" }}
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={selectedWeek === payload.week ? 5.5 : 3.5}
                          fill={payload.win ? COLORS.me : COLORS.loss}
                          stroke={selectedWeek === payload.week ? "#ffffff" : "#0f172a"}
                          strokeWidth={selectedWeek === payload.week ? 2 : 1}
                        />
                      </g>
                    )
                  }
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {detail && (
        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
          <p className="font-bold text-white">Week {detail.week} vs {detail.oppName}</p>
          <p className="mt-0.5 text-white/70">
            You <span className="font-semibold text-emerald-300">{detail.mine}</span> — {detail.opp} ·{" "}
            <span className={detail.win ? "font-bold text-emerald-400" : "font-bold text-rose-400"}>
              {detail.win ? "WIN" : "LOSS"}
            </span>{" "}
            by {Math.abs(detail.mine - detail.opp).toFixed(1)}
            {detail.vs !== undefined && <> · {detail.vsName} scored {detail.vs} that week</>}
          </p>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {seriesChips.map(chip => (
          <button
            key={chip.key}
            onClick={() => setVisible(v => ({ ...v, [chip.key]: !v[chip.key] }))}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors ${
              visible[chip.key] ? "border-white/15 bg-white/10 text-white/80" : "border-white/10 text-white/30"
            }`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: visible[chip.key] ? chip.color : "rgba(255,255,255,0.2)" }}
            />
            {chip.label}
          </button>
        ))}
      </div>

      <p className="mt-2 text-sm text-white/40">
        Tap a team to overlay their season — tap again to clear. Tap any week dot for that game's result.
      </p>
    </section>
  );
}