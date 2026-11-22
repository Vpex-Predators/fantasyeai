import React from "react";

const normalize = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const position = value => normalize(value);
const format = value => typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "—";

export default function WaiverPlayerNumbers({ target, players = [] }) {
  const candidates = players.filter(player => position(player.position) === position(target.position));
  const name = normalize(target.name);
  const exact = candidates.filter(player => normalize(player.name) === name);
  const defenses = position(target.position) === "dst" ? candidates.filter(player => {
    const wireName = normalize(player.name).replace(/dst$/, "");
    const targetName = name.replace(/dst$/, "");
    return wireName && targetName && (wireName.endsWith(targetName) || targetName.endsWith(wireName));
  }) : [];
  const player = exact.length === 1 ? exact[0] : defenses.length === 1 ? defenses[0] : null;
  const metrics = [
    ["Week proj.", format(player?.weeklyProj)],
    ["Season total", format(player?.seasonProj)],
    ["Owned", player?.percentOwned != null ? `${format(player.percentOwned)}%` : "—"],
  ];

  return (
    <div className="mx-3 mb-2.5 border-t border-border pt-2 text-foreground">
      <dl className="grid grid-cols-3 gap-2">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="font-mono text-sm font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-sm text-muted-foreground">
        {player ? "ESPN · Season total is not a remaining-season projection." : "ESPN numbers unavailable — no unique player match."}
      </p>
    </div>
  );
}