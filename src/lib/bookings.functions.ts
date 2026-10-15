import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { localDateTime, slotsForDate, zonedToUtc } from "./booking-shared";
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
      calendarSynced: boolean;
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

export const getAvailability = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => availabilitySchema.parse(data))
  .handler(async ({ data }): Promise<AvailabilityResult> => {
    const { getBookingAvailability } = await import("./bookings-store.server");
    try {
      return await getBookingAvailability(data.date);
    } catch {
      return {
        date: data.date,
        takenSlots: Array.from(
          { length: 48 },
          (_, i) =>
            `${Math.floor(i / 2) % 12 || 12}:${i % 2 ? "30" : "00"} ${i < 24 ? "AM" : "PM"}`,
        ),
        calendarSynced: false,
        warning: "We couldn't load availability right now. Please try again in a moment.",
      };
    }
  });

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bookingSchema.parse(data))
  .handler(async ({ data }): Promise<BookingResult> => {
    try {
      const { db, bookings, getBookingContent, calendarConnected } =
        await import("./bookings-store.server");
      const { sql } = await import("drizzle-orm");
      const merged = await getBookingContent();
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

      if (calendarConnected()) {
        const busy = await fetchBusyIntervals(data.date);
        if (
          busy.some(
            (interval) =>
              startsAt.getTime() < Date.parse(interval.end) &&
              endsAt.getTime() > Date.parse(interval.start),
          )
        ) {
          throw new BookingError(
            "slot_taken",
            "Sorry, that time was just booked. Please choose another slot.",
          );
        }
      }

      // The database exclusion constraint also prevents overlapping services.
      let row: { id: string };
      try {
        [row] = await db
          .insert(bookings)
          .values({
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
          .returning({ id: bookings.id });
      } catch (error) {
        const code = error as { cause?: { code?: string }; code?: string };
        if (["23505", "23P01"].includes(code.cause?.code ?? code.code ?? "")) {
          throw new BookingError(
            "slot_taken",
            "Sorry, that time was just booked. Please choose another slot.",
          );
        }
        throw new BookingError("db_error", "We couldn't save your appointment. Please try again.");
      }

      let eventId = "";
      try {
        if (calendarConnected())
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
        await db.delete(bookings).where(sql`${bookings.id} = ${row.id}`);
        throw calendarError;
      }

      try {
        await db
          .update(bookings)
          .set({ status: "confirmed", google_event_id: eventId || null })
          .where(sql`${bookings.id} = ${row.id}`);
      } catch {
        if (eventId) await deleteCalendarEvent(eventId);
        await db.delete(bookings).where(sql`${bookings.id} = ${row.id}`);
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
        calendarSynced: Boolean(eventId),
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
