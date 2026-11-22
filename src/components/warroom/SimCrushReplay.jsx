import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TradeOdds from "@/components/warroom/TradeOdds";

export default function SimCrushReplay({ odds, myName, partnerName }) {
  const [count, setCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const mine = Number(odds.after?.mine?.playoffPct) || 0;
  const theirs = Number(odds.after?.partner?.playoffPct) || 0;
  const loser = mine === theirs ? null : mine < theirs ? "mine" : "partner";

  useEffect(() => {
    setCount(0);
    setFinished(false);
    const started = performance.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - started) / 1400);
      setCount(Math.floor(1000 * progress));
      if (progress === 1) {
        clearInterval(timer);
        setFinished(true);
      }
    }, 28);
    return () => clearInterval(timer);
  }, [odds]);

  return (
    <AnimatePresence mode="wait">
      {!finished ? (
        <motion.div key="replay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} className="overflow-hidden border border-emerald-400/25 bg-slate-950/85 p-4 text-center shadow-[0_0_28px_rgba(52,211,153,0.12)]">
          <p className="font-heading text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">Running season outcomes</p>
          <p className="mt-2 font-mono text-5xl font-bold tabular-nums text-white">{count.toLocaleString()}</p>
          <div className="mt-3 h-1.5 overflow-hidden bg-white/10"><motion.div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400" animate={{ width: `${count / 10}%` }} /></div>
          <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm uppercase text-white/55"><span>{myName}</span><span>{partnerName}</span></div>
        </motion.div>
      ) : (
        <motion.div key="result" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
          <motion.div animate={loser ? { x: [0, -7, 7, -4, 4, 0] } : {}} transition={{ duration: 0.45 }}>
            <TradeOdds odds={odds} myName={myName} partnerName={partnerName} crushedSide={loser} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}