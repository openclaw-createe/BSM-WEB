import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { SERVICES, TIME_SLOTS, localDateTime, zonedToUtc } from "./booking-shared";
import {
  BookingError,
  createCalendarEvent,
  deleteCalendarEvent,
  fetchBusyIntervals,
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

export const getAvailability = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => availabilitySchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await supabaseAdmin
        .from("bookings")
        .select("booking_time")
        .eq("booking_date", data.date)
        .neq("status", "cancelled");
      if (error) throw new BookingError("db_error", "Could not load availability.");

      const taken = new Set((rows ?? []).map((r: { booking_time: string }) => r.booking_time));

      try {
        const busy = await fetchBusyIntervals(data.date);
        for (const slot of TIME_SLOTS) {
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
      } catch (error) {
        // Calendar unreachable: fall back to database-only availability.
        console.error("freeBusy lookup failed", error);
      }

      return { date: data.date, takenSlots: [...taken] };
    } catch (error) {
      console.error("Availability lookup failed", error);
      return { date: data.date, takenSlots: [] as string[] };
    }
  });

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bookingSchema.parse(data))
  .handler(async ({ data }): Promise<BookingResult> => {
    try {
      const service = SERVICES.find((s) => s.id === data.serviceId);
      if (!service) throw new BookingError("invalid_service", "That service is not available.");
      if (!TIME_SLOTS.includes(data.time))
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
      const { data: row, error } = await supabaseAdmin
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

      if (error) {
        if (error.code === "23505") {
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
