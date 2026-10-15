ALTER TABLE bookings ADD CONSTRAINT bookings_no_active_overlap
  EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status <> 'cancelled');
