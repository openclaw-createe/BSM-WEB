import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSiteContent, cancelBookingAdmin } from "@/lib/site.functions";
import { mergeContent, type SiteContent, type GalleryPhoto } from "@/lib/site-content";
import { formatFriendlyDate } from "@/lib/booking-shared";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Owner Panel — Barber Shop Machine" },
      { name: "description", content: "Private panel to manage the Barber Shop Machine website." },
      { property: "og:title", content: "Owner Panel — Barber Shop Machine" },
      { property: "og:description", content: "Private owner panel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Tab = "photos" | "services" | "hours" | "texts" | "bookings";
const input =
  "w-full rounded-xl px-3 py-2 text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:border-[#c9a84c]";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-white/40 text-[10px] tracking-widest uppercase">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function AdminPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [tab, setTab] = useState<Tab>("photos");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setEmail(data.user.email ?? "");
      const { data: ok } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
      setIsAdmin(!!ok);
    })();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (isAdmin === null)
    return <Shell><p className="text-white/50 text-sm">Cargando…</p></Shell>;
  if (!isAdmin)
    return (
      <Shell>
        <p className="text-white mb-2">Esta cuenta ({email}) no tiene acceso al panel.</p>
        <p className="text-white/50 text-sm mb-4">Entra con info@barbershopmachine.com.</p>
        <button onClick={signOut} className="btn-glass px-4 py-2 rounded-xl text-sm">Cerrar sesión</button>
      </Shell>
    );

  const tabs: [Tab, string][] = [
    ["photos", "Fotos"],
    ["services", "Servicios"],
    ["hours", "Horario y contacto"],
    ["texts", "Textos"],
    ["bookings", "Reservas"],
  ];

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="display-serif text-3xl font-bold text-white">Panel BSM</h1>
        <div className="flex gap-2">
          <a href="/" className="btn-glass px-3 py-2 rounded-xl text-xs">Ver web</a>
          <button onClick={signOut} className="btn-glass px-3 py-2 rounded-xl text-xs">Salir</button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-full text-xs whitespace-nowrap ${tab === id ? "btn-gold" : "btn-glass"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "photos" && <PhotosTab />}
      {tab === "bookings" && <BookingsTab />}
      {(tab === "services" || tab === "hours" || tab === "texts") && <ContentTab tab={tab} />}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen px-5 py-10" style={{ background: "#080808" }}>
      <div className="max-w-2xl mx-auto">{children}</div>
    </div>
  );
}

function useSite() {
  const fetchSite = useServerFn(getSiteContent);
  return useQuery({ queryKey: ["site-content"], queryFn: () => fetchSite() });
}

// ─── Photos ──────────────────────────────────────────────
function PhotosTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useSite();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const photos = data?.photos ?? [];

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setMsg("");
    try {
      let order = photos.length;
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("gallery").upload(path, file, {
          contentType: file.type,
        });
        if (upErr) throw upErr;
        const { error } = await supabase
          .from("gallery_photos")
          .insert({ storage_path: path, alt: file.name.replace(/\.[^.]+$/, ""), sort_order: order++ });
        if (error) throw error;
      }
      setMsg("Fotos subidas ✓");
      await qc.invalidateQueries({ queryKey: ["site-content"] });
    } catch (e) {
      console.error(e);
      setMsg("Error al subir la foto. Inténtalo de nuevo.");
    }
    setBusy(false);
  };

  const remove = async (p: GalleryPhoto) => {
    if (!confirm("¿Borrar esta foto de la web?")) return;
    await supabase.storage.from("gallery").remove([p.storage_path]);
    await supabase.from("gallery_photos").delete().eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["site-content"] });
  };

  const download = async (p: GalleryPhoto) => {
    const { data: blob } = await supabase.storage.from("gallery").download(p.storage_path);
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = p.storage_path;
    a.click();
  };

  const updateAlt = async (p: GalleryPhoto, alt: string) => {
    await supabase.from("gallery_photos").update({ alt }).eq("id", p.id);
  };

  const makeMain = async (p: GalleryPhoto) => {
    const minOrder = Math.min(...photos.map((x) => x.sort_order)) - 1;
    await supabase.from("gallery_photos").update({ sort_order: minOrder }).eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["site-content"] });
  };

  return (
    <div className="space-y-4">
      <label className="btn-gold block text-center py-4 rounded-2xl text-sm font-semibold cursor-pointer">
        {busy ? "Subiendo…" : "+ Subir fotos de tu trabajo"}
        <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={(e) => upload(e.target.files)} />
      </label>
      {msg && <p className="text-[#c9a84c] text-xs">{msg}</p>}
      <p className="text-white/40 text-xs">La primera foto es la grande de la galería. Si no hay fotos, se muestran las de ejemplo.</p>
      {isLoading && <p className="text-white/50 text-sm">Cargando…</p>}
      <div className="grid grid-cols-2 gap-3">
        {photos.map((p, i) => (
          <div key={p.id} className="glass rounded-2xl overflow-hidden">
            <img src={p.url} alt={p.alt} className="w-full aspect-square object-cover" />
            <div className="p-3 space-y-2">
              <input className={input} defaultValue={p.alt} placeholder="Descripción" onBlur={(e) => updateAlt(p, e.target.value)} />
              <div className="flex flex-wrap gap-1">
                {i > 0 && <button onClick={() => makeMain(p)} className="btn-glass px-2 py-1 rounded-lg text-[10px]">Principal</button>}
                <button onClick={() => download(p)} className="btn-glass px-2 py-1 rounded-lg text-[10px]">Descargar</button>
                <button onClick={() => remove(p)} className="px-2 py-1 rounded-lg text-[10px] text-red-400 border border-red-400/30">Borrar</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Content (services / hours / texts) ──────────────────
function ContentTab({ tab }: { tab: "services" | "hours" | "texts" }) {
  const qc = useQueryClient();
  const { data } = useSite();
  const [c, setC] = useState<SiteContent | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !c) setC(mergeContent(data.content));
  }, [data, c]);
  if (!c) return <p className="text-white/50 text-sm">Cargando…</p>;

  const save = async () => {
    setSaving(true);
    setMsg("");
    const { error } = await supabase
      .from("site_settings")
      .update({ content: JSON.parse(JSON.stringify(c)), updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      setMsg("No se pudo guardar. Inténtalo de nuevo.");
      return;
    }
    setMsg("Guardado ✓ — ya se ve en la web");
    qc.invalidateQueries({ queryKey: ["site-content"] });
  };

  return (
    <div className="space-y-4">
      {tab === "services" && (
        <>
          {c.services.map((s, i) => {
            const set = (patch: Partial<typeof s>) =>
              setC({ ...c, services: c.services.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={s.id} className="glass rounded-2xl p-4 space-y-3">
                <Field label="Nombre"><input className={input} value={s.name} onChange={(e) => set({ name: e.target.value })} /></Field>
                <Field label="Descripción"><input className={input} value={s.description} onChange={(e) => set({ description: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Precio ($)"><input type="number" min={0} className={input} value={s.price} onChange={(e) => set({ price: Number(e.target.value) })} /></Field>
                  <Field label="Duración (min)"><input type="number" min={5} step={5} className={input} value={s.duration} onChange={(e) => set({ duration: Number(e.target.value) })} /></Field>
                </div>
                <button
                  onClick={() => confirm("¿Quitar este servicio?") && setC({ ...c, services: c.services.filter((_, j) => j !== i) })}
                  className="text-red-400 text-xs"
                >
                  Quitar servicio
                </button>
              </div>
            );
          })}
          <button
            onClick={() =>
              setC({
                ...c,
                services: [...c.services, { id: `svc-${Date.now()}`, name: "Nuevo servicio", description: "", price: 30, duration: 30 }],
              })
            }
            className="btn-glass w-full py-3 rounded-2xl text-sm"
          >
            + Añadir servicio
          </button>
        </>
      )}

      {tab === "hours" && (
        <>
          <div className="glass rounded-2xl p-4 space-y-3">
            <p className="text-white text-sm font-semibold">Horario</p>
            {c.hours.map((h, i) => (
              <div key={i} className="grid grid-cols-[110px_1fr] gap-2 items-center">
                <span className="text-white/60 text-sm">{h.day}</span>
                <input
                  className={input}
                  value={h.time}
                  onChange={(e) => setC({ ...c, hours: c.hours.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)) })}
                />
              </div>
            ))}
            <p className="text-white/30 text-[10px]">Ej: "10:00 AM – 8:30 PM" o "Closed"</p>
          </div>
          <div className="glass rounded-2xl p-4 space-y-3">
            <p className="text-white text-sm font-semibold">Contacto</p>
            <Field label="Teléfono"><input className={input} value={c.business.phone} onChange={(e) => setC({ ...c, business: { ...c.business, phone: e.target.value } })} /></Field>
            <Field label="Dirección"><input className={input} value={c.business.address} onChange={(e) => setC({ ...c, business: { ...c.business, address: e.target.value } })} /></Field>
            <Field label="Instagram (enlace)"><input className={input} value={c.business.instagram} onChange={(e) => setC({ ...c, business: { ...c.business, instagram: e.target.value } })} /></Field>
          </div>
        </>
      )}

      {tab === "texts" && (
        <>
          <div className="glass rounded-2xl p-4 space-y-3">
            <p className="text-white text-sm font-semibold">Portada</p>
            <Field label="Título línea 1"><input className={input} value={c.hero.titleLine1} onChange={(e) => setC({ ...c, hero: { ...c.hero, titleLine1: e.target.value } })} /></Field>
            <Field label="Título línea 2 (dorado)"><input className={input} value={c.hero.titleLine2} onChange={(e) => setC({ ...c, hero: { ...c.hero, titleLine2: e.target.value } })} /></Field>
            <Field label="Subtítulo"><input className={input} value={c.hero.subtitle} onChange={(e) => setC({ ...c, hero: { ...c.hero, subtitle: e.target.value } })} /></Field>
            <Field label="Texto del botón"><input className={input} value={c.hero.bookButton} onChange={(e) => setC({ ...c, hero: { ...c.hero, bookButton: e.target.value } })} /></Field>
          </div>
          <div className="glass rounded-2xl p-4 space-y-3">
            <p className="text-white text-sm font-semibold">Cifras de la portada</p>
            {c.stats.map((s, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <input className={input} value={s.val} onChange={(e) => setC({ ...c, stats: c.stats.map((x, j) => (j === i ? { ...x, val: e.target.value } : x)) })} />
                <input className={input} value={s.label} onChange={(e) => setC({ ...c, stats: c.stats.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              </div>
            ))}
          </div>
          <div className="glass rounded-2xl p-4 space-y-3">
            <p className="text-white text-sm font-semibold">Pie de página</p>
            <Field label="Frase"><input className={input} value={c.footer.tagline} onChange={(e) => setC({ ...c, footer: { ...c.footer, tagline: e.target.value } })} /></Field>
            <Field label="Copyright"><input className={input} value={c.footer.copyright} onChange={(e) => setC({ ...c, footer: { ...c.footer, copyright: e.target.value } })} /></Field>
          </div>
        </>
      )}

      <div className="sticky bottom-4">
        <button onClick={save} disabled={saving} className="btn-gold w-full py-4 rounded-2xl text-sm font-semibold">
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        {msg && <p className="text-[#c9a84c] text-xs mt-2 text-center">{msg}</p>}
      </div>
    </div>
  );
}

// ─── Bookings ────────────────────────────────────────────
function BookingsTab() {
  const cancel = useServerFn(cancelBookingAdmin);
  const [showPast, setShowPast] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-bookings", showPast],
    queryFn: async () => {
      let q = supabase.from("bookings").select("*").order("starts_at", { ascending: !showPast });
      const now = new Date().toISOString();
      q = showPast ? q.lt("starts_at", now) : q.gte("starts_at", now);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data;
    },
  });

  const onCancel = async (id: string) => {
    if (!confirm("¿Cancelar esta cita? También se borrará de Google Calendar.")) return;
    try {
      await cancel({ data: { id } });
      refetch();
    } catch {
      alert("No se pudo cancelar. Inténtalo de nuevo.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setShowPast(false)} className={`px-3 py-1.5 rounded-full text-xs ${!showPast ? "btn-gold" : "btn-glass"}`}>Próximas</button>
        <button onClick={() => setShowPast(true)} className={`px-3 py-1.5 rounded-full text-xs ${showPast ? "btn-gold" : "btn-glass"}`}>Pasadas</button>
      </div>
      {isLoading && <p className="text-white/50 text-sm">Cargando…</p>}
      {data?.length === 0 && <p className="text-white/50 text-sm">No hay reservas.</p>}
      {data?.map((b) => (
        <div key={b.id} className="glass rounded-2xl p-4">
          <div className="flex justify-between gap-3">
            <div>
              <p className="text-white font-semibold">{b.customer_name}</p>
              <p className="text-white/60 text-xs">{b.service_name} · ${b.service_price}</p>
              <p className="text-[#c9a84c] text-xs mt-1">{formatFriendlyDate(b.booking_date)} · {b.booking_time}</p>
              <p className="text-white/40 text-xs mt-1">
                <a href={`mailto:${b.customer_email}`}>{b.customer_email}</a> · <a href={`tel:${b.customer_phone}`}>{b.customer_phone}</a>
              </p>
            </div>
            <div className="text-right">
              <span className={`text-[10px] uppercase tracking-widest ${b.status === "cancelled" ? "text-red-400" : "text-white/50"}`}>
                {b.status === "cancelled" ? "Cancelada" : b.status === "confirmed" ? "Confirmada" : b.status}
              </span>
              {b.status !== "cancelled" && !showPast && (
                <button onClick={() => onCancel(b.id)} className="block mt-2 text-red-400 text-xs">Cancelar</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
