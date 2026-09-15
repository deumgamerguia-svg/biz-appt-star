import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, Headphones, LockKeyhole, Phone, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Agenda Agora — Acesso ao painel" },
      { name: "description", content: "Acesse o painel do seu estabelecimento." },
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
      if (role === "owner") void navigate({ to: "/painel" });
      else if (role === "super_admin") {
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
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#050607] px-4 py-8 text-[#f3f4f6] sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_20%,rgba(15,48,86,0.55),transparent_42%),radial-gradient(circle_at_100%_100%,rgba(0,70,150,0.2),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(11,29,49,0.3),transparent_32%,transparent_70%,rgba(4,15,28,0.24))]" />
      <div className="pointer-events-none absolute -left-32 top-1/4 size-80 rounded-full bg-blue-600/[0.08] blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -right-32 bottom-0 size-96 rounded-full bg-cyan-400/[0.06] blur-3xl animate-pulse [animation-delay:1.5s]" />

      <section className="relative z-10 w-full max-w-[430px]">
        <div className="mb-7 text-center sm:mb-8">
          <div className="mb-3 flex items-center justify-center">
            <div className="relative inline-flex items-center text-[31px] font-bold leading-none tracking-[-0.065em] drop-shadow-[0_0_14px_rgba(255,255,255,0.05)] transition-transform duration-500 hover:scale-[1.015]">
              <span className="text-[#f3f4f6]">Agenda</span>
              <span className="ml-[3px] text-[#1da1ff] drop-shadow-[0_0_12px_rgba(29,161,255,0.16)] animate-pulse [animation-duration:3.4s]">Agora</span>
            </div>
          </div>
          <p className="text-[14px] text-[#7f8793]">Seu negócio organizado. Seus horários sob controle.</p>
        </div>

        <div className="rounded-2xl border border-[#25282c] bg-transparent p-6 shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur-[2px] sm:p-8">
          <div className="mb-7 text-center">
            <h1 className="text-[27px] font-semibold tracking-[-0.035em] text-[#f3f4f6]">Acesse sua conta</h1>
            <p className="mt-2 text-[14px] leading-5 text-[#737983]">Insira suas credenciais de acesso abaixo.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="phone" className="mb-2 block text-[13px] font-medium text-[#777d87]">Telefone</label>
              <div className="group relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[#555b65] transition-colors group-focus-within:text-[#1677ff]" />
                <input id="phone" type="tel" inputMode="numeric" autoComplete="username" value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} placeholder="(11) 99999-9999" maxLength={15} required className="h-12 w-full rounded-xl border border-[#292c31] bg-transparent pl-11 pr-4 text-[15px] text-[#e5e7eb] outline-none transition focus:border-[#1677ff] focus:ring-4 focus:ring-blue-500/10 placeholder:text-[#555b65]" />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="text-[13px] font-medium text-[#777d87]">Senha</label>
                <button type="button" onClick={() => toast.info("Entre em contato com o suporte para recuperar seu acesso.")} className="text-[12px] font-medium text-[#7c8088] transition hover:text-[#1677ff] hover:underline">Esqueci minha senha</button>
              </div>
              <div className="group relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[#555b65] transition-colors group-focus-within:text-[#1677ff]" />
                <input id="password" type={showPassword ? "text" : "password"} inputMode="numeric" autoComplete="current-password" value={password} onChange={(event) => setPassword(onlyDigits(event.target.value).slice(0, 4))} placeholder="••••" minLength={4} maxLength={4} required className="h-12 w-full rounded-xl border border-[#292c31] bg-transparent pl-11 pr-12 text-[16px] tracking-[0.22em] text-[#e5e7eb] outline-none transition focus:border-[#1677ff] focus:ring-4 focus:ring-blue-500/10 placeholder:text-[#555b65]" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#555b65] transition hover:text-[#9ca3af]">{showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}</button>
              </div>
            </div>

            <button type="submit" disabled={busy} className="h-12 w-full rounded-full bg-[#f5f5f5] text-[15px] font-semibold text-[#111111] shadow-[0_5px_20px_rgba(255,255,255,0.08)] transition hover:-translate-y-px hover:bg-white hover:shadow-[0_8px_28px_rgba(255,255,255,0.12)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Entrando..." : "Entrar"}</button>
          </form>

          <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-[#24272b]" /><span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#666b73]">Acesso seguro</span><div className="h-px flex-1 bg-[#24272b]" /></div>
          <p className="text-center text-[12px] leading-5 text-[#626871]">Ao entrar, você acessa o painel de gerenciamento do seu estabelecimento.</p>
        </div>

        <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-[#1d2228] bg-[#07090c]/45 divide-x divide-[#1d2228]">
          <div className="flex min-h-[58px] items-center gap-2.5 px-3.5 py-3 sm:px-5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/[0.06] text-[#1677ff]"><UsersRound className="size-[15px]" /></div>
            <div className="min-w-0"><p className="text-[13px] font-semibold leading-4 text-[#e5e7eb]">+10.000</p><p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.04em] text-[#626a75]">Usuários ativos</p></div>
          </div>
          <div className="flex min-h-[58px] items-center gap-2.5 px-3.5 py-3 sm:px-5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/[0.06] text-[#1677ff]"><Headphones className="size-[15px]" /></div>
            <div className="min-w-0"><p className="text-[13px] font-semibold leading-4 text-[#e5e7eb]">Suporte</p><p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.04em] text-[#626a75]">Ativo 24 hrs</p></div>
          </div>
        </div>
      </section>
    </main>
  );
}
