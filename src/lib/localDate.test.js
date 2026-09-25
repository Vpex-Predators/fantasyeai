import test from "node:test";
import assert from "node:assert/strict";
import { localDateString } from "./localDate.js";

// Same acceptance check the server uses in base44/shared/simDay.js.
const CACHE_DAY = /^\d{4}-\d{2}-\d{2}$/;

test("localDateString is the local calendar day, not the UTC day", () => {
  // 02:00 UTC on Sep 26 is still Sep 25 in Los Angeles (PDT, UTC-7).
  const instant = new Date("2026-09-26T02:00:00Z");
  const value = localDateString(instant);

  assert.match(value, CACHE_DAY);
  assert.equal(process.env.TZ, "America/Los_Angeles");
  assert.equal(value, "2026-09-25");
  assert.notEqual(value, instant.toISOString().slice(0, 10));
});
