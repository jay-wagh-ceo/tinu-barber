import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fetchSettings } from "@/lib/queue";
import { supabase } from "@/integrations/supabase/client";
import { triggerQueueNotifications } from "@/lib/notify.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Save, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Tinu Barber" }] }),
});

function SettingsPage() {
  const qc = useQueryClient();
  const notify = useServerFn(triggerQueueNotifications);
  const { data } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const [shopName, setShopName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (data) {
      setShopName(data.shop_name);
      setWhatsapp(data.whatsapp_number ?? "");
      setPaused(data.is_paused);
    }
  }, [data]);

  async function save() {
    if (!data) return;
    const { error } = await supabase
      .from("settings")
      .update({
        shop_name: shopName,
        whatsapp_number: whatsapp,
        is_paused: paused,
        break_started_at: paused ? data.break_started_at ?? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
    if (!paused) notify().catch(() => {});
  }

  async function resetTokens() {
    if (!data) return;
    if (!confirm("Reset token counter to 0? Existing queue tokens stay the same.")) return;
    const { error } = await supabase.from("settings").update({ current_token: 0 }).eq("id", data.id);
    if (error) return toast.error(error.message);
    toast.success("Token counter reset");
    qc.invalidateQueries({ queryKey: ["settings"] });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Shop info and queue controls.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Shop details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="shop">Shop name</Label>
            <Input id="shop" value={shopName} onChange={(e) => setShopName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="wa">WhatsApp number</Label>
            <Input id="wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+91 98765 43210" />
            <p className="mt-1 text-xs text-muted-foreground">Used later when WhatsApp Cloud API is connected.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Queue control</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="font-medium">Pause queue</div>
              <div className="text-xs text-muted-foreground">Used during breaks. Waiting times recalculate after resume.</div>
            </div>
            <Switch checked={paused} onCheckedChange={setPaused} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="font-medium">Token counter</div>
              <div className="text-xs text-muted-foreground">Current: #{data?.current_token ?? 0}</div>
            </div>
            <Button variant="outline" size="sm" onClick={resetTokens}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save}><Save className="mr-2 h-4 w-4" /> Save changes</Button>
      </div>
    </div>
  );
}
