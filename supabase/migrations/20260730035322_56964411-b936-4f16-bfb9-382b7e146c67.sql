CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  service_id text NOT NULL,
  service_name text NOT NULL,
  service_price integer NOT NULL,
  service_duration integer NOT NULL,
  booking_date date NOT NULL,
  booking_time text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  google_event_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.bookings TO service_role;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX bookings_unique_active_slot
  ON public.bookings (booking_date, booking_time)
  WHERE status <> 'cancelled';

CREATE INDEX bookings_date_idx ON public.bookings (booking_date);