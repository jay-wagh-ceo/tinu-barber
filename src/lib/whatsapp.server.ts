// Server-only WhatsApp Cloud API helpers.
// Never import this from client/route files at module scope.

const GRAPH = "https://graph.facebook.com/v21.0";

export function normalizePhone(raw: string): string {
  return (raw || "").replace(/[^\d]/g, "");
}

export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.warn("[whatsapp] Missing WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID — skipping send");
    return;
  }
  const url = `${GRAPH}/${phoneId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "text",
      text: { preview_url: false, body: body.slice(0, 4000) },
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[whatsapp] send failed", res.status, txt);
  }
}
