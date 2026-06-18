import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Users, Ticket, ChevronRight, UserPlus, ListOrdered, Pause, Play } from "lucide-react";
import { fetchQueue, fetchSettings } from "@/lib/queue";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Tinu Barber" }] }),
});

function Dashboard() {
  const queueQ = useQuery({ queryKey: ["queue"], queryFn: fetchQueue, refetchInterval: 5000 });
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: fetchSettings, refetchInterval: 5000 });

  const queue = queueQ.data ?? [];
  const settings = settingsQ.data;
  const waiting = queue.filter((q) => q.status === "waiting");
  const current = waiting[0];
  const next = waiting[1];
  const avgWait = waiting.length
    ? Math.round(waiting.reduce((a, q) => a + (q.services?.duration_minutes ?? 0), 0) / waiting.length)
    : 0;
  const totalWait = waiting.reduce((a, q) => a + (q.services?.duration_minutes ?? 0), 0);

  async function togglePause() {
    if (!settings) return;
    const paused = !settings.is_paused;
    const { error } = await supabase
      .from("settings")
      .update({ is_paused: paused, break_started_at: paused ? new Date().toISOString() : null })
      .eq("id", settings.id);
    if (error) toast.error(error.message);
    else {
      toast.success(paused ? "Queue paused" : "Queue resumed");
      settingsQ.refetch();
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live overview of today's queue.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={settings?.is_paused ? "default" : "outline"} onClick={togglePause}>
            {settings?.is_paused ? <><Play className="mr-2 h-4 w-4" /> Resume</> : <><Pause className="mr-2 h-4 w-4" /> Pause</>}
          </Button>
          <Button asChild>
            <Link to="/add"><UserPlus className="mr-2 h-4 w-4" /> Add Customer</Link>
          </Button>
        </div>
      </div>

      {settings?.is_paused && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          Queue is currently paused — new customers can still be added.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Users className="h-5 w-5" />} label="Waiting" value={waiting.length} />
        <Stat icon={<Ticket className="h-5 w-5" />} label="Current Token" value={current ? `#${current.token_number}` : "—"} />
        <Stat icon={<ChevronRight className="h-5 w-5" />} label="Next Token" value={next ? `#${next.token_number}` : "—"} />
        <Stat icon={<Clock className="h-5 w-5" />} label="Avg Wait" value={`${avgWait} min`} hint={`Total ${totalWait} min`} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display">Now Serving</CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link to="/queue">View queue <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {current ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-accent/10 p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-accent font-display text-2xl font-bold text-accent-foreground">
                  #{current.token_number}
                </div>
                <div>
                  <div className="text-lg font-semibold">{current.customers?.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {current.services?.service_name} · {current.services?.duration_minutes} min
                  </div>
                </div>
              </div>
              <Button asChild>
                <Link to="/queue"><ListOrdered className="mr-2 h-4 w-4" /> Manage</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No customers in queue. Click "Add Customer" to begin.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs uppercase tracking-wider">{label}</span></div>
        <div className="mt-2 font-display text-3xl font-semibold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
