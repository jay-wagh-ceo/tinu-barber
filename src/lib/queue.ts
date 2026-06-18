import { supabase } from "@/integrations/supabase/client";

export type QueueRow = {
  id: string;
  customer_id: string;
  service_id: string;
  token_number: number;
  status: "waiting" | "completed" | "cancelled";
  joined_at: string;
  completed_at: string | null;
  customers: { id: string; name: string; phone: string } | null;
  services: { id: string; service_name: string; duration_minutes: number } | null;
};

export type Service = {
  id: string;
  service_name: string;
  duration_minutes: number;
  created_at: string;
};

export type Settings = {
  id: string;
  shop_name: string;
  whatsapp_number: string | null;
  current_token: number;
  is_paused: boolean;
  break_started_at: string | null;
};

export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const ins = await supabase
      .from("settings")
      .insert({ shop_name: "Tinu Barber", whatsapp_number: "" })
      .select()
      .single();
    if (ins.error) throw ins.error;
    return ins.data as Settings;
  }
  return data as Settings;
}

export async function fetchQueue(): Promise<QueueRow[]> {
  const { data, error } = await supabase
    .from("queue_entries")
    .select("*, customers(*), services(*)")
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as QueueRow[];
}

export async function fetchServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Service[];
}
