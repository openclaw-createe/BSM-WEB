import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { localDateTime, slotsForDate, zonedToUtc } from "./booking-shared";
import { mergeContent } from "./site-content";
import {
  BookingError,
  createCalendarEvent,
  deleteCalendarEvent,
  fetchBusyIntervals,
  fetchEventStatus,
} from "./booking.server";

export type BookingResult =
  | {
      ok: true;
      id: string;
      service: string;
      price: number;
      date: string;
      time: string;
      email: string;
    }
  | { ok: false; code: string; message: string };

export type AvailabilityResult = {
  date: string;
  takenSlots: string[];
  calendarSynced: boolean;
  warning?: string;
};

const availabilitySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

const bookingSchema = z.object({
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(6).max(40),
  notes: z.string().trim().max(500).optional(),
});

type ActiveRow = { id: string; booking_time: string; google_event_id: string | null };

/**
 * Releases DB rows whose Google Calendar event was cancelled/deleted directly
 * in the calendar, and returns the slots that are still genuinely taken.
 */
async function reconcileRows(
  supabaseAdmin: Awaited<
    typeof import("@/integrations/supabase/client.server")
  >["supabaseAdmin"],
  rows: ActiveRow[],
): Promise<{ taken: Set<string>; releasedIds: string[] }> {
  const taken = new Set<string>();
  const releasedIds: string[] = [];

  const statuses = await Promise.all(
    rows.map(async (row) =>
      row.google_event_id ? await fetchEventStatus(row.google_event_id) : ("active" as const),
    ),
  );

  rows.forEach((row, i) => {
    if (statuses[i] === "cancelled") releasedIds.push(row.id);
    else taken.add(row.booking_time);
  });

  if (releasedIds.length) {
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled" })
      .in("id", releasedIds);
    if (error) console.error("Failed to release cancelled bookings", error);
  }

  return { taken, releasedIds };
}

export const getAvailability = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => availabilitySchema.parse(data))
  .handler(async ({ data }): Promise<AvailabilityResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("bookings")
      .select("id, booking_time, google_event_id")
      .eq("booking_date", data.date)
      .neq("status", "cancelled");

    if (error) {
      console.error("Availability DB lookup failed", error);
      // Never claim everything is free: that leads to failed confirmations.
      return {
        date: data.date,
        takenSlots: Array.from({ length: 48 }, (_, i) => `${(Math.floor(i / 2) % 12) || 12}:${i % 2 ? "30" : "00"} ${i < 24 ? "AM" : "PM"}`),
        calendarSynced: false,
        warning: "We couldn't load availability right now. Please try again in a moment.",
      };
    }

    const { data: settings } = await supabaseAdmin
      .from("site_settings")
      .select("content")
      .eq("id", 1)
      .maybeSingle();
    const daySlots = slotsForDate(data.date, mergeContent(settings?.content).hours);

    const { taken } = await reconcileRows(supabaseAdmin, (rows ?? []) as ActiveRow[]);

    let calendarSynced = true;
    try {
      const busy = await fetchBusyIntervals(data.date);
      for (const slot of daySlots) {
        const startLocal = localDateTime(data.date, slot);
        if (!startLocal) continue;
        const start = zonedToUtc(startLocal).getTime();
        const end = start + 30 * 60_000;
        if (
          busy.some((b) => start < new Date(b.end).getTime() && end > new Date(b.start).getTime())
        ) {
          taken.add(slot);
        }
      }
    } catch (calendarError) {
      // Calendar unreachable: fall back to database-only availability.
      console.error("freeBusy lookup failed", calendarError);
      calendarSynced = false;
    }

    return {
      date: data.date,
      takenSlots: [...taken],
      calendarSynced,
      warning: calendarSynced
        ? undefined
        : "Live calendar sync is temporarily unavailable — some times may already be booked.",
    };
  });


export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bookingSchema.parse(data))
  .handler(async ({ data }): Promise<BookingResult> => {
    try {
      const { supabaseAdmin: sbSettings } = await import("@/integrations/supabase/client.server");
      const { data: settings } = await sbSettings
        .from("site_settings")
        .select("content")
        .eq("id", 1)
        .maybeSingle();
      const merged = mergeContent(settings?.content);
      const service = merged.services.find((s) => s.id === data.serviceId);
      if (!service) throw new BookingError("invalid_service", "That service is not available.");
      if (!slotsForDate(data.date, merged.hours).includes(data.time))
        throw new BookingError("invalid_time", "That time slot is not valid.");

      const startLocal = localDateTime(data.date, data.time);
      const endLocal = localDateTime(data.date, data.time, service.duration);
      if (!startLocal || !endLocal)
        throw new BookingError("invalid_time", "That time slot is not valid.");
      const startsAt = zonedToUtc(startLocal);
      const endsAt = zonedToUtc(endLocal);
      if (startsAt.getTime() < Date.now()) {
        throw new BookingError(
          "past_slot",
          "That time has already passed. Please pick another slot.",
        );
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Claim the slot first: the partial unique index makes double booking impossible.
      const insertRow = () =>
        supabaseAdmin
          .from("bookings")
          .insert({
            customer_name: data.name,
            customer_email: data.email,
            customer_phone: data.phone,
            service_id: service.id,
            service_name: service.name,
            service_price: service.price,
            service_duration: service.duration,
            booking_date: data.date,
            booking_time: data.time,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            status: "pending",
            notes: data.notes ?? null,
          })
          .select("id")
          .single();

      let { data: row, error } = await insertRow();

      if (error?.code === "23505") {
        // The blocking row may belong to an appointment cancelled directly in
        // Google Calendar — release it and retry once.
        const { data: conflicting } = await supabaseAdmin
          .from("bookings")
          .select("id, booking_time, google_event_id")
          .eq("booking_date", data.date)
          .eq("booking_time", data.time)
          .neq("status", "cancelled");

        const { releasedIds } = await reconcileRows(
          supabaseAdmin,
          (conflicting ?? []) as ActiveRow[],
        );
        if (releasedIds.length) {
          ({ data: row, error } = await insertRow());
        }
      }

      if (error || !row) {
        if (error?.code === "23505") {
          throw new BookingError(
            "slot_taken",
            "Sorry, that time was just booked. Please choose another slot.",
          );
        }
        console.error("Booking insert failed", error);
        throw new BookingError("db_error", "We couldn't save your appointment. Please try again.");
      }


      let eventId = "";
      try {
        eventId = await createCalendarEvent({
          service,
          date: data.date,
          slot: data.time,
          name: data.name,
          email: data.email,
          phone: data.phone,
          notes: data.notes,
        });
      } catch (calendarError) {
        await supabaseAdmin.from("bookings").delete().eq("id", row.id);
        throw calendarError;
      }

      const { error: updateError } = await supabaseAdmin
        .from("bookings")
        .update({ status: "confirmed", google_event_id: eventId })
        .eq("id", row.id);

      if (updateError) {
        if (eventId) await deleteCalendarEvent(eventId);
        await supabaseAdmin.from("bookings").delete().eq("id", row.id);
        throw new BookingError(
          "db_error",
          "We couldn't confirm your appointment. Please try again.",
        );
      }

      return {
        ok: true as const,
        id: row.id as string,
        service: service.name,
        price: service.price,
        date: data.date,
        time: data.time,
        email: data.email,
      };
    } catch (error) {
      if (error instanceof BookingError) {
        return { ok: false as const, code: error.code, message: error.message };
      }
      console.error("Unexpected booking failure", error);
      return {
        ok: false as const,
        code: "unexpected",
        message: "Something went wrong. Your appointment was not booked — please try again.",
      };
    }
  });
