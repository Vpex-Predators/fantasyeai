import React, { useEffect, useRef, useState } from "react";
import { GLOSSARY } from "@/lib/glossary";

// Tap-to-reveal glossary term: dotted-underline text that toggles a one-line
// plain-English definition inline. Pass `bare` to drop the underline when
// wrapping text that already has its own visual treatment (e.g. a badge).
export default function GlossaryChip({ term, children, bare = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const def = GLOSSARY[term];

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onClick);
    return () => document.removeEventListener("pointerdown", onClick);
  }, [open]);

  if (!def) return children ?? term;

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`no-callout ${bare ? "" : "border-b border-dotted border-white/40"} font-inherit text-inherit outline-none ${className}`}
      >
        {children ?? term}
      </button>
      {open && (
        <span
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full z-50 mt-1 w-52 rounded-lg border border-emerald-400/30 bg-slate-900/95 px-2.5 py-2 text-sm font-normal normal-case leading-snug text-white/80 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        >
          {def}
        </span>
      )}
    </span>
  );
}