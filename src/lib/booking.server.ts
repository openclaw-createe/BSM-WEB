// Server-only booking logic: Google Calendar (via the Lovable connector gateway)
// and the database. Never imported from client code.

import { SHOP, SHOP_TIMEZONE, localDateTime } from "./booking-shared";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

export class BookingError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function gatewayHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectionKey = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!lovableKey || !connectionKey) {
    throw new BookingError(
      "calendar_not_connected",
      "The shop calendar is not connected yet. Please call us to book.",
    );
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
    "Content-Type": "application/json",
  };
}

function calendarId() {
  return process.env.BSM_CALENDAR_ID || SHOP.email;
}

const GATEWAY_TIMEOUT_MS = 12_000;

async function gatewayRequest(path: string, init: RequestInit, timeoutMs = GATEWAY_TIMEOUT_MS) {
  try {
    return await fetch(`${GATEWAY_URL}${path}`, {
      ...init,
      headers: gatewayHeaders(),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof BookingError) throw error;
    console.error(`Google Calendar gateway request failed for ${path}`, error);
    throw new BookingError(
      "calendar_error",
      "We couldn't reach the shop calendar. Your appointment was not booked — please try again.",
    );
  }
}

async function gatewayFetch(path: string, init: RequestInit) {
  const res = await gatewayRequest(path, init);
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Calendar gateway failed [${res.status}]: ${body}`);
    throw new BookingError(
      "calendar_error",
      "We couldn't reach the shop calendar. Your appointment was not booked — please try again.",
    );
  }
  return res.json() as Promise<Record<string, unknown>>;
}

/**
 * Status of a previously created event, used to release slots that were
 * cancelled/deleted directly in Google Calendar.
 */
export async function fetchEventStatus(
  eventId: string,
): Promise<"active" | "cancelled" | "unknown"> {
  try {
    const res = await gatewayRequest(
      `/calendars/${encodeURIComponent(calendarId())}/events/${encodeURIComponent(eventId)}`,
      { method: "GET" },
      8_000,
    );
    if (res.status === 404 || res.status === 410) return "cancelled";
    if (!res.ok) {
      console.error(`Event status lookup failed [${res.status}]: ${await res.text()}`);
      return "unknown";
    }
    const data = (await res.json()) as { status?: string };
    return data.status === "cancelled" ? "cancelled" : "active";
  } catch (error) {
    console.error("Event status lookup error", error);
    return "unknown";
  }
}



/** Busy intervals (UTC ISO strings) for a given day, straight from Google Calendar. */
export async function fetchBusyIntervals(date: string): Promise<{ start: string; end: string }[]> {
  const data = await gatewayFetch("/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: `${date}T00:00:00Z`,
      timeMax: `${date}T23:59:59Z`,
      timeZone: SHOP_TIMEZONE,
      items: [{ id: calendarId() }],
    }),
  });
  const calendars = (data.calendars ?? {}) as Record<string, { busy?: { start: string; end: string }[] }>;
  return calendars[calendarId()]?.busy ?? [];
}

export interface CalendarEventInput {
  service: { name: string; price: number; duration: number };
  date: string;
  slot: string;
  name: string;
  email: string;
  phone: string;
  notes?: string;
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<string> {
  const start = localDateTime(input.date, input.slot);
  const end = localDateTime(input.date, input.slot, input.service.duration);
  if (!start || !end) throw new BookingError("invalid_time", "That time slot is not valid.");

  const description = [
    `Service: ${input.service.name} ($${input.service.price}, ${input.service.duration} min)`,
    `Client: ${input.name}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone}`,
    input.notes ? `Notes: ${input.notes}` : null,
    "",
    "Booked online at barbershopmachine.com",
  ]
    .filter(Boolean)
    .join("\n");

  const event = await gatewayFetch(
    `/calendars/${encodeURIComponent(calendarId())}/events?sendUpdates=all`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: `${input.service.name} — ${input.name}`,
        description,
        location: SHOP.address,
        start: { dateTime: start, timeZone: SHOP_TIMEZONE },
        end: { dateTime: end, timeZone: SHOP_TIMEZONE },
        attendees: [{ email: input.email, displayName: input.name }],
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 1440 },
            { method: "popup", minutes: 60 },
          ],
        },
      }),
    },
  );

  return String(event.id ?? "");
}

export async function deleteCalendarEvent(eventId: string) {
  try {
    await fetch(
      `${GATEWAY_URL}/calendars/${encodeURIComponent(calendarId())}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE", headers: gatewayHeaders() },
    );
  } catch (error) {
    console.error("Failed to roll back calendar event", error);
  }
}
