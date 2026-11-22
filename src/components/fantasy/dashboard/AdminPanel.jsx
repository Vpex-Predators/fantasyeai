import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select as UiSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminPanel({ isAdmin, teams }) {
  const [open, setOpen] = useState(false);
  const [locks, setLocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("adminTeamLocks", { action: "list" });
      setLocks(res.data.locks || []);
    } catch {
      /* admin-only panel */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && isAdmin) load();
  }, [open, isAdmin]);

  if (!isAdmin) return null;

  const update = (id, field, value) =>
    setLocks(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)));

  const saveLock = async lock => {
    setBusyId(lock.id);
    try {
      await base44.functions.invoke("adminTeamLocks", {
        action: "update",
        lock_id: lock.id,
        team_id: lock.team_id,
        team_name: (teams || []).find(t => t.id === String(lock.team_id))?.name || lock.team_name,
        espn_email: lock.espn_email,
        birthday: lock.birthday
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const unlock = async lock => {
    if (!window.confirm(`Unlock ${lock.email}'s team pick? They'll be able to pick again.`)) return;
    setBusyId(lock.id);
    try {
      await base44.functions.invoke("adminTeamLocks", { action: "delete", lock_id: lock.id });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-amber-300">
          <ShieldCheck className="h-4 w-4" /> Admin
        </span>
        <span className="text-xs text-white/50">{open ? "Hide" : "Manage picks"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {loading && (
            <p className="flex items-center gap-2 text-xs text-white/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading picks…
            </p>
          )}
          {!loading && locks.length === 0 && <p className="text-xs text-white/50">No team picks yet.</p>}
          {locks.map(l => (
            <div key={l.id} className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold text-white/80">{l.email}</p>
                <button
                  onClick={() => unlock(l)}
                  disabled={busyId === l.id}
                  className="rounded-lg p-1.5 text-rose-300 hover:bg-rose-400/10"
                  title="Unlock this pick"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <UiSelect value={String(l.team_id || "")} onValueChange={v => update(l.id, "team_id", v)}>
                  <SelectTrigger
                    aria-label={`Team pick for ${l.email}`}
                    className="h-8 rounded-md border-white/15 bg-slate-900 px-2 text-sm text-white shadow-none"
                  >
                    <SelectValue placeholder="Team" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-slate-900 text-white">
                    {(teams || []).map(t => (
                      <SelectItem key={t.id} value={String(t.id)} className="text-sm text-white/85 focus:bg-white/10 focus:text-white">
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </UiSelect>
                <Input
                  type="date"
                  value={(l.birthday || "").slice(0, 10)}
                  onChange={e => update(l.id, "birthday", e.target.value)}
                  className="h-8 border-white/15 bg-slate-900 text-sm text-white"
                />
                <Input
                  value={l.espn_email || ""}
                  onChange={e => update(l.id, "espn_email", e.target.value)}
                  placeholder="ESPN email"
                  className="h-8 border-white/15 bg-slate-900 text-sm text-white"
                />
                <Button
                  onClick={() => saveLock(l)}
                  disabled={busyId === l.id}
                  size="sm"
                  className="h-8 bg-amber-400 text-sm font-bold text-slate-950 hover:bg-amber-300"
                >
                  {busyId === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
          ))}
          <p className="text-sm text-white/40">
            You can fix birthdays, ESPN emails, wrong team picks, or unlock a pick entirely.
          </p>
        </div>
      )}
    </section>
  );
}