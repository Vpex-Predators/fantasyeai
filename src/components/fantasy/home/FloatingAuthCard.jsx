import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Radar, Loader2, LogOut } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import HudPanel from "@/components/hud/HudPanel";
import DeleteAccountDialog from "@/components/DeleteAccountDialog";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function FloatingAuthCard() {
  const { user, isAuthenticated, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const returnTo = safeReturnTo();

  // Independent Vercel preview must not send users through Base44-hosted OAuth.
  if (import.meta.env.VITE_LEAGUE_API_URL) {
    return <HudPanel>
      <div className="space-y-3">
        <div className="flex items-center gap-2"><Radar className="h-5 w-5 text-emerald-400"/><h1 className="font-heading text-base font-bold text-white">FantasyEAi · Your leagues</h1></div>
        <p className="text-sm text-white/65">Connect ESPN or Sleeper leagues and lock your team to your own account.</p>
        <Link to="/leagues" className="flex min-h-[48px] items-center justify-center rounded bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950">Open account & league sign-in</Link>
      </div>
    </HudPanel>;
  }

  // Signed in — collapse into a compact command profile chip.
  if (isAuthenticated && user) {
    return (
      <div className="no-callout flex items-center gap-2 border border-white/10 bg-white/[0.04] px-3 py-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-emerald-400/40 bg-emerald-400/10 text-xs font-bold text-emerald-300">
          {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold uppercase tracking-wider text-white">{user.full_name || "Commander"}</p>
          <p className="truncate font-mono text-[10px] text-white/45">{user.email}</p>
        </div>
        <DeleteAccountDialog />
        <button
          onClick={() => logout()}
          className="flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-bold uppercase tracking-[0.15em] text-white/50 hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Invalid email or password");
      setLoading(false);
    }
  };

  return (
    <HudPanel>
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-emerald-400 text-slate-950">
          <Radar className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h1 className="font-heading text-sm font-bold uppercase tracking-[0.15em] text-white">
            FantasyEdge <span className="text-emerald-400">AI</span>
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/45">
            Sign in to unlock your tactical briefing
          </p>
        </div>
      </div>

      <button
        onClick={() => base44.auth.loginWithProvider("google", returnTo)}
        className="no-callout mt-4 flex h-11 min-h-[44px] w-full items-center justify-center gap-2 border border-white/15 bg-white/5 text-sm font-bold uppercase tracking-wider text-white hover:bg-white/10"
      >
        <GoogleIcon className="h-4 w-4" /> Continue with Google
      </button>

      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-dashed border-white/15" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-slate-950 px-3 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-2 border border-rose-400/30 bg-rose-400/10 p-2 font-mono text-[10px] text-rose-300">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="email" required autoComplete="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 w-full border border-white/10 bg-white/[0.04] px-3 font-mono text-base text-white outline-none placeholder:text-white/30 focus:border-emerald-400/60"
        />
        <input
          type="password" required autoComplete="current-password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 w-full border border-white/10 bg-white/[0.04] px-3 font-mono text-base text-white outline-none placeholder:text-white/30 focus:border-emerald-400/60"
        />
        <button
          type="submit" disabled={loading}
          className="no-callout flex h-11 min-h-[44px] w-full items-center justify-center gap-2 bg-emerald-400 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Enter command center
        </button>
      </form>

      <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-white/45">
        <Link to="/register" className="hover:text-emerald-300">Create account</Link>
        <Link to="/forgot-password" className="hover:text-emerald-300">Forgot password?</Link>
      </div>
    </HudPanel>
  );
}