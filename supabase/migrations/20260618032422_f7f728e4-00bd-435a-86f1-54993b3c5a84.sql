
-- Customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO anon, authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Public insert customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update customers" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Public delete customers" ON public.customers FOR DELETE USING (true);

-- Services
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Public insert services" ON public.services FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update services" ON public.services FOR UPDATE USING (true);
CREATE POLICY "Public delete services" ON public.services FOR DELETE USING (true);

INSERT INTO public.services (service_name, duration_minutes) VALUES
  ('Haircut', 20),
  ('Beard', 15),
  ('Haircut + Beard', 35);

-- Queue entries
CREATE TABLE public.queue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  token_number integer NOT NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','completed','cancelled')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX queue_entries_status_idx ON public.queue_entries(status, joined_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_entries TO anon, authenticated;
GRANT ALL ON public.queue_entries TO service_role;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read queue" ON public.queue_entries FOR SELECT USING (true);
CREATE POLICY "Public insert queue" ON public.queue_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update queue" ON public.queue_entries FOR UPDATE USING (true);
CREATE POLICY "Public delete queue" ON public.queue_entries FOR DELETE USING (true);

-- Settings (single-row table)
CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name text NOT NULL DEFAULT 'Tinu Barber',
  whatsapp_number text DEFAULT '',
  current_token integer NOT NULL DEFAULT 0,
  is_paused boolean NOT NULL DEFAULT false,
  break_started_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO anon, authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Public insert settings" ON public.settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update settings" ON public.settings FOR UPDATE USING (true);

INSERT INTO public.settings (shop_name, whatsapp_number) VALUES ('Tinu Barber', '');
