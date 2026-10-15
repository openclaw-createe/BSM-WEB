import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mergeContent, type GalleryPhoto, type SiteContent } from "./site-content";

export const getSiteContent = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ content: SiteContent; photos: GalleryPhoto[] }> => {
    try {
      // Site content tables are admin-only in the database; the server reads them for visitors.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ data: settings }, { data: rows }] = await Promise.all([
        supabaseAdmin.from("site_settings").select("content").eq("id", 1).maybeSingle(),
        supabaseAdmin
          .from("gallery_photos")
          .select("id, alt, storage_path, sort_order")
          .order("sort_order")
          .order("created_at"),
      ]);
      let photos: GalleryPhoto[] = [];
      if (rows?.length) {
        const { data: signed } = await supabaseAdmin.storage.from("gallery").createSignedUrls(
          rows.map((r) => r.storage_path),
          60 * 60 * 24 * 7,
        );
        photos = rows
          .map((r, i) => ({
            id: r.id,
            alt: r.alt,
            storage_path: r.storage_path,
            sort_order: r.sort_order,
            url: signed?.[i]?.signedUrl ?? "",
          }))
          .filter((p) => p.url);
      }
      return { content: mergeContent(settings?.content), photos };
    } catch (e) {
      console.error("getSiteContent failed", e);
      return { content: mergeContent(null), photos: [] };
    }
  },
);

/** Admin-only: cancel a booking and remove its Google Calendar event. */
export const cancelBookingAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { db, bookings } = await import("./bookings-store.server");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(bookings).where(eq(bookings.id, data.id));
    if (row?.google_event_id) {
      const { deleteCalendarEvent } = await import("./booking.server");
      await deleteCalendarEvent(row.google_event_id);
    }
    await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, data.id));
    return { ok: true };
  });

export const listBookingsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ showPast: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { db, bookings } = await import("./bookings-store.server");
    const { lt, gte, asc, desc } = await import("drizzle-orm");
    const now = new Date().toISOString();
    return db
      .select()
      .from(bookings)
      .where(data.showPast ? lt(bookings.starts_at, now) : gte(bookings.starts_at, now))
      .orderBy(data.showPast ? desc(bookings.starts_at) : asc(bookings.starts_at))
      .limit(200);
  });
