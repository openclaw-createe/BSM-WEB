import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mergeContent, type GalleryPhoto, type SiteContent } from "./site-content";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getSiteContent = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ content: SiteContent; photos: GalleryPhoto[] }> => {
    try {
      const sb = publicClient();
      const [{ data: settings }, { data: rows }] = await Promise.all([
        sb.from("site_settings").select("content").eq("id", 1).maybeSingle(),
        sb.from("gallery_photos").select("*").order("sort_order").order("created_at"),
      ]);
      let photos: GalleryPhoto[] = [];
      if (rows?.length) {
        const { data: signed } = await sb.storage
          .from("gallery")
          .createSignedUrls(
            rows.map((r) => r.storage_path),
            60 * 60 * 24 * 7,
          );
        photos = rows.map((r, i) => ({
          id: r.id,
          alt: r.alt,
          storage_path: r.storage_path,
          sort_order: r.sort_order,
          url: signed?.[i]?.signedUrl ?? "",
        })).filter((p) => p.url);
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("bookings")
      .select("google_event_id")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.google_event_id) {
      const { deleteCalendarEvent } = await import("./booking.server");
      try {
        await deleteCalendarEvent(row.google_event_id);
      } catch (e) {
        console.error("Calendar delete failed", e);
      }
    }
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw new Error("Could not cancel booking");
    return { ok: true };
  });
