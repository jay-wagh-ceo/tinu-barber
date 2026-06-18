// Public server fn the dashboard calls after any queue mutation
// to push WhatsApp "2 ahead / 1 ahead / your turn" alerts.

import { createServerFn } from "@tanstack/react-start";

export const triggerQueueNotifications = createServerFn({ method: "POST" }).handler(async () => {
  const { processNotifications } = await import("./whatsapp-handler.server");
  await processNotifications();
  return { ok: true };
});
