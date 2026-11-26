// The playoff simulation runs once per calendar day. The client sends its
// LOCAL date with each dashboard/refresh call (a UTC day would roll over at
// 5pm Pacific — mid-evening for the user); fall back to UTC when absent.

export async function localDayFromRequest(req) {
  try {
    const body = await req.json();
    const d = body && typeof body.localDate === 'string' ? body.localDate : '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  } catch (e) { /* no body or invalid JSON — use the server's UTC day */ }
  return new Date().toISOString().slice(0, 10);
}