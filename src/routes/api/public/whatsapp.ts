// WhatsApp Cloud API webhook endpoint.
// - GET: Meta verification handshake (hub.mode/hub.verify_token/hub.challenge)
// - POST: incoming message events

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env.WHATSAPP_VERIFY_TOKEN;
        if (mode === "subscribe" && token && expected && token === expected) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        // Always 200 fast so Meta doesn't retry; process in background.
        let body: any = null;
        try {
          body = await request.json();
        } catch {
          return new Response("ok", { status: 200 });
        }

        // Process asynchronously — don't block the webhook response.
        (async () => {
          try {
            const { handleIncoming } = await import("@/lib/whatsapp-handler.server");
            const entries = body?.entry ?? [];
            for (const entry of entries) {
              const changes = entry?.changes ?? [];
              for (const change of changes) {
                const messages = change?.value?.messages ?? [];
                for (const msg of messages) {
                  if (msg.type !== "text") continue;
                  const from: string = msg.from;
                  const text: string = msg.text?.body ?? "";
                  await handleIncoming(from, text);
                }
              }
            }
          } catch (e) {
            console.error("[whatsapp webhook] processing error", e);
          }
        })();

        return new Response("ok", { status: 200 });
      },
    },
  },
});
