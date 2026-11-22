import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { takeRestore } from "@/lib/tabNavigation";

const getHashId = (hash) => {
  const rawId = hash.slice(1);

  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
};

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "POP") return;

    if (hash) {
      const id = getHashId(hash);
      const timer = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => window.clearTimeout(timer);
    }

    // A tab switch restores that tab's last offset. Content may still be
    // loading, so retry for a few frames until the page is tall enough.
    const restore = takeRestore();
    if (restore && restore.y > 0) {
      let frame = 0;
      let attempts = 0;
      const tick = () => {
        window.scrollTo({ top: restore.y, left: 0, behavior: "instant" });
        attempts += 1;
        if (attempts < 40 && Math.abs(window.scrollY - restore.y) > 2) {
          frame = requestAnimationFrame(tick);
        }
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash, navigationType]);

  return null;
}