import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, SkipForward, UserPlus, Clock } from "lucide-react";
import { fetchQueue, fetchSettings } from "@/lib/queue";
import { supabase } from "@/integrations/supabase/client";
import { triggerQueueNotifications } from "@/lib/notify.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/queue")({
  component: QueuePage,
  head: () => ({ meta: [{ title: "Queue — Tinu Barber" }] }),
});

function QueuePage() {
  const qc = useQueryClient();
  const queueQ = useQuery({ queryKey: ["queue"], queryFn: fetchQueue, refetchInterval: 4000 });
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const notify = useServerFn(triggerQueueNotifications);

  const waiting = (queueQ.data ?? []).filter((q) => q.status === "waiting");

  async function updateStatus(id: string, status: "completed" | "cancelled") {
    const { error } = await supabase
      .from("queue_entries")
      .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "completed" ? "Marked complete" : "Cancelled");
    qc.invalidateQueries({ queryKey: ["queue"] });
    notify().catch(() => {});
  }

  async function next() {
    if (!waiting[0]) return toast.info("Queue is empty");
    await updateStatus(waiting[0].id, "completed");
  }

  function estimatedWait(idx: number) {
    return waiting.slice(0, idx).reduce((a, q) => a + (q.services?.duration_minutes ?? 0), 0);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Queue</h1>
          <p className="text-sm text-muted-foreground">{waiting.length} customer{waiting.length === 1 ? "" : "s"} waiting</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/add"><UserPlus className="mr-2 h-4 w-4" /> Add</Link>
          </Button>
          <Button onClick={next} disabled={!waiting.length}>
            <SkipForward className="mr-2 h-4 w-4" /> Next
          </Button>
        </div>
      </div>

      {settingsQ.data?.is_paused && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">Queue paused.</div>
      )}

      {waiting.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            No one in the queue right now.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {waiting.map((q, i) => {
            const wait = estimatedWait(i);
            const isCurrent = i === 0;
            return (
              <Card key={q.id} className={isCurrent ? "border-accent shadow-sm" : ""}>
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg font-display text-xl font-bold ${isCurrent ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"}`}>
                    #{q.token_number}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold truncate">{q.customers?.name}</div>
                      {isCurrent && <Badge className="bg-accent text-accent-foreground hover:bg-accent">Now</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {q.services?.service_name} · {q.services?.duration_minutes} min · {q.customers?.phone}
                    </div>
                  </div>
                  <div className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
                    <Clock className="h-4 w-4" />
                    {isCurrent ? "Now" : `~${wait} min`}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateStatus(q.id, "cancelled")}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={() => updateStatus(q.id, "completed")}>
                      <Check className="mr-1 h-4 w-4" /> Done
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <RecentSection />
    </div>
  );
}

function RecentSection() {
  const { data } = useQuery({ queryKey: ["queue"], queryFn: fetchQueue });
  const recent = (data ?? []).filter((q) => q.status !== "waiting").slice(-10).reverse();
  if (!recent.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Recent</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {recent.map((q) => (
          <div key={q.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <div className="flex items-center gap-3">
              <span className="font-mono text-muted-foreground">#{q.token_number}</span>
              <span>{q.customers?.name}</span>
              <span className="text-muted-foreground">· {q.services?.service_name}</span>
            </div>
            <Badge variant={q.status === "completed" ? "default" : "secondary"} className={q.status === "completed" ? "bg-success text-success-foreground" : ""}>
              {q.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
