import { pgTable, uuid, text, integer, date, timestamp, index } from "drizzle-orm/pg-core";

export const bookings = pgTable(
  "bookings",
  {
    id: uuid().defaultRandom().primaryKey(),
    customer_name: text().notNull(),
    customer_email: text().notNull(),
    customer_phone: text().notNull(),
    service_id: text().notNull(),
    service_name: text().notNull(),
    service_price: integer().notNull(),
    service_duration: integer().notNull(),
    booking_date: date().notNull(),
    booking_time: text().notNull(),
    starts_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    ends_at: timestamp({ withTimezone: true, mode: "string" }).notNull(),
    status: text().notNull().default("confirmed"),
    google_event_id: text(),
    notes: text(),
    created_at: timestamp({ withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [index("bookings_date_idx").on(table.booking_date)],
);
