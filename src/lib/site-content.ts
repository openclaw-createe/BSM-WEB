// Client-safe site content model + defaults. Stored as JSON in site_settings.content.
import { SERVICES, type Service } from "./booking-shared";

export interface HoursRow {
  day: string;
  time: string;
}

export interface SiteContent {
  hero: { titleLine1: string; titleLine2: string; subtitle: string; bookButton: string };
  stats: { val: string; label: string }[];
  services: Service[];
  business: { phone: string; address: string; instagram: string; email: string };
  hours: HoursRow[];
  footer: { tagline: string; copyright: string };
}

export interface GalleryPhoto {
  id: string;
  url: string;
  alt: string;
  storage_path: string;
  sort_order: number;
}

export const DEFAULT_CONTENT: SiteContent = {
  hero: {
    titleLine1: "Barber Shop",
    titleLine2: "Machine",
    subtitle: "Mattituck, New York",
    bookButton: "Book Your Appointment",
  },
  stats: [
    { val: "6+", label: "Years" },
    { val: "4.9★", label: "Rating" },
    { val: "100%", label: "Fresh" },
  ],
  services: SERVICES,
  business: {
    phone: "(631) 394-8763",
    address: "12250 Main Rd, Mattituck, NY 11952",
    instagram: "https://instagram.com",
    email: "info@barbershopmachine.com",
  },
  hours: [
    { day: "Monday", time: "10:00 AM – 8:30 PM" },
    { day: "Tuesday", time: "10:00 AM – 8:30 PM" },
    { day: "Wednesday", time: "10:00 AM – 8:30 PM" },
    { day: "Thursday", time: "10:00 AM – 8:30 PM" },
    { day: "Friday", time: "10:00 AM – 8:30 PM" },
    { day: "Saturday", time: "9:00 AM – 8:30 PM" },
    { day: "Sunday", time: "10:00 AM – 5:00 PM" },
  ],
  footer: { tagline: "Mattituck, New York", copyright: "© 2025 Barber Shop Machine · Mattituck, NY" },
};

/** Merge stored (possibly partial) JSON over defaults. */
export function mergeContent(raw: unknown): SiteContent {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<SiteContent>;
  return {
    hero: { ...DEFAULT_CONTENT.hero, ...(r.hero ?? {}) },
    stats: Array.isArray(r.stats) && r.stats.length ? r.stats : DEFAULT_CONTENT.stats,
    services:
      Array.isArray(r.services) && r.services.length ? r.services : DEFAULT_CONTENT.services,
    business: { ...DEFAULT_CONTENT.business, ...(r.business ?? {}) },
    hours: Array.isArray(r.hours) && r.hours.length ? r.hours : DEFAULT_CONTENT.hours,
    footer: { ...DEFAULT_CONTENT.footer, ...(r.footer ?? {}) },
  };
}

export const phoneRaw = (phone: string) => "+1" + phone.replace(/\D/g, "").slice(-10);
export const encodeAddress = (a: string) => encodeURIComponent(a).replace(/%20/g, "+");
