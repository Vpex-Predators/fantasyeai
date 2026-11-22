// Per-tab navigation memory for the bottom bar.
//
// The app is a single-level router (one route per tab), so a "stack" here is
// the list of in-tab URLs visited (a tab can carry a query string such as
// ?compare=... or ?tab=season). Keeping the store at module scope lets it
// survive the unmount/remount that happens on every route change.

export const TAB_ROOTS = ["/", "/waivers", "/warroom", "/dashboard", "/analyst"];

const MAX_STACK = 12;

const store = {
  stacks: Object.fromEntries(TAB_ROOTS.map((root) => [root, [root]])),
  scroll: Object.fromEntries(TAB_ROOTS.map((root) => [root, 0])),
  restore: null,
};

export function tabForPath(pathname) {
  return TAB_ROOTS.includes(pathname) ? pathname : null;
}

// Record where the user is inside a tab. Consecutive duplicates collapse, so
// re-rendering the same route never grows the stack.
export function recordLocation(pathname, search = "") {
  const tab = tabForPath(pathname) || "/";
  const url = `${pathname}${search || ""}`;
  const stack = store.stacks[tab];
  if (stack[stack.length - 1] !== url) {
    stack.push(url);
    if (stack.length > MAX_STACK) stack.splice(1, stack.length - MAX_STACK);
  }
  return tab;
}

export function stackDepth(tab) {
  return (store.stacks[tab] || [tab]).length;
}

export function setScroll(tab, y) {
  if (tab) store.scroll[tab] = Math.max(0, y || 0);
}

export function getScroll(tab) {
  return store.scroll[tab] || 0;
}

// Re-tapping the active tab: back to its root route and to the top.
export function resetTab(tab) {
  store.stacks[tab] = [tab];
  store.scroll[tab] = 0;
}

// Switching tabs: remember where the target tab was left.
export function requestRestore(tab) {
  store.restore = { tab, y: getScroll(tab) };
}

// Read once — the scroll restorer consumes it so normal navigations still
// start at the top.
export function takeRestore() {
  const pending = store.restore;
  store.restore = null;
  return pending;
}