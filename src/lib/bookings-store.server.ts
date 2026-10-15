import { and, eq, ne } from "drizzle-orm";
import { db } from "../../db/index";
import { bookings } from "../../db/schema";
import { mergeContent } from "./site-content";
import { slotsForDate, localDateTime, zonedToUtc } from "./booking-shared";
import { fetchBusyIntervals, fetchEventStatus } from "./booking.server";

export { db, bookings };
export const calendarConnected = () =>
  Boolean(process.env.LOVABLE_API_KEY && process.env.GOOGLE_CALENDAR_API_KEY);

export async function getBookingContent() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("content")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error("Could not load booking settings");
    return mergeContent(data?.content);
  }
  return mergeContent(null);
}

export async function getBookingAvailability(date: string) {
  const rows = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.booking_date, date), ne(bookings.status, "cancelled")));
  const active: typeof rows = [];
  for (const row of rows) {
    if (
      row.google_event_id &&
      calendarConnected() &&
      (await fetchEventStatus(row.google_event_id)) === "cancelled"
    ) {
      await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, row.id));
    } else active.push(row);
  }
  let busy: { start: string; end: string }[] = [];
  let calendarSynced = false;
  if (calendarConnected()) {
    try {
      busy = await fetchBusyIntervals(date);
      calendarSynced = true;
    } catch {
      /* Database remains authoritative. */
    }
  }
  const content = await getBookingContent();
  const takenSlots = slotsForDate(date, content.hours).filter((slot) => {
    const start = zonedToUtc(localDateTime(date, slot)!).getTime();
    return [...active.map((r) => ({ start: r.starts_at, end: r.ends_at })), ...busy].some(
      (b) => start < Date.parse(b.end) && start + 30 * 60_000 > Date.parse(b.start),
    );
  });
  return { date, takenSlots, calendarSynced };
}
