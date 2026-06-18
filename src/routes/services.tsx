import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, Save, X } from "lucide-react";
import { fetchServices, type Service } from "@/lib/queue";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/services")({
  component: ServicesPage,
  head: () => ({ meta: [{ title: "Services — Tinu Barber" }] }),
});

function ServicesPage() {
  const qc = useQueryClient();
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: fetchServices });
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("20");
  const [editing, setEditing] = useState<Service | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !Number(duration)) return toast.error("Fill all fields");
    const { error } = await supabase
      .from("services")
      .insert({ service_name: name.trim(), duration_minutes: Number(duration) });
    if (error) return toast.error(error.message);
    setName(""); setDuration("20");
    toast.success("Service added");
    qc.invalidateQueries({ queryKey: ["services"] });
  }

  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase
      .from("services")
      .update({ service_name: editing.service_name, duration_minutes: editing.duration_minutes })
      .eq("id", editing.id);
    if (error) return toast.error(error.message);
    setEditing(null);
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["services"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this service?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["services"] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Services</h1>
        <p className="text-sm text-muted-foreground">Manage offered services and their durations.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Add new service</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <Label htmlFor="sname">Service name</Label>
              <Input id="sname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hair color" />
            </div>
            <div className="w-32">
              <Label htmlFor="dur">Duration (min)</Label>
              <Input id="dur" type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <Button type="submit"><Plus className="mr-2 h-4 w-4" /> Add</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {services.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              {editing?.id === s.id ? (
                <>
                  <Input className="flex-1 min-w-[160px]" value={editing.service_name} onChange={(e) => setEditing({ ...editing, service_name: e.target.value })} />
                  <Input type="number" className="w-24" value={editing.duration_minutes} onChange={(e) => setEditing({ ...editing, duration_minutes: Number(e.target.value) })} />
                  <Button size="sm" onClick={saveEdit}><Save className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="font-semibold">{s.service_name}</div>
                    <div className="text-sm text-muted-foreground">{s.duration_minutes} minutes</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
