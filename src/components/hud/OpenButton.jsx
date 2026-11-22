import React from "react";
import { ArrowRight } from "lucide-react";

// Off-white "cloud" pill that marks a card as a doorway. Rendered as a span
// because the whole card is already the link — this is the obvious visual cue.
export default function OpenButton({ children, className = "" }) {
  return (
    <span className={`cloud-btn no-callout inline-flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${className}`}>
      {children}
      <ArrowRight className="h-4 w-4" />
    </span>
  );
}