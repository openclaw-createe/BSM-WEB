// Client-safe booking constants and time helpers (no server-only imports).

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
}

export const SERVICES: Service[] = [
  { id: "classic", name: "Classic Cut", description: "Precision scissor cut & finish", price: 35, duration: 45 },
  { id: "fade", name: "Skin Fade", description: "Zero to length gradient fade", price: 40, duration: 45 },
  { id: "lineup", name: "Shape & Lineup", description: "Edge-up & beard line definition", price: 30, duration: 30 },
  { id: "beard", name: "Beard Sculpt", description: "Hot towel, trim & shape", price: 30, duration: 30 },
  { id: "combo", name: "Cut + Beard", description: "Full service — cut & beard combo", price: 60, duration: 75 },
  { id: "kids", name: "Kids Cut (12 & under)", description: "Gentle, precise cut for kids", price: 25, duration: 30 },
];

export const TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "1:00 PM", "2:00 PM", "2:30 PM", "3:00 PM",
  "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM",
  "5:30 PM", "6:00 PM",
];

export const SHOP_TIMEZONE = "America/New_York";

export const SHOP = {
  name: "Barber Shop Machine",
  email: "info@barbershopmachine.com",
  phone: "(631) 394-8763",
  address: "12250 Main Rd, Mattituck, NY 11952",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** "9:30 AM" -> { hour: 9, minute: 30 } in 24h */
export function parseSlot(slot: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(slot.trim());
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return { hour, minute };
}

/** Naive local datetime string for Google Calendar, e.g. "2026-08-01T09:30:00" */
export function localDateTime(date: string, slot: string, addMinutes = 0): string | null {
  const parsed = parseSlot(slot);
  if (!parsed) return null;
  const total = parsed.hour * 60 + parsed.minute + addMinutes;
  const hour = Math.floor(total / 60) % 24;
  const minute = total % 60;
  return `${date}T${pad(hour)}:${pad(minute)}:00`;
}

/** Convert a naive local datetime in `tz` to a real UTC Date. */
export function zonedToUtc(naive: string, tz = SHOP_TIMEZONE): Date {
  const asUtc = new Date(`${naive}Z`);
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(asUtc)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  const offsetMin = m ? (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3] ?? "0", 10)) : 0;
  return new Date(asUtc.getTime() - offsetMin * 60_000);
}

export function formatFriendlyDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
