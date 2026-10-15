import { beforeEach, expect, mock, test } from "bun:test";
import { DEFAULT_CONTENT } from "../src/lib/site-content";

let connected = false;
let insertError: unknown;
let calendarError = false;
let deleted = false;
let savedStatus = "";
const db = {
  insert: () => ({
    values: () => ({
      returning: async () => {
        if (insertError) throw insertError;
        return [{ id: "booking-1" }];
      },
    }),
  }),
  update: () => ({
    set: (value: { status: string }) => ({
      where: async () => {
        savedStatus = value.status;
      },
    }),
  }),
  delete: () => ({
    where: async () => {
      deleted = true;
    },
  }),
};
mock.module("@tanstack/react-start", () => ({
  createServerFn: () => ({ inputValidator: () => ({ handler: (handler: unknown) => handler }) }),
}));
mock.module("../src/lib/bookings-store.server", () => ({
  db,
  bookings: { id: "id" },
  getBookingContent: async () => DEFAULT_CONTENT,
  calendarConnected: () => connected,
}));
class BookingError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
mock.module("../src/lib/booking.server", () => ({
  BookingError,
  fetchBusyIntervals: async () => [],
  createCalendarEvent: async () => {
    if (calendarError) throw new BookingError("calendar_error", "Calendar unavailable");
    return "event-1";
  },
  deleteCalendarEvent: async () => {},
}));
const { createBooking } = await import("../src/lib/bookings.functions");
const submit = createBooking as unknown as (input: { data: unknown }) => Promise<{
  ok: boolean;
  code?: string;
  calendarSynced?: boolean;
}>;
const data = {
  serviceId: "classic",
  date: "2099-10-15",
  time: "10:00 AM",
  name: "Test Customer",
  email: "test@example.com",
  phone: "5551234567",
};
beforeEach(() => {
  connected = false;
  insertError = undefined;
  calendarError = false;
  deleted = false;
  savedStatus = "";
});
test("confirms a persistent booking when calendar credentials are absent", async () => {
  const result = await submit({ data });
  expect(result.ok).toBe(true);
  expect(result.calendarSynced).toBe(false);
  expect(savedStatus).toBe("confirmed");
  expect(deleted).toBe(false);
});
test("reports overlapping database reservations as a taken slot", async () => {
  insertError = { cause: { code: "23P01" } };
  const result = await submit({ data });
  expect(result).toMatchObject({ ok: false, code: "slot_taken" });
});
test("releases the reservation if a configured calendar rejects the booking", async () => {
  connected = true;
  calendarError = true;
  const result = await submit({ data });
  expect(result).toMatchObject({ ok: false, code: "calendar_error" });
  expect(deleted).toBe(true);
});
