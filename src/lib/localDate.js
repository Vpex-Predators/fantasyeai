// Calendar day in the viewer's timezone, as YYYY-MM-DD.
// The playoff-odds cache keys off this string. A UTC day rolls over at
// 5pm Pacific, so callers must send this instead of letting the server guess.
export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
