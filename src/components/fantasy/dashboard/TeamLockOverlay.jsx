import React, { useState } from "react";
import { invokeAppFunction } from "@/api/appBackend";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TeamLockOverlay({ teams, onLocked }) {
  const [teamId, setTeamId] = useState(null);
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const selected = (teams || []).find(t => t.id === teamId);

  const handleLock = async () => {
    if (!teamId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await invokeAppFunction("lockTeam", {
        team_id: teamId,
        espn_email: email,
        birthday
      });
      onLocked();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/85 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl">
        <div className="mb-1 flex items-center gap-2 text-emerald-400">
          <Lock className="h-4 w-4" />
          <span className="text-[11px] font-semibold uppercase tracking-widest">Pick your team</span>
        </div>
        <h2 className="font-heading text-xl font-bold text-white">Which team is yours?</h2>
        <p className="mt-1 text-xs text-white/50">Pick once — it locks to your account for the season.</p>

        <div className="mt-4 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-0.5">
          {(teams || []).map(t => (
            <button
              key={t.id}
              onClick={() => setTeamId(t.id)}
              className={`rounded-xl border p-3 text-left transition-all ${
                teamId === t.id
                  ? "border-emerald-400 bg-emerald-400/10 shadow-lg shadow-emerald-500/20"
                  : "border-white/10 bg-white/5 hover:border-white/25"
              }`}
            >
              <div className="truncate text-sm font-semibold text-white">{t.name}</div>
              <div className="text-[11px] text-white/50">{t.wins}-{t.losses}</div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="espn-email" className="text-xs text-white/70">ESPN account email</Label>
              <Input
                id="espn-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="border-white/15 bg-white/5 text-white placeholder:text-white/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="espn-birthday" className="text-xs text-white/70">Birthday</Label>
              <Input
                id="espn-birthday"
                type="date"
                value={birthday}
                onChange={e => setBirthday(e.target.value)}
                className="border-white/15 bg-white/5 text-white"
              />
            </div>
            <p className="text-[11px] text-amber-300/80">
              Confirming with your ESPN email + birthday locks this pick. One pick per account — an admin can fix it later if needed.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 p-2.5 text-xs text-rose-300">{error}</div>
        )}

        <Button
          onClick={handleLock}
          disabled={!teamId || !email || !birthday || submitting}
          className="mt-4 w-full bg-emerald-400 py-5 text-sm font-bold text-slate-950 hover:bg-emerald-300"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {submitting ? "Locking your team…" : `Lock in ${selected ? selected.name : "your team"}`}
        </Button>
      </div>
    </div>
  );
}