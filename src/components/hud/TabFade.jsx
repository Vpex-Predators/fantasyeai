import React from "react";
import { AnimatePresence, motion } from "framer-motion";

// Subtle crossfade between inner tabs (Dashboard / War Room) keyed on the
// active tab id, so tab switches don't refetch or jump.
export default function TabFade({ tabKey, children }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={tabKey}
        // Reserved height keeps the page from collapsing (and the viewport
        // jumping) when a shorter tab replaces a taller one.
        className="min-h-[45vh]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}