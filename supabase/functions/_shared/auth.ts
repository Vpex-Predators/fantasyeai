import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.49.1";
import { DEFAULT_LEAGUE_ID } from "./espnLeague.js";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export type AuthedClients = {
  user: User;
  userClient: SupabaseClient;
  service: SupabaseClient;
};

export async function requireUser(req: Request): Promise<AuthedClients | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    throw new Error("Supabase environment is not configured on the server.");
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();
  if (error || !user) return null;

  const service = createClient(supabaseUrl, serviceKey);
  return { user, userClient, service };
}

export async function getProfileRole(
  service: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await service
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "admin" ? "admin" : "user";
}

export async function getTeamLock(
  service: SupabaseClient,
  userId: string,
) {
  const { data, error } = await service
    .from("team_locks")
    .select("*")
    .eq("user_id", userId)
    .eq("league_id", DEFAULT_LEAGUE_ID)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRefreshState(
  service: SupabaseClient,
  userId: string,
) {
  const { data, error } = await service
    .from("refresh_states")
    .select("*")
    .eq("user_id", userId)
    .eq("league_id", DEFAULT_LEAGUE_ID)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listPlayerAnalyses(
  service: SupabaseClient,
  userId: string,
) {
  const { data, error } = await service
    .from("player_analyses")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data || [];
}

export async function upsertRefreshState(
  service: SupabaseClient,
  userId: string,
  patch: Record<string, unknown>,
) {
  const existing = await getRefreshState(service, userId);
  if (existing) {
    await service.from("refresh_states").update(patch).eq("id", existing.id);
  } else {
    await service.from("refresh_states").insert({
      user_id: userId,
      league_id: DEFAULT_LEAGUE_ID,
      ...patch,
    });
  }
}

type InvokeLlmOptions = {
  prompt: string;
  model?: string;
  add_context_from_internet?: boolean;
  file_urls?: string[];
  response_json_schema?: Record<string, unknown>;
};

const DEFAULT_MODEL_MAP: Record<string, string> = {
  automatic: "gpt-4o-mini",
  gpt_5_mini: "gpt-4o-mini",
  gpt_5_4: "gpt-4o",
  gpt_5_6_sol: "gpt-4o",
  gpt_5_6_luna: "gpt-4o-mini",
  gemini_3_flash: "gpt-4o-mini",
  gemini_3_1_pro: "gpt-4o",
  "claude-sonnet-5": "gpt-4o",
  claude_opus_5: "gpt-4o",
  claude_opus_4_8: "gpt-4o",
};

/** OpenAI-compatible chat completions (replaces Base44 InvokeLLM). Web search is best-effort via model knowledge unless a search-enabled provider is configured. */
export async function invokeLlm(opts: InvokeLlmOptions): Promise<unknown> {
  const apiKey = Deno.env.get("LLM_API_KEY") || Deno.env.get("OPENAI_API_KEY");
  const baseUrl = (Deno.env.get("LLM_BASE_URL") || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY (or OPENAI_API_KEY) is not configured on the server.",
    );
  }

  const envModel = Deno.env.get("LLM_MODEL");
  const requested = opts.model && opts.model !== "automatic" ? opts.model : null;
  const model =
    envModel ||
    (requested ? DEFAULT_MODEL_MAP[requested] || requested : "gpt-4o-mini");

  let userContent: string | Array<Record<string, unknown>> = opts.prompt;
  if (opts.response_json_schema) {
    userContent += "\n\nRespond with JSON only, no markdown.";
  }
  if (opts.file_urls?.length) {
    userContent = [
      { type: "text", text: String(userContent) },
      ...opts.file_urls.map((url) => ({
        type: "image_url",
        image_url: { url },
      })),
    ];
  } else if (opts.add_context_from_internet) {
    userContent =
      String(userContent) +
      "\n\nUse your training knowledge for recent NFL context; live web grounding is not yet wired on Supabase Edge.";
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: userContent }],
      response_format: opts.response_json_schema
        ? { type: "json_object" }
        : undefined,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { error?: { message?: string } })?.error?.message ||
      res.statusText;
    throw new Error(msg || "LLM request failed");
  }

  const content = (data as { choices?: { message?: { content?: string } }[] })
    .choices?.[0]?.message?.content;
  if (content == null) throw new Error("Empty LLM response");
  if (opts.response_json_schema) {
    try {
      return JSON.parse(content);
    } catch {
      throw new Error("LLM returned non-JSON output");
    }
  }
  return content;
}

/** Multi-turn chat (Trade Analyst and similar). */
export async function invokeLlmChat(opts: {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
  add_context_from_internet?: boolean;
}): Promise<string> {
  const apiKey = Deno.env.get("LLM_API_KEY") || Deno.env.get("OPENAI_API_KEY");
  const baseUrl = (Deno.env.get("LLM_BASE_URL") || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY (or OPENAI_API_KEY) is not configured on the server.",
    );
  }

  const envModel = Deno.env.get("LLM_MODEL");
  const requested = opts.model && opts.model !== "automatic" ? opts.model : null;
  const model =
    envModel ||
    (requested ? DEFAULT_MODEL_MAP[requested] || requested : "gpt-4o-mini");

  const chatMessages: Array<{ role: string; content: string }> = [
    { role: "system", content: opts.system },
  ];
  for (let i = 0; i < opts.messages.length; i++) {
    const m = opts.messages[i];
    let content = m.content;
    if (
      opts.add_context_from_internet &&
      m.role === "user" &&
      i === opts.messages.length - 1
    ) {
      content +=
        "\n\n(Use your training knowledge for recent NFL context; live web grounding is not yet wired on Supabase Edge.)";
    }
    chatMessages.push({ role: m.role, content });
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: chatMessages,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { error?: { message?: string } })?.error?.message ||
      res.statusText;
    throw new Error(msg || "LLM request failed");
  }

  const content = (data as { choices?: { message?: { content?: string } }[] })
    .choices?.[0]?.message?.content;
  if (content == null) throw new Error("Empty LLM response");
  return content;
}

export async function sendContactEmail(opts: {
  to: string;
  subject: string;
  text: string;
}) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    throw new Error("RESEND_API_KEY is not configured on the server.");
  }
  const from =
    Deno.env.get("CONTACT_FROM_EMAIL") || "FantasyEAi <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Email failed: ${body || res.statusText}`);
  }
}