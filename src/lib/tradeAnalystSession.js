const STORAGE_KEY = "fantasyeai_trade_analyst_v1";

export function loadTradeAnalystMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    );
  } catch {
    return [];
  }
}

export function saveTradeAnalystMessages(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-80)));
  } catch {
    /* quota / private mode */
  }
}

export function clearTradeAnalystMessages() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}