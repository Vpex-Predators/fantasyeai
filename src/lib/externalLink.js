// Opens a link outside the app when it is wrapped (Capacitor Browser plugin
// uses Chrome Custom Tabs on Android). On the plain web the anchor's own
// target="_blank" behaviour is left untouched.
export function openExternal(url, event) {
  if (!url) return;
  const browser = typeof window !== "undefined" ? window.Capacitor?.Plugins?.Browser : null;
  if (browser?.open) {
    event?.preventDefault?.();
    Promise.resolve(browser.open({ url, presentationStyle: "popover" })).catch(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }
}