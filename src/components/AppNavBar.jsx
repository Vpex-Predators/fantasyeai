import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Crosshair, LayoutDashboard, Calculator, Radar, Swords } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import {
  recordLocation,
  tabForPath,
  setScroll,
  resetTab,
  requestRestore,
  stackDepth,
} from "@/lib/tabNavigation";

const ITEMS = [
  { to: "/", label: "Command", icon: Crosshair },
  { to: "/waivers", label: "Waivers", icon: Radar },
  { to: "/warroom", label: "War Room", icon: Swords },
  { to: "/dashboard", label: "Team", icon: LayoutDashboard },
  { to: "/analyst", label: "Analyst", icon: Calculator },
];

// Fixed, non-scrolling bottom bar: five equal cloudy tabs plus the theme toggle.
// Each tab keeps its own route stack and scroll offset; Android Back walks the
// active tab out to Home before the OS is allowed to exit.
export default function AppNavBar() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const activeTab = tabForPath(pathname) || "/";
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // Remember the in-tab route history.
  useEffect(() => {
    recordLocation(pathname, search);
  }, [pathname, search]);

  // Remember each tab's scroll offset (rAF-throttled, removed on unmount).
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setScroll(tabForPath(window.location.pathname) || "/", window.scrollY);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Android hardware / gesture Back (WebView + TWA popstate).
  useEffect(() => {
    const onPopState = () => {
      const tab = tabForPath(window.location.pathname);
      // Home root: let the platform exit/minimize.
      if (!tab || tab === "/") return;
      // Deeper in this tab: the router pops within it.
      if (stackDepth(tab) > 1) return;
      // At a secondary tab root: land on Home instead of leaving the app.
      window.history.pushState({ __tabGuard: true }, "", window.location.href);
      navigate("/", { replace: true });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [navigate]);

  // Native Capacitor wrapper, when one is present: same rules, via its plugin.
  useEffect(() => {
    const appPlugin = typeof window !== "undefined" ? window.Capacitor?.Plugins?.App : null;
    if (!appPlugin?.addListener) return;
    let subscription;
    try {
      subscription = appPlugin.addListener("backButton", ({ canGoBack } = {}) => {
        const tab = tabForPath(window.location.pathname);
        if (tab && tab !== "/" && stackDepth(tab) <= 1) {
          navigate("/", { replace: true });
          return;
        }
        if (canGoBack) window.history.back();
        else appPlugin.exitApp?.();
      });
    } catch {
      return;
    }
    return () => {
      Promise.resolve(subscription).then((handle) => handle?.remove?.()).catch(() => {});
    };
  }, [navigate]);

  const handleTabTap = (e, to) => {
    // Re-tapping the active tab: back to its root route and to the top.
    if (to === activeTabRef.current) {
      e.preventDefault();
      resetTab(to);
      navigate(to, { replace: true });
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      window.scrollTo({ top: 0, left: 0, behavior: reduceMotion ? "auto" : "smooth" });
      return;
    }
    // Switching tabs: hand the target tab's saved offset to the restorer.
    setScroll(activeTabRef.current, window.scrollY);
    requestRestore(to);
  };

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-[calc(0.625rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-2">
      <div className="no-callout pointer-events-auto flex w-full max-w-md items-center gap-1 rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-1 shadow-[0_8px_28px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
        <div className="grid min-w-0 flex-1 grid-cols-5 gap-1">
          {ITEMS.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={(e) => handleTabTap(e, to)}
                aria-current={active ? "page" : undefined}
                className={`cloud-tab no-callout flex min-h-[48px] min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-sm font-semibold leading-none tracking-tight ${
                  active ? "cloud-tab--active" : ""
                }`}
              >
                <Icon className="h-[17px] w-[17px]" aria-hidden="true" />
                <span className="nav-label whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="flex w-8 shrink-0 justify-center [&>button]:w-8">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}