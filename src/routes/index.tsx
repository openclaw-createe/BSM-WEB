import { createFileRoute } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { TIME_SLOTS, type Service } from "@/lib/booking-shared";
import { createBooking, getAvailability } from "@/lib/bookings.functions";
import img3550 from "@/assets/img-3550.jpg";
import { DEFAULT_CONTENT, encodeAddress, phoneRaw, type GalleryPhoto, type SiteContent } from "@/lib/site-content";
import { getSiteContent } from "@/lib/site.functions";

const siteQuery = queryOptions({ queryKey: ["site-content"], queryFn: () => getSiteContent() });
import img3553 from "@/assets/img-3553.jpg";

/** Never let a hanging server call leave the UI stuck in a loading state. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms),
    ),
  ]);
}



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Barber Shop Machine — Premium Cuts in Mattituck, NY" },
      {
        name: "description",
        content:
          "Precision cuts, skin fades and beard sculpts at Barber Shop Machine in Mattituck, New York. Book your appointment online.",
      },
      { property: "og:title", content: "Barber Shop Machine — Mattituck, NY" },
      {
        property: "og:description",
        content:
          "Premium barbering in Mattituck, NY. Classic cuts, skin fades, beard sculpts. Book online.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Barber Shop Machine — Mattituck, NY" },
      {
        name: "twitter:description",
        content: "Precision cuts & beard work. Book online.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(siteQuery),
  component: Index,
});

// ─── Types ───────────────────────────────────────────────
interface Review {
  name: string;
  rating: number;
  text: string;
  date: string;
  avatar: string;
}

// ─── Data ────────────────────────────────────────────────
const REVIEWS: Review[] = [
  {
    name: "Marcus T.",
    rating: 5,
    text: "Every time I walk out of BSM I feel like a new person. Clean cuts, great energy, and they always take their time.",
    date: "July 2025",
    avatar: "M",
  },
  {
    name: "Jordan R.",
    rating: 5,
    text: "Clean shop, professional vibes, and they always have me looking fresh. Highly recommend.",
    date: "June 2025",
    avatar: "J",
  },
  {
    name: "Carlos V.",
    rating: 5,
    text: "Booked online and it was smooth as it gets. Walked in, zero wait, walked out looking like money.",
    date: "June 2025",
    avatar: "C",
  },
  {
    name: "Devon W.",
    rating: 5,
    text: "The beard sculpt alone is worth the trip. These guys take their craft seriously. Won't go anywhere else.",
    date: "May 2025",
    avatar: "D",
  },
];

const SiteCtx = createContext<{ content: SiteContent; photos: GalleryPhoto[] }>({
  content: DEFAULT_CONTENT,
  photos: [],
});
const useSite = () => useContext(SiteCtx);
function useBiz() {
  const { content } = useSite();
  const b = content.business;
  return {
    ...b,
    phoneRaw: phoneRaw(b.phone),
    addressEncoded: encodeAddress(b.address),
    hours: content.hours,
  };
}

// ─── Helpers ─────────────────────────────────────────────
function getNext14Days() {
  const days: { label: string; short: string; value: string; dayName: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const short = d.getDate().toString();
    const value = d.toISOString().split("T")[0];
    days.push({ label, short, value, dayName });
  }
  return days;
}

// ─── Sub-components ──────────────────────────────────────
function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-16 h-16 text-xl" };
  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center flex-shrink-0`}
      style={{
        background: "linear-gradient(135deg, #c9a84c 0%, #e8c96a 50%, #c9a84c 100%)",
        boxShadow: "0 0 20px rgba(201,168,76,0.3)",
      }}
    >
      <span
        className="font-bold tracking-tight text-black"
        style={{ fontFamily: "Playfair Display, serif", lineHeight: 1 }}
      >
        BSM
      </span>
    </div>
  );
}

function Stars({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i < count ? "star-gold" : "text-white/20"}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Sections ────────────────────────────────────────────
function Nav({ onBook }: { onBook: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(8,8,8,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(201,168,76,0.08)" : "none",
      }}
    >
      <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <div>
            <p
              className="text-white font-semibold text-sm leading-none tracking-wide"
              style={{ fontFamily: "Playfair Display, serif" }}
            >
              BSM
            </p>
            <p className="text-white/40 text-[9px] tracking-widest uppercase leading-none mt-0.5">
              Barber Shop
            </p>
          </div>
        </div>
        <button
          onClick={onBook}
          className="btn-gold px-4 py-2 rounded-full text-xs font-semibold tracking-wide"
        >
          Book Now
        </button>
      </div>
    </nav>
  );
}

function Hero({ onBook }: { onBook: () => void }) {
  const biz = useBiz();
  const { content } = useSite();
  return (
    <section className="relative min-h-screen flex flex-col justify-end overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={img3553}
          alt="Barber Shop Machine signature chair"
          className="w-full h-full object-cover"
          style={{
            objectPosition: "center 30%",
            transform: "scale(0.92)",
            transformOrigin: "center center",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(8,8,8,0.55) 0%, rgba(8,8,8,0.2) 30%, rgba(8,8,8,0.75) 65%, rgba(8,8,8,1) 100%)",
          }}
        />
      </div>
      <div className="relative z-10 max-w-lg mx-auto w-full px-6 pb-16 pt-32">
        <h1 className="display-serif text-6xl font-black text-white leading-[1.0] mb-3 tracking-tight">
          {content.hero.titleLine1}
          <br />
          <em className="not-italic" style={{ color: "#c9a84c" }}>
            {content.hero.titleLine2}
          </em>
        </h1>
        <p className="text-white/50 text-sm font-light tracking-widest uppercase mb-8">
          {content.hero.subtitle}
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onBook}
            className="btn-gold w-full py-4 rounded-2xl text-sm font-semibold tracking-wide"
          >
            {content.hero.bookButton}
          </button>
          <a
            href={`tel:${biz.phoneRaw}`}
            className="btn-glass w-full py-4 rounded-2xl text-sm font-medium tracking-wide text-center"
          >
            {biz.phone}
          </a>
        </div>
        <div className="mt-10 grid grid-cols-3 gap-3">
          {content.stats.map(({ val, label }) => (
            <div key={label} className="glass rounded-2xl p-4 text-center">
              <p className="display-serif text-2xl font-bold text-white">{val}</p>
              <p className="text-white/40 text-[10px] tracking-widest uppercase mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Services({ onBook }: { onBook: (service?: Service) => void }) {
  const SERVICES = useSite().content.services;
  return (
    <section className="relative py-20 px-5 max-w-lg mx-auto">
      <div className="mb-8">
        <span className="section-label">What We Do</span>
        <h2 className="display-serif text-4xl font-bold text-white mt-2 leading-tight">
          Services &<br />
          <em className="not-italic" style={{ color: "#c9a84c" }}>
            Pricing
          </em>
        </h2>
      </div>
      <div className="space-y-3">
        {SERVICES.map((service) => (
          <button
            key={service.id}
            onClick={() => onBook(service)}
            className="glass w-full rounded-2xl p-5 text-left transition-all duration-200 active:scale-[0.98] group"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-white font-semibold text-base leading-tight group-hover:text-[#c9a84c] transition-colors">
                  {service.name}
                </p>
                <p className="text-white/40 text-xs mt-1 font-light">{service.description}</p>
                <p className="text-white/30 text-[10px] mt-1.5 tracking-wide">
                  {service.duration} min
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="display-serif text-2xl font-bold" style={{ color: "#c9a84c" }}>
                  ${service.price}
                </span>
                <span className="text-white/30 text-[10px] tracking-widest uppercase">Book →</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function Booking({ initialService }: { initialService?: Service }) {
  const SERVICES = useSite().content.services;
  const [step, setStep] = useState(initialService ? 1 : 0);
  const [selectedService, setSelectedService] = useState<Service | undefined>(initialService);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taken, setTaken] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [done, setDone] = useState(false);
  const days = getNext14Days();

  useEffect(() => {
    if (initialService) {
      setSelectedService(initialService);
      setStep(1);
    }
  }, [initialService]);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    setLoadingSlots(true);
    setTaken([]);
    setError("");
    withTimeout(getAvailability({ data: { date: selectedDate } }), 30_000)
      .then((res) => {
        if (cancelled) return;
        setTaken(res.takenSlots);
        if (res.warning) setError(res.warning);
      })
      .catch(() => {
        if (!cancelled)
          setError("We couldn't load availability. Please check your connection and try again.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const handleConfirm = async () => {
    if (!selectedService || !selectedDate || !selectedTime) return;
    setError("");
    if (name.trim().length < 2) return setError("Please enter your full name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      return setError("Please enter a valid email address.");
    if (phone.trim().length < 6) return setError("Please enter a valid phone number.");

    setSubmitting(true);
    try {
      const res = await withTimeout(
        createBooking({
          data: {
            serviceId: selectedService.id,
            date: selectedDate,
            time: selectedTime,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
          },
        }),
        40_000,
      );
      if (!res.ok) {
        setError(res.message);
        if (res.code === "slot_taken") {
          setTaken((prev) => [...prev, selectedTime]);
          setSelectedTime("");
          setStep(2);
        }
        return;
      }
      setDone(true);
    } catch {
      setError(
        "The booking system took too long to respond. Your appointment was not confirmed — please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };


  const reset = () => {
    setStep(0);
    setSelectedService(undefined);
    setSelectedDate("");
    setSelectedTime("");
    setName("");
    setEmail("");
    setPhone("");
    setError("");
    setDone(false);
  };

  return (
    <section id="booking" className="relative py-20 px-5 max-w-lg mx-auto">
      <div className="mb-8">
        <span className="section-label">Reserve Your Spot</span>
        <h2 className="display-serif text-4xl font-bold text-white mt-2 leading-tight">
          Book an
          <br />
          <em className="not-italic" style={{ color: "#c9a84c" }}>
            Appointment
          </em>
        </h2>
      </div>
      <div className="glass rounded-3xl p-6">
        {done ? (
          <div className="text-center py-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{
                background: "linear-gradient(135deg, #c9a84c, #e8c96a)",
                boxShadow: "0 0 40px rgba(201,168,76,0.4)",
              }}
            >
              <svg
                className="w-8 h-8 text-black"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="display-serif text-2xl font-bold text-white mb-2">
              Appointment confirmed
            </h3>
            <p className="text-white/50 text-sm mb-1">
              {selectedService?.name} · {selectedDate} · {selectedTime}
            </p>
            <p className="text-white/30 text-xs mb-6">
              A confirmation email is on its way to {email}.
            </p>
            <button onClick={reset} className="btn-glass px-6 py-3 rounded-2xl text-sm font-medium">
              Book Another
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-6">
              {["Service", "Date", "Time", "Confirm"].map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${step >= i ? "text-black" : "text-white/20"}`}
                    style={{
                      background:
                        step >= i
                          ? "linear-gradient(135deg, #c9a84c, #e8c96a)"
                          : "rgba(255,255,255,0.06)",
                    }}
                  >
                    {step > i ? "✓" : i + 1}
                  </div>
                  {i < 3 && (
                    <div
                      className={`flex-1 h-px transition-all ${step > i ? "bg-[#c9a84c]/40" : "bg-white/10"}`}
                      style={{ width: 16 }}
                    />
                  )}
                </div>
              ))}
            </div>

            {step === 0 && (
              <div>
                <p className="text-white/50 text-xs tracking-widest uppercase mb-4">
                  Select a Service
                </p>
                <div className="space-y-2">
                  {SERVICES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedService(s);
                        setStep(1);
                      }}
                      className="w-full glass-gold rounded-xl p-4 text-left flex justify-between items-center transition-all active:scale-[0.98]"
                    >
                      <div>
                        <p className="text-white text-sm font-medium">{s.name}</p>
                        <p className="text-white/40 text-[11px] mt-0.5">{s.duration} min</p>
                      </div>
                      <span className="display-serif font-bold" style={{ color: "#c9a84c" }}>
                        ${s.price}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white/50 text-xs tracking-widest uppercase">Pick a Date</p>
                  <button onClick={() => setStep(0)} className="text-white/30 text-xs">
                    ← Back
                  </button>
                </div>
                <div className="glass-gold rounded-xl px-4 py-3 mb-4 flex justify-between items-center">
                  <span className="text-white/70 text-sm">{selectedService?.name}</span>
                  <span className="font-semibold" style={{ color: "#c9a84c" }}>
                    ${selectedService?.price}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {days.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => {
                        setSelectedDate(d.value);
                        setSelectedTime("");
                        setStep(2);
                      }}
                      className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-center transition-all active:scale-95 ${selectedDate === d.value ? "text-black font-semibold" : "text-white/60"}`}
                      style={{
                        background:
                          selectedDate === d.value
                            ? "linear-gradient(135deg, #c9a84c, #e8c96a)"
                            : "rgba(255,255,255,0.04)",
                        border:
                          selectedDate === d.value ? "none" : "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <span className="text-[9px] tracking-wide uppercase opacity-70">
                        {d.dayName}
                      </span>
                      <span className="text-sm font-bold">{d.short}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white/50 text-xs tracking-widest uppercase">Pick a Time</p>
                  <button onClick={() => setStep(1)} className="text-white/30 text-xs">
                    ← Back
                  </button>
                </div>
                <div className="glass-gold rounded-xl px-4 py-2 mb-4 flex justify-between items-center">
                  <span className="text-white/60 text-sm">{selectedDate}</span>
                  <span className="text-white/60 text-sm">{selectedService?.name}</span>
                </div>
                {loadingSlots && (
                  <p className="text-white/30 text-[11px] mb-3 text-center">
                    Checking real-time availability…
                  </p>
                )}
                <div
                  className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1"
                  style={{ scrollbarWidth: "none" }}
                >
                  {TIME_SLOTS.map((t) => {
                    const isTaken = taken.includes(t);
                    return (
                      <button
                        key={t}
                        disabled={isTaken || loadingSlots}
                        onClick={() => {
                          setSelectedTime(t);
                          setStep(3);
                        }}
                        className={`py-2.5 rounded-xl text-xs font-medium transition-all active:scale-95 ${isTaken ? "text-white/20 line-through cursor-not-allowed" : selectedTime === t ? "text-black font-semibold" : "text-white/70"}`}
                        style={{
                          background:
                            selectedTime === t && !isTaken
                              ? "linear-gradient(135deg, #c9a84c, #e8c96a)"
                              : "rgba(255,255,255,0.04)",
                          border:
                            selectedTime === t && !isTaken
                              ? "none"
                              : "1px solid rgba(255,255,255,0.06)",
                          opacity: isTaken ? 0.45 : 1,
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                <p className="text-white/25 text-[10px] text-center mt-3">
                  Crossed-out times are already booked.
                </p>
              </div>
            )}

            {step === 3 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white/50 text-xs tracking-widest uppercase">Confirm Booking</p>
                  <button onClick={() => setStep(2)} className="text-white/30 text-xs">
                    ← Back
                  </button>
                </div>
                <div className="glass-gold rounded-2xl p-4 mb-5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white/50 text-xs uppercase tracking-wide">Service</span>
                    <span className="text-white text-sm font-medium">{selectedService?.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50 text-xs uppercase tracking-wide">Date</span>
                    <span className="text-white text-sm">{selectedDate}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50 text-xs uppercase tracking-wide">Time</span>
                    <span className="text-white text-sm">{selectedTime}</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 mt-2 flex justify-between items-center">
                    <span className="text-white/50 text-xs uppercase tracking-wide">Total</span>
                    <span className="display-serif text-xl font-bold" style={{ color: "#c9a84c" }}>
                      ${selectedService?.price}
                    </span>
                  </div>
                </div>
                <div className="space-y-3 mb-5">
                  <input
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full glass rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none"
                    style={{ caretColor: "#c9a84c" }}
                  />
                  <input
                    type="email"
                    inputMode="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full glass rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none"
                    style={{ caretColor: "#c9a84c" }}
                  />
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full glass rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none"
                    style={{ caretColor: "#c9a84c" }}
                  />
                </div>
                {error && (
                  <div
                    className="rounded-xl px-4 py-3 mb-4 text-xs"
                    style={{
                      background: "rgba(220,70,70,0.12)",
                      border: "1px solid rgba(220,70,70,0.3)",
                      color: "#ffb4b4",
                    }}
                  >
                    {error}
                  </div>
                )}
                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="btn-gold w-full py-4 rounded-2xl text-sm font-semibold tracking-wide flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? "Confirming…" : "Confirm Appointment"}
                </button>
                <p className="text-white/25 text-[10px] text-center mt-3">
                  Your spot is reserved instantly and you'll get a confirmation email.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Reviews() {
  const [active, setActive] = useState(0);
  return (
    <section className="relative py-20 overflow-hidden">
      <div className="max-w-lg mx-auto px-5">
        <div className="mb-8">
          <span className="section-label">What Clients Say</span>
          <h2 className="display-serif text-4xl font-bold text-white mt-2 leading-tight">
            Real Talk,
            <br />
            <em className="not-italic" style={{ color: "#c9a84c" }}>
              Real Results
            </em>
          </h2>
        </div>
      </div>
      <div className="px-5 max-w-lg mx-auto">
        <div className="glass-gold rounded-3xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-black font-bold text-sm flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #c9a84c, #e8c96a)" }}
            >
              {REVIEWS[active].avatar}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{REVIEWS[active].name}</p>
              <p className="text-white/40 text-[10px]">{REVIEWS[active].date}</p>
            </div>
            <div className="ml-auto">
              <Stars count={REVIEWS[active].rating} />
            </div>
          </div>
          <p className="text-white/75 text-sm leading-relaxed font-light italic">
            "{REVIEWS[active].text}"
          </p>
        </div>
        <div className="flex justify-center gap-2 mb-8">
          {REVIEWS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Review ${i + 1}`}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === active ? 24 : 8,
                height: 8,
                background: i === active ? "#c9a84c" : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>
        <div className="space-y-3">
          {REVIEWS.map(
            (r, i) =>
              i !== active && (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className="glass w-full rounded-2xl p-4 text-left flex items-center gap-3 transition-all active:scale-[0.98]"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-black font-bold text-xs flex-shrink-0"
                    style={{ background: "rgba(201,168,76,0.6)" }}
                  >
                    {r.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-white text-xs font-medium">{r.name}</p>
                      <Stars count={r.rating} />
                    </div>
                    <p className="text-white/40 text-xs truncate">{r.text}</p>
                  </div>
                </button>
              ),
          )}
        </div>
      </div>
    </section>
  );
}

const DEFAULT_GALLERY = [
  { src: img3550, alt: "Precision fade in progress" },
  {
    src: "https://images.unsplash.com/photo-1630435664010-20cbd1d7bb6d?w=800&h=800&fit=crop&auto=format&q=80",
    alt: "Barber cutting hair — clean studio shot",
  },
  {
    src: "https://images.unsplash.com/photo-1553521041-d168abd31de3?w=800&h=800&fit=crop&auto=format&q=80",
    alt: "Barber holding scissors — editorial portrait",
  },
  {
    src: "https://images.unsplash.com/photo-1578390432942-d323db577792?w=800&h=800&fit=crop&auto=format&q=80",
    alt: "Clean minimalist portrait after cut",
  },
];

function Gallery() {
  const { photos } = useSite();
  const GALLERY = photos.length ? photos.map((p) => ({ src: p.url, alt: p.alt })) : DEFAULT_GALLERY;
  return (
    <section style={{ background: "#080808" }} className="py-16 px-5">
      <div className="max-w-lg mx-auto">
        <div className="mb-8 text-center">
          <span className="section-label" style={{ color: "#c9a84c" }}>
            Our Work
          </span>
        </div>
        <div
          className="rounded-3xl overflow-hidden mb-3"
          style={{ aspectRatio: "4/3", background: "#111" }}
        >
          <img
            src={GALLERY[0].src}
            alt={GALLERY[0].alt}
            className="w-full h-full object-cover"
            style={{ objectPosition: "center 20%" }}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {GALLERY.slice(1).map((p) => p).filter(Boolean).map((photo, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden"
              style={{ aspectRatio: "3/4", background: "#111" }}
            >
              <img
                src={photo.src}
                alt={photo.alt}
                loading="lazy"
                className="w-full h-full object-cover"
                style={{
                  objectPosition: "center 20%",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Location() {
  const biz = useBiz();
  const { content } = useSite();
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${biz.addressEncoded}`;
  const appleMapsUrl = `https://maps.apple.com/?q=${biz.addressEncoded}`;
  return (
    <section className="relative py-20 px-5 max-w-lg mx-auto">
      <div className="mb-8">
        <span className="section-label">Find Us</span>
        <h2 className="display-serif text-4xl font-bold text-white mt-2 leading-tight">
          Location &<br />
          <em className="not-italic" style={{ color: "#c9a84c" }}>
            Hours
          </em>
        </h2>
      </div>
      <div
        className="relative rounded-3xl overflow-hidden mb-5"
        style={{ aspectRatio: "16/9", background: "rgba(255,255,255,0.04)" }}
      >
        <iframe
          title="Barber Shop Machine Location"
          width="100%"
          height="100%"
          style={{ border: 0, filter: "invert(90%) hue-rotate(180deg) saturate(0.7)" }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://maps.google.com/maps?q=${biz.addressEncoded}&output=embed`}
        />
        <div
          className="absolute inset-0 pointer-events-none rounded-3xl"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
        />
      </div>
      <div className="glass rounded-3xl p-5 space-y-5">
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "rgba(201,168,76,0.12)",
              border: "1px solid rgba(201,168,76,0.2)",
            }}
          >
            <svg
              className="w-4 h-4"
              style={{ color: "#c9a84c" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-white/40 text-[10px] tracking-widest uppercase mb-1">Address</p>
            <p className="text-white text-sm leading-snug">{biz.address}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "rgba(201,168,76,0.12)",
              border: "1px solid rgba(201,168,76,0.2)",
            }}
          >
            <svg
              className="w-4 h-4"
              style={{ color: "#c9a84c" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
              />
            </svg>
          </div>
          <div>
            <p className="text-white/40 text-[10px] tracking-widest uppercase mb-1">Phone</p>
            <a
              href={`tel:${biz.phoneRaw}`}
              className="text-white text-sm"
              style={{ color: "#c9a84c" }}
            >
              {biz.phone}
            </a>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "rgba(201,168,76,0.12)",
              border: "1px solid rgba(201,168,76,0.2)",
            }}
          >
            <svg
              className="w-4 h-4"
              style={{ color: "#c9a84c" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-white/40 text-[10px] tracking-widest uppercase mb-2">Hours</p>
            <div className="space-y-1.5">
              {biz.hours.map(({ day, time }) => (
                <div key={day} className="flex justify-between items-center">
                  <span className="text-white/60 text-xs">{day}</span>
                  <span className="text-white text-xs font-medium">{time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div
          className="grid grid-cols-2 gap-3 pt-2 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-semibold text-white transition-all active:scale-95"
            style={{
              background: "rgba(66,133,244,0.12)",
              border: "1px solid rgba(66,133,244,0.25)",
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                fill="#4285F4"
              />
            </svg>
            <span style={{ color: "#4285F4" }}>Google Maps</span>
          </a>
          <a
            href={appleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-semibold transition-all active:scale-95"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Apple Maps
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer({ onBook }: { onBook: () => void }) {
  const biz = useBiz();
  const { content } = useSite();
  return (
    <footer
      className="relative border-t overflow-hidden"
      style={{ borderColor: "rgba(201,168,76,0.1)" }}
    >
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div className="relative max-w-lg mx-auto px-5 py-16">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <h3 className="display-serif text-2xl font-bold text-white mb-1">Barber Shop Machine</h3>
          <p className="text-white/40 text-sm">{content.footer.tagline}</p>
        </div>
        <button
          onClick={onBook}
          className="btn-gold w-full py-4 rounded-2xl text-sm font-semibold tracking-wide mb-8"
        >
          Book Your Appointment
        </button>
        <div className="grid grid-cols-3 gap-4 mb-8 text-center">
          <a href={`tel:${biz.phoneRaw}`} className="flex flex-col items-center gap-2 group">
            <div className="w-10 h-10 glass rounded-2xl flex items-center justify-center transition-all group-active:scale-95">
              <svg
                className="w-4 h-4 text-white/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                />
              </svg>
            </div>
            <span className="text-white/40 text-[10px] tracking-wide">Call Us</span>
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${biz.addressEncoded}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-10 h-10 glass rounded-2xl flex items-center justify-center transition-all group-active:scale-95">
              <svg
                className="w-4 h-4 text-white/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                />
              </svg>
            </div>
            <span className="text-white/40 text-[10px] tracking-wide">Directions</span>
          </a>
          <a
            href={biz.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-10 h-10 glass rounded-2xl flex items-center justify-center transition-all group-active:scale-95">
              <svg className="w-4 h-4 text-white/60" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </div>
            <span className="text-white/40 text-[10px] tracking-wide">Instagram</span>
          </a>
        </div>
        <div
          className="text-center border-t pt-6"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="text-white/20 text-[10px] tracking-widest uppercase">
            {content.footer.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}

function Index() {
  const { data: site } = useSuspenseQuery(siteQuery);
  const [bookingService, setBookingService] = useState<Service | undefined>();

  const scrollToBooking = (service?: Service) => {
    setBookingService(service);
    setTimeout(() => {
      const el = document.getElementById("booking");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  return (
    <SiteCtx.Provider value={site}>
    <div style={{ background: "#080808", minHeight: "100vh" }}>
      <Nav onBook={() => scrollToBooking()} />
      <Hero onBook={() => scrollToBooking()} />
      <Services onBook={(s) => scrollToBooking(s)} />
      <Booking initialService={bookingService} />
      <Reviews />
      <Gallery />
      <Location />
      <Footer onBook={() => scrollToBooking()} />
    </div>
    </SiteCtx.Provider>
  );
}
