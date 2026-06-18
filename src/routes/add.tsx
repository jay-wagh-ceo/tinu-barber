import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchServices, fetchSettings } from "@/lib/queue";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/add")({
  component: AddCustomerPage,
  head: () => ({ meta: [{ title: "Add Customer — Tinu Barber" }] }),
});

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(80),
  phone: z.string().trim().min(4, "Phone required").max(20),
  serviceId: z.string().uuid("Pick a service"),
});

function AddCustomerPage() {
  const nav = useNavigate();
  const servicesQ = useQuery({ queryKey: ["services"], queryFn: fetchServices });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ name, phone, serviceId });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    try {
      const settings = await fetchSettings();
      const nextToken = (settings.current_token ?? 0) + 1;

      const cust = await supabase.from("customers").insert({ name, phone }).select().single();
      if (cust.error) throw cust.error;

      const entry = await supabase.from("queue_entries").insert({
        customer_id: cust.data.id,
        service_id: serviceId,
        token_number: nextToken,
      });
      if (entry.error) throw entry.error;

      const upd = await supabase.from("settings").update({ current_token: nextToken }).eq("id", settings.id);
      if (upd.error) throw upd.error;

      toast.success(`Added — Token #${nextToken}`);
      nav({ to: "/queue" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl">Add Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="name">Customer Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ravi Kumar" maxLength={80} />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" maxLength={20} />
            </div>
            <div>
              <Label>Service</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                <SelectContent>
                  {servicesQ.data?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.service_name} — {s.duration_minutes} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Adding…" : "Generate Token"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
