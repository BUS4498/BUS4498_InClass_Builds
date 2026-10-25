// Club Event Radar: the Discord reader (Supabase Edge Function "read-discord"). Stage 14, Discord version.
//
// It reads new messages from one Discord channel and hands each one to the AI agent (submit-event),
// as if a club officer had pasted it on the website. Discord only tells always-on programs about new
// messages, so this reader is woken by the scheduled job (Cron) every minute and reads what's new.
// It never trusts a knock on the door; a POST's body is ignored and the reader fetches the channel itself.
//
// Memory: the channel_cursor table remembers the ID of the last message read, so no message is read
// twice. If two runs overlap, the database refuses the second copy (events_one_per_message). The sender's
// earlier messages from the last few minutes go along as short-term memory.
//
// Secrets (Edge Functions → Secrets): DISCORD_BOT_TOKEN (from the Developer Portal → Bot → Reset Token;
// the bot needs the Message Content Intent) and DISCORD_CHANNEL_ID (right-click the channel → Copy Channel ID).
// Deploy with JWT verification off (verify_jwt = false).

import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const SOURCE = "discord";
const API = "https://discord.com/api/v10";
const MAX_PER_RUN = 20;
const MAX_REPLY = 1900;      // Discord messages hold 2,000 characters
const THREAD_MINUTES = 10;
const THREAD_MAX = 4;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type Msg = { id: string; content?: string; timestamp?: string; author?: { id?: string; username?: string; global_name?: string | null; bot?: boolean } };
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

// Discord returns messages newest first; the reader handles them oldest first.
async function discordGet(path: string, token: string): Promise<Msg[]> {
  const res = await fetch(API + path, { headers: { Authorization: `Bot ${token}` } });
  if (!res.ok) throw new Error(`Discord answered ${res.status} for ${path.split("?")[0]}. Check DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID, and that the bot is in the server with the Message Content Intent.`);
  return (await res.json()) as Msg[];
}
function who(m: Msg): string { return m.author?.global_name || m.author?.username || "Someone"; }
function when(m: Msg): number { return m.timestamp ? Date.parse(m.timestamp) / 1000 : 0; }

// Short-term memory: the same person's messages from the minutes before this one, oldest first.
async function threadBefore(m: Msg, channel: string, token: string): Promise<string[]> {
  try {
    const earlier = await discordGet(`/channels/${channel}/messages?before=${encodeURIComponent(m.id)}&limit=10`, token);
    const since = when(m) - THREAD_MINUTES * 60;
    return earlier
      .filter((e) => e.author?.id === m.author?.id && !e.author?.bot && (e.content ?? "").trim() && when(e) >= since)
      .slice(0, THREAD_MAX).reverse().map((e) => (e.content ?? "").trim());
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
async function say(channel: string, token: string, content: string) {
  const res = await fetch(`${API}/channels/${channel}/messages`, { method: "POST", headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
  if (!res.ok) console.error("The bot couldn't post its reply", res.status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const token = (Deno.env.get("DISCORD_BOT_TOKEN") ?? "").trim();
  const channel = (Deno.env.get("DISCORD_CHANNEL_ID") ?? "").trim();
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
      message: token && channel ? "The Discord reader is set up." : "Add DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID in Edge Functions → Secrets.",
    };
    // ?check=discord asks Discord whether the token and channel work. It reports status codes only, never values.
    if (new URL(req.url).searchParams.get("check") === "discord" && token) {
      const me = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bot ${token}` } });
      const ch = channel ? await fetch(`${API}/channels/${encodeURIComponent(channel)}`, { headers: { Authorization: `Bot ${token}` } }) : null;
      status.discord = {
        token_works: me.ok,
        channel_id_is_number: /^\d+$/.test(channel),
        channel_found: ch ? ch.ok : false,
        message: !me.ok ? `Discord rejected the token (${me.status}). In the Developer Portal → Bot, click Reset Token and save the new one as DISCORD_BOT_TOKEN.`
          : ch && !ch.ok ? `The token works, but the bot can't see channel ${channel} (${ch.status}). Is the bot in that server, and is the ID right?`
          : "The token and the channel ID work.",
      };
    }
    return reply(200, status);
  }
  if (req.method !== "POST") return reply(405, { ok: false, message: "Send a POST request." });

  // A POST comes from the scheduled job or from a person. Its body is ignored on purpose.
  try {
    if (!token || !channel) return reply(503, { ok: false, message: "Add DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID in Edge Functions → Secrets." });

    const { data: cur } = await db.from("channel_cursor").select("last_id, read_count").eq("source", SOURCE).maybeSingle();
    let lastId = String(cur?.last_id ?? "");
    const readCount = Number(cur?.read_count ?? 0);

    // First run: remember where the channel is now, and start with the next message. Old history is never read.
    if (!lastId) {
      const newest = await discordGet(`/channels/${channel}/messages?limit=1`, token);
      lastId = newest[0]?.id ?? "0";
      await db.from("channel_cursor").upsert({ source: SOURCE, last_id: lastId, read_count: 0, updated_at: new Date().toISOString() });
      return reply(200, { ok: true, handled: 0, message: "First run: the reader will start with the next message posted in the channel." });
    }

    const messages = (await discordGet(`/channels/${channel}/messages?after=${encodeURIComponent(lastId)}&limit=${MAX_PER_RUN}`, token)).reverse();
    const results: Record<string, unknown>[] = [];
    for (const m of messages) {
      lastId = m.id; // move the bookmark past every message, including the ones we skip
      const text = (m.content ?? "").trim();
      if (m.author?.bot || !text) continue;
      const name = who(m);
      const thread = await threadBefore(m, channel, token);
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/submit-event`, {
        method: "POST",
        headers: { apikey: callerKey(), "Content-Type": "application/json" },
        body: JSON.stringify({ announcement: text.slice(0, 2000), source: SOURCE, source_id: m.id, source_name: name, thread }),
      });
      const decision: Decision = await res.json().catch(() => ({ ok: false, message: `The agent didn't answer (${res.status}).` }));
      results.push({ id: m.id, from: name, status: decision.ok ? decision.status : "error", message: decision.message ?? "" });
      if (!decision.already_read) await say(channel, token, replyText(name, decision));
    }
    await db.from("channel_cursor").upsert({ source: SOURCE, last_id: lastId, read_count: readCount + results.length, updated_at: new Date().toISOString() });
    return reply(200, { ok: true, handled: results.length, skipped: messages.length - results.length, results });
  } catch (err) {
    console.error(err);
    return reply(502, { ok: false, message: err instanceof Error ? err.message : "Something went wrong in the Discord reader. Check the function logs in Supabase." });
  }
});
