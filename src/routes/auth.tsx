import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, LockKeyhole, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Agenda Agora — Acesso ao painel" },
      { name: "description", content: "Acesse o painel do seu estabelecimento com telefone e senha de 4 dígitos." },
      { property: "og:title", content: "Agenda Agora — Acesso ao painel" },
      { property: "og:description", content: "Acesse o painel de agendamentos do seu estabelecimento." },
    ],
  }),
  component: AuthPage,
});

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const formatPhone = (value: string) => {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const phoneLogin = (phone: string) => `${onlyDigits(phone)}@agenda.local`;
const phonePassword = (senha: string) => `agendaagora:${senha}`;

async function getRole(userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  return data?.role ?? null;
}

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;

    void (async () => {
      const role = await getRole(user.id);
      if (role === "owner") {
        void navigate({ to: "/painel" });
      } else if (role === "super_admin") {
        await supabase.auth.signOut();
        toast.info("Use o acesso exclusivo do Master.");
      }
    })();
  }, [loading, user, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const digits = onlyDigits(phone);
    if (digits.length < 10) {
      toast.error("Informe o telefone com DDD.");
      return;
    }

    if (!/^\d{4}$/.test(password)) {
      toast.error("A senha deve ter exatamente 4 dígitos.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: phoneLogin(phone),
        password: phonePassword(password),
      });

      if (error || !data.user) throw new Error("Telefone ou senha incorretos.");

      const role = await getRole(data.user.id);
      if (role !== "owner") {
        await supabase.auth.signOut();
        if (role === "super_admin") throw new Error("Esta é a conta Master. Use o acesso exclusivo do Master.");
        throw new Error("Esta conta não possui acesso de estabelecimento.");
      }

      toast.success("Bem-vindo de volta!");
      void navigate({ to: "/painel" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#02050b] px-4 py-6 text-white sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(0,104,255,0.20),transparent_34%),radial-gradient(circle_at_92%_92%,rgba(0,72,255,0.22),transparent_34%),linear-gradient(135deg,#061322_0%,#02050b_48%,#05030d_100%)]" />
      <div className="pointer-events-none absolute -left-32 top-1/2 size-80 -translate-y-1/2 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 size-96 rounded-full bg-cyan-500/10 blur-3xl" />

      <section className="relative z-10 w-full max-w-[430px] sm:max-w-[500px]">
        <div className="rounded-[30px] border border-white/10 bg-[#050a12]/90 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:rounded-[34px] sm:p-9 md:p-10">
          <div className="mb-8 flex items-center justify-center sm:mb-10">
            <div className="flex items-center gap-3">
              <img src="/agenda-agora-logo.svg" alt="Agenda Agora" className="size-[58px] shrink-0 object-contain sm:size-[66px]" />
              <div className="font-sans text-[26px] font-medium tracking-[-0.04em] sm:text-[31px]">
                <span className="text-white">Agenda </span>
                <span className="bg-gradient-to-r from-[#1584ff] to-[#19bdf4] bg-clip-text text-transparent">Agora</span>
              </div>
            </div>
          </div>

          <div className="mb-8 sm:mb-9">
            <h1 className="text-[34px] font-normal leading-[1.08] tracking-[-0.045em] text-white sm:text-[40px]">Acesse sua conta</h1>
            <p className="mt-3 text-[15px] leading-6 text-[#74839b] sm:text-[16px]">Insira suas credenciais de acesso abaixo.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div>
              <label htmlFor="phone" className="mb-2.5 block text-[12px] font-semibold uppercase tracking-[0.20em] text-[#8294af] sm:text-[13px]">Telefone</label>
              <div className="group relative">
                <Phone className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-[#5f7595] transition-colors group-focus-within:text-[#2195ff]" />
                <input id="phone" type="tel" inputMode="numeric" autoComplete="username" value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} placeholder="(11) 99999-9999" maxLength={15} required className="h-[64px] w-full rounded-[18px] border border-[#263d59] bg-[#07101b]/80 pl-14 pr-5 text-[17px] text-white outline-none transition-all placeholder:text-[#566b88] focus:border-[#167cff] focus:ring-4 focus:ring-blue-500/10 sm:h-[68px] sm:rounded-[20px]" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2.5 block text-[12px] font-semibold uppercase tracking-[0.20em] text-[#8294af] sm:text-[13px]">Senha</label>
              <div className="group relative">
                <LockKeyhole className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-[#5f7595] transition-colors group-focus-within:text-[#2195ff]" />
                <input id="password" type={showPassword ? "text" : "password"} inputMode="numeric" autoComplete="current-password" value={password} onChange={(event) => setPassword(onlyDigits(event.target.value).slice(0, 4))} placeholder="••••" minLength={4} maxLength={4} required className="h-[64px] w-full rounded-[18px] border border-[#263d59] bg-[#07101b]/80 pl-14 pr-14 text-[18px] tracking-[0.28em] text-white outline-none transition-all placeholder:tracking-[0.28em] placeholder:text-[#566b88] focus:border-[#167cff] focus:ring-4 focus:ring-blue-500/10 sm:h-[68px] sm:rounded-[20px]" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-5 top-1/2 -translate-y-1/2 text-[#607696] transition-colors hover:text-[#9bb4d5]">
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={busy} className="mt-2 h-[62px] w-full rounded-full bg-gradient-to-r from-[#0877ff] via-[#087cff] to-[#13b9ec] text-[17px] font-medium text-white shadow-[0_12px_32px_rgba(0,119,255,0.25)] transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:h-[66px] sm:text-[18px]">
              {busy ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
