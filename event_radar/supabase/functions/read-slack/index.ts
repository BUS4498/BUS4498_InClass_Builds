// Club Event Radar: the Slack reader (Supabase Edge Function "read-slack"). Stage 14, Slack version.
//
// It reads new messages from one Slack channel and hands each one to the AI agent (submit-event),
// as if a club officer had pasted it on the website. Two things can wake it up: the scheduled job (Cron)
// every minute, and Slack's Events API the moment someone posts (optional). Either way the reader asks
// Slack for the messages after the last one it handled; a POST's body is used only to answer Slack's
// one-time url_verification challenge.
//
// Memory: the channel_cursor table remembers the timestamp (ts) of the last message read, so no message
// is read twice. If two runs overlap, the database refuses the second copy (events_one_per_message). The
// sender's earlier messages from the last few minutes go along as short-term memory.
//
// Secrets (Edge Functions → Secrets): SLACK_BOT_TOKEN (the Bot User OAuth Token, xoxb-…, with the scopes
// channels:history, channels:read, chat:write; the bot must be invited to the channel) and SLACK_CHANNEL_ID.
// Deploy with JWT verification off (verify_jwt = false).

import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const SOURCE = "slack";
const API = "https://slack.com/api";
const MAX_PER_RUN = 20;
const MAX_REPLY = 2900;
const THREAD_MINUTES = 10;
const THREAD_MAX = 4;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type Msg = { ts: string; text?: string; user?: string; bot_id?: string; subtype?: string; user_profile?: { display_name?: string; real_name?: string } };
type Decision = { ok: boolean; status?: string; message?: string; reasons?: string[]; already_read?: boolean; event?: Record<string, unknown> | null };

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function serverKey(): string {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    try {
      const k = JSON.parse(keys)["default"];
      if (k) return k;
    } catch (_) { /* fall back to the legacy key below */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}
function callerKey(): string {
  return Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? serverKey();
}

// Slack answers 200 to everything and puts the real result in `ok`. Messages come newest first.
// deno-lint-ignore no-explicit-any
async function slack(method: string, token: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${API}/${method}?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack answered "${data.error}" for ${method}. Check SLACK_BOT_TOKEN and SLACK_CHANNEL_ID, and that the bot was invited to the channel.`);
  return data;
}
function who(m: Msg): string { return m.user_profile?.display_name || m.user_profile?.real_name || "Someone"; }

// Short-term memory: the same person's messages from the minutes before this one, oldest first.
async function threadBefore(m: Msg, channel: string, token: string): Promise<string[]> {
  try {
    const data = await slack("conversations.history", token, { channel, latest: m.ts, inclusive: "false", limit: "10" });
    const since = Number(m.ts) - THREAD_MINUTES * 60;
    return ((data.messages ?? []) as Msg[])
      .filter((e) => e.user && e.user === m.user && !e.bot_id && !e.subtype && (e.text ?? "").trim() && Number(e.ts) >= since)
      .slice(0, THREAD_MAX).reverse().map((e) => (e.text ?? "").trim());
  } catch (_) {
    return [];
  }
}

function fmtTime(t: unknown): string {
  const m = /^(\d{2}):(\d{2})/.exec(String(t ?? ""));
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}
function fmtDate(d: unknown): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d ?? ""));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";
}
function replyText(name: string, d: Decision): string {
  const ev = d.event ?? {};
  const card = [ev.title, fmtDate(ev.event_date), fmtTime(ev.start_time), ev.place_name].filter(Boolean).join(" · ");
  const reasons = (d.reasons ?? []).join(" ");
  let text: string;
  if (!d.ok) text = `⚠️ ${name}: the agent couldn't read that post. ${d.message ?? ""}`;
  else if (d.status === "published") text = `✅ ${name}: posted on the website. ${card}`;
  else if (d.status === "waiting") text = `⏳ ${name}: waiting for a moderator. ${reasons}`;
  else if (d.status === "duplicate") text = `↩️ ${name}: already posted. ${reasons}`;
  else text = `❌ ${name}: not posted. ${reasons}`;
  return text.trim().slice(0, MAX_REPLY);
}
async function say(channel: string, token: string, text: string) {
  const res = await fetch(`${API}/chat.postMessage`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ channel, text }) });
  const data = await res.json().catch(() => ({ ok: false }));
  if (!data.ok) console.error("The bot couldn't post its reply", data.error ?? res.status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const token = (Deno.env.get("SLACK_BOT_TOKEN") ?? "").trim();
  const channel = (Deno.env.get("SLACK_CHANNEL_ID") ?? "").trim();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, serverKey(), { auth: { persistSession: false } });

  if (req.method === "GET") {
    const { data: cur } = await db.from("channel_cursor").select("last_id, read_count, updated_at").eq("source", SOURCE).maybeSingle();
    const status: Record<string, unknown> = {
      ok: true,
      ready: Boolean(token && channel),
      source: SOURCE,
      bot: Boolean(token),
      last_message_id: cur?.last_id ?? "",
      read_count: cur?.read_count ?? 0,
      last_run: cur?.updated_at ?? "",
      message: token && channel ? "The Slack reader is set up." : "Add SLACK_BOT_TOKEN and SLACK_CHANNEL_ID in Edge Functions → Secrets.",
    };
    // ?check=slack asks Slack whether the token and channel work. It reports results only, never values.
    if (new URL(req.url).searchParams.get("check") === "slack" && token) {
      let tokenWorks = false, channelFound = false, note = "";
      try { await slack("auth.test", token, {}); tokenWorks = true; } catch (e) { note = e instanceof Error ? e.message : String(e); }
      if (tokenWorks && channel) { try { await slack("conversations.info", token, { channel }); channelFound = true; } catch (e) { note = e instanceof Error ? e.message : String(e); } }
      status.slack = { token_works: tokenWorks, channel_found: channelFound, message: tokenWorks && channelFound ? "The token and the channel ID work." : note };
    }
    return reply(200, status);
  }
  if (req.method !== "POST") return reply(405, { ok: false, message: "Send a POST request." });

  // Slack's Events API sends a one-time challenge when you save the request URL. Answer it; ignore every other body.
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) { /* no body, or not JSON: fine */ }
  if (body.type === "url_verification" && typeof body.challenge === "string") return reply(200, { challenge: body.challenge });

  try {
    if (!token || !channel) return reply(503, { ok: false, message: "Add SLACK_BOT_TOKEN and SLACK_CHANNEL_ID in Edge Functions → Secrets." });

    const { data: cur } = await db.from("channel_cursor").select("last_id, read_count").eq("source", SOURCE).maybeSingle();
    let lastTs = String(cur?.last_id ?? "");
    const readCount = Number(cur?.read_count ?? 0);

    // First run: remember where the channel is now, and start with the next message. Old history is never read.
    if (!lastTs) {
      const newest = await slack("conversations.history", token, { channel, limit: "1" });
      lastTs = (newest.messages?.[0]?.ts as string) ?? "0";
      await db.from("channel_cursor").upsert({ source: SOURCE, last_id: lastTs, read_count: 0, updated_at: new Date().toISOString() });
      return reply(200, { ok: true, handled: 0, message: "First run: the reader will start with the next message posted in the channel." });
    }

    const data = await slack("conversations.history", token, { channel, oldest: lastTs, inclusive: "false", limit: String(MAX_PER_RUN) });
    const messages = ((data.messages ?? []) as Msg[]).reverse();
    const results: Record<string, unknown>[] = [];
    for (const m of messages) {
      lastTs = m.ts; // move the bookmark past every message, including the ones we skip
      const text = (m.text ?? "").trim();
      if (m.bot_id || m.subtype || !text) continue;
      const name = who(m);
      const thread = await threadBefore(m, channel, token);
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/submit-event`, {
        method: "POST",
        headers: { apikey: callerKey(), "Content-Type": "application/json" },
        body: JSON.stringify({ announcement: text.slice(0, 2000), source: SOURCE, source_id: m.ts, source_name: name, thread }),
      });
      const decision: Decision = await res.json().catch(() => ({ ok: false, message: `The agent didn't answer (${res.status}).` }));
      results.push({ id: m.ts, from: name, status: decision.ok ? decision.status : "error", message: decision.message ?? "" });
      if (!decision.already_read) await say(channel, token, replyText(name, decision));
    }
    await db.from("channel_cursor").upsert({ source: SOURCE, last_id: lastTs, read_count: readCount + results.length, updated_at: new Date().toISOString() });
    return reply(200, { ok: true, handled: results.length, skipped: messages.length - results.length, results });
  } catch (err) {
    console.error(err);
    return reply(502, { ok: false, message: err instanceof Error ? err.message : "Something went wrong in the Slack reader. Check the function logs in Supabase." });
  }
});
