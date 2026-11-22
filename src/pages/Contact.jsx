import React, { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import GlassBackdrop from "@/components/hud/GlassBackdrop";
import HudStatusBar from "@/components/hud/HudStatusBar";
import HudPanel from "@/components/hud/HudPanel";

const inputClass =
  "w-full rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-emerald-400/50";

// Public Contact page — a working message form routed to the app owner.
export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && message.trim().length >= 10;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    try {
      await base44.functions.invoke("sendContactMessage", {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || "Could not send your message — try again shortly.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen-safe bg-slate-950 pb-[calc(env(safe-area-inset-bottom)+7rem)] text-white">
      <GlassBackdrop />
      <HudStatusBar title="Contact" sub="Feedback, bugs & questions" tag="INFO" />

      <div className="relative z-10 mx-auto max-w-2xl space-y-2.5 px-3 pt-3">
        <HudPanel label="Get in touch">
          <h1 className="font-heading text-lg font-bold tracking-tight text-white">Contact us</h1>
          {sent ? (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-3 text-sm text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Message sent — we'll get back to you at the email you provided.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-3 space-y-2.5">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                maxLength={80}
                className={inputClass}
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                maxLength={120}
                className={inputClass}
              />
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's on your mind? (at least 10 characters)"
                maxLength={2000}
                className={`${inputClass} resize-none`}
              />
              {error && (
                <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-300">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={!valid || sending}
                className="no-callout flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/15 px-3 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300 transition-colors hover:bg-emerald-400/25 disabled:opacity-40"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? "Sending…" : "Send message"}
              </button>
              <p className="text-sm text-white/45">
                Your message goes straight to the app owner — no newsletter, no spam.
              </p>
            </form>
          )}
        </HudPanel>
      </div>
    </div>
  );
}