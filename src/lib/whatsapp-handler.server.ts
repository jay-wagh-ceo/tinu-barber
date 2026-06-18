// Server-only WhatsApp conversation + barber command handler.
// Owns all business logic for incoming WhatsApp messages.

import { sendWhatsAppText, normalizePhone } from "./whatsapp.server";

type SB = Awaited<ReturnType<typeof getAdmin>>;

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const HELP_TEXT = `🪒 *Tinu Barber* — Commands:
• *JOIN* — join the queue
• *STATUS* — check your position
• *CANCEL* — leave the queue
• *HELP* — show this message`;

export async function handleIncoming(fromRaw: string, textRaw: string): Promise<void> {
  const from = normalizePhone(fromRaw);
  const text = (textRaw || "").trim();
  const upper = text.toUpperCase();
  const sb = await getAdmin();

  // Barber commands (case-insensitive, exact match)
  const barber = normalizePhone(process.env.BARBER_PHONE_NUMBER || "");
  if (barber && from === barber && ["NEXT", "QUEUE", "BREAK", "RESUME"].includes(upper)) {
    return handleBarber(sb, from, upper);
  }

  // Customer commands & state machine
  const { data: customer } = await sb
    .from("customers")
    .select("*")
    .eq("phone", from)
    .maybeSingle();

  if (upper === "HELP") return void sendWhatsAppText(from, HELP_TEXT);
  if (upper === "STATUS") return handleStatus(sb, from, customer);
  if (upper === "CANCEL") return handleCancel(sb, from, customer);
  if (upper === "JOIN") return handleJoinStart(sb, from, customer);

  // In-flight conversation
  if (customer?.wa_state === "awaiting_name") {
    return handleNameReply(sb, from, customer, text);
  }
  if (customer?.wa_state === "awaiting_service") {
    return handleServiceReply(sb, from, customer, text);
  }

  // Unknown
  await sendWhatsAppText(from, `Sorry, I didn't catch that.\n\n${HELP_TEXT}`);
}

// ---------- Customer flows ----------

async function handleJoinStart(sb: SB, from: string, customer: any) {
  // Already in active queue?
  if (customer) {
    const { data: active } = await sb
      .from("queue_entries")
      .select("token_number")
      .eq("customer_id", customer.id)
      .eq("status", "waiting")
      .maybeSingle();
    if (active) {
      return void sendWhatsAppText(
        from,
        `You're already in the queue (Token #${active.token_number}). Send *STATUS* for details or *CANCEL* to leave.`,
      );
    }
  }

  // Has a saved name? Skip straight to service selection.
  if (customer?.name && customer.name.trim()) {
    return promptForService(sb, from, customer.id);
  }

  // Need name — create/update customer with awaiting_name state
  const upsert = await sb
    .from("customers")
    .upsert(
      { phone: from, name: customer?.name || from, wa_state: "awaiting_name", wa_context: {} },
      { onConflict: "phone" },
    );
  if (upsert.error) console.error(upsert.error);
  await sendWhatsAppText(from, `👋 Welcome to *Tinu Barber*!\nWhat's your name?`);
}

async function handleNameReply(sb: SB, from: string, customer: any, text: string) {
  const name = text.slice(0, 80);
  if (!name) return void sendWhatsAppText(from, "Please reply with your name.");
  await sb.from("customers").update({ name }).eq("id", customer.id);
  await promptForService(sb, from, customer.id);
}

async function promptForService(sb: SB, from: string, customerId: string) {
  const { data: services } = await sb
    .from("services")
    .select("*")
    .order("created_at", { ascending: true });
  if (!services?.length) {
    return void sendWhatsAppText(from, "No services are configured yet. Please contact the shop.");
  }
  const list = services
    .map((s, i) => `${i + 1}. ${s.service_name} — ${s.duration_minutes} min`)
    .join("\n");
  await sb
    .from("customers")
    .update({
      wa_state: "awaiting_service",
      wa_context: { service_ids: services.map((s) => s.id) },
    })
    .eq("id", customerId);
  await sendWhatsAppText(
    from,
    `Please choose a service by replying with its number:\n\n${list}`,
  );
}

async function handleServiceReply(sb: SB, from: string, customer: any, text: string) {
  const ids: string[] = customer?.wa_context?.service_ids || [];
  const choice = parseInt(text.replace(/[^\d]/g, ""), 10);
  if (!choice || choice < 1 || choice > ids.length) {
    return void sendWhatsAppText(from, `Please reply with a number between 1 and ${ids.length}.`);
  }
  const serviceId = ids[choice - 1];
  const { data: service } = await sb.from("services").select("*").eq("id", serviceId).single();
  if (!service) return void sendWhatsAppText(from, "Selected service not found, please try again.");

  // Check paused
  const { data: settings } = await sb.from("settings").select("*").limit(1).maybeSingle();
  if (!settings) return void sendWhatsAppText(from, "Shop not configured. Please try again later.");
  if (settings.is_paused) {
    return void sendWhatsAppText(from, "🛑 The queue is paused for a short break. Please try again in a few minutes.");
  }

  // Compute waiting time = sum of durations of customers ahead (status=waiting)
  const { data: ahead } = await sb
    .from("queue_entries")
    .select("services(duration_minutes)")
    .eq("status", "waiting");
  const waitMin =
    (ahead ?? []).reduce(
      (sum: number, row: any) => sum + (row.services?.duration_minutes ?? 0),
      0,
    );

  const nextToken = (settings.current_token ?? 0) + 1;
  const entry = await sb.from("queue_entries").insert({
    customer_id: customer.id,
    service_id: serviceId,
    token_number: nextToken,
  });
  if (entry.error) {
    console.error(entry.error);
    return void sendWhatsAppText(from, "Could not add you to the queue. Please try again.");
  }
  await sb.from("settings").update({ current_token: nextToken }).eq("id", settings.id);
  await sb.from("customers").update({ wa_state: "idle", wa_context: {} }).eq("id", customer.id);

  await sendWhatsAppText(
    from,
    `✅ You're in the queue!\n\n` +
      `🎟 *Token:* #${nextToken}\n` +
      `💈 *Service:* ${service.service_name} (${service.duration_minutes} min)\n` +
      `⏱ *Estimated wait:* ~${waitMin} min\n\n` +
      `Send *STATUS* anytime to check your position.`,
  );

  // Trigger notifications for everyone (in case new join changes nothing, but cheap)
  await processNotifications();
}

async function handleStatus(sb: SB, from: string, customer: any) {
  if (!customer) return void sendWhatsAppText(from, "We don't have you in the queue. Send *JOIN* to get a token.");
  const { data: waiting } = await sb
    .from("queue_entries")
    .select("*, services(duration_minutes, service_name)")
    .eq("status", "waiting")
    .order("joined_at", { ascending: true });
  const list = waiting ?? [];
  const idx = list.findIndex((q: any) => q.customer_id === customer.id);
  if (idx === -1) return void sendWhatsAppText(from, "You're not in the active queue. Send *JOIN* to get a token.");

  const me: any = list[idx];
  const wait = list.slice(0, idx).reduce((s: number, r: any) => s + (r.services?.duration_minutes ?? 0), 0);
  const { data: settings } = await sb.from("settings").select("is_paused").limit(1).maybeSingle();
  const pausedMsg = settings?.is_paused ? "\n⚠️ Queue is currently *paused*." : "";

  await sendWhatsAppText(
    from,
    `🎟 *Token:* #${me.token_number}\n` +
      `📍 *Position:* ${idx + 1} of ${list.length}\n` +
      `👥 *Customers ahead:* ${idx}\n` +
      `⏱ *Estimated wait:* ${idx === 0 ? "Now serving" : `~${wait} min`}` +
      pausedMsg,
  );
}

async function handleCancel(sb: SB, from: string, customer: any) {
  if (!customer) return void sendWhatsAppText(from, "You're not in the queue.");
  const { data: active } = await sb
    .from("queue_entries")
    .select("id, token_number")
    .eq("customer_id", customer.id)
    .eq("status", "waiting")
    .maybeSingle();
  if (!active) return void sendWhatsAppText(from, "You don't have an active token.");
  await sb.from("queue_entries").update({ status: "cancelled" }).eq("id", active.id);
  await sendWhatsAppText(from, `❌ Token #${active.token_number} cancelled. See you next time!`);
  await processNotifications();
}

// ---------- Barber flows ----------

async function handleBarber(sb: SB, from: string, cmd: string) {
  if (cmd === "QUEUE") {
    const { data: list } = await sb
      .from("queue_entries")
      .select("*, customers(name), services(service_name, duration_minutes)")
      .eq("status", "waiting")
      .order("joined_at", { ascending: true });
    if (!list?.length) return void sendWhatsAppText(from, "Queue is empty.");
    const text = list
      .map((q: any, i: number) => `${i + 1}. #${q.token_number} ${q.customers?.name ?? "?"} — ${q.services?.service_name ?? "?"}`)
      .join("\n");
    return void sendWhatsAppText(from, `📋 *Current Queue (${list.length})*\n\n${text}`);
  }

  if (cmd === "NEXT") {
    const { data: first } = await sb
      .from("queue_entries")
      .select("id, token_number, customers(phone, name)")
      .eq("status", "waiting")
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!first) return void sendWhatsAppText(from, "Queue is empty.");
    await sb
      .from("queue_entries")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", first.id);
    await sendWhatsAppText(from, `✅ Token #${first.token_number} marked complete.`);
    await processNotifications();
    return;
  }

  if (cmd === "BREAK") {
    const { data: settings } = await sb.from("settings").select("id").limit(1).maybeSingle();
    if (settings) {
      await sb
        .from("settings")
        .update({ is_paused: true, break_started_at: new Date().toISOString() })
        .eq("id", settings.id);
    }
    return void sendWhatsAppText(from, "🛑 Queue paused. Send *RESUME* when you're back.");
  }

  if (cmd === "RESUME") {
    const { data: settings } = await sb.from("settings").select("id").limit(1).maybeSingle();
    if (settings) {
      await sb.from("settings").update({ is_paused: false, break_started_at: null }).eq("id", settings.id);
    }
    await sendWhatsAppText(from, "▶️ Queue resumed.");
    await processNotifications();
  }
}

// ---------- Proactive notifications ----------
// Sends "2 ahead", "1 ahead", and "your turn" — once each per queue entry.

export async function processNotifications(): Promise<void> {
  const sb = await getAdmin();
  const { data: settings } = await sb.from("settings").select("is_paused").limit(1).maybeSingle();
  if (settings?.is_paused) return; // don't advance notifications during break

  const { data: list } = await sb
    .from("queue_entries")
    .select("id, token_number, two_alert, one_alert, turn_alert, customers(phone, name)")
    .eq("status", "waiting")
    .order("joined_at", { ascending: true });
  if (!list?.length) return;

  for (let i = 0; i < list.length; i++) {
    const q: any = list[i];
    const phone = q.customers?.phone;
    if (!phone) continue;
    let updates: { turn_alert?: boolean; one_alert?: boolean; two_alert?: boolean } | null = null;
    if (i === 0 && !q.turn_alert) {
      await sendWhatsAppText(phone, `🔔 *It's your turn!* Token #${q.token_number} — please come to the chair now.`);
      updates = { turn_alert: true };
    } else if (i === 1 && !q.one_alert) {
      await sendWhatsAppText(phone, `⏳ Only *1 customer* before your turn. Token #${q.token_number} — please get ready.`);
      updates = { one_alert: true };
    } else if (i === 2 && !q.two_alert) {
      await sendWhatsAppText(phone, `⏳ Only *2 customers* before your turn. Token #${q.token_number}.`);
      updates = { two_alert: true };
    }
    if (updates) {
      await sb.from("queue_entries").update(updates).eq("id", q.id);
    }
  }
}
