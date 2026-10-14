import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Owner Sign In — Barber Shop Machine" },
      { name: "description", content: "Private sign in for the Barber Shop Machine owner panel." },
      { property: "og:title", content: "Owner Sign In — Barber Shop Machine" },
      { property: "og:description", content: "Private owner access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/admin" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const signIn = async () => {
    setLoading(true);
    setError("");
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
      extraParams: { prompt: "select_account", login_hint: "info@barbershopmachine.com" },
    });
    if (res.error) {
      setError("No se pudo iniciar sesión. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "#080808" }}>
      <div className="glass rounded-3xl p-8 w-full max-w-sm text-center">
        <h1 className="display-serif text-3xl font-bold text-white mb-2">Panel privado</h1>
        <p className="text-white/50 text-sm mb-6">Entra con info@barbershopmachine.com</p>
        <button onClick={signIn} disabled={loading} className="btn-gold w-full py-4 rounded-2xl text-sm font-semibold">
          {loading ? "Abriendo Google…" : "Continuar con Google"}
        </button>
        {error && <p className="text-red-400 text-xs mt-4">{error}</p>}
      </div>
    </div>
  );
}
