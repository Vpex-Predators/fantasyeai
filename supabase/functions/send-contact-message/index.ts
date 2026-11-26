import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, jsonResponse, sendContactEmail } from "../_shared/auth.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const name = String(body.name || "").trim().slice(0, 80);
    const email = String(body.email || "").trim().slice(0, 120);
    const message = String(body.message || "").trim().slice(0, 2000);

    if (!EMAIL_RE.test(email)) {
      return jsonResponse({ error: "Please enter a valid email address." }, 400);
    }
    if (message.length < 10) {
      return jsonResponse({ error: "Please write a message of at least 10 characters." }, 400);
    }

    const adminEmail = Deno.env.get("CONTACT_ADMIN_EMAIL");
    if (!adminEmail) {
      return jsonResponse(
        { error: "No contact recipient is configured yet (CONTACT_ADMIN_EMAIL)." },
        500,
      );
    }

    await sendContactEmail({
      to: adminEmail,
      subject: `FantasyEdge AI contact — ${name || email}`,
      text: `From: ${name || "(no name)"} <${email}>\n\n${message}`,
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Could not send your message." },
      500,
    );
  }
});