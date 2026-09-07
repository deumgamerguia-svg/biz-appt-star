import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/hooks/useAuth";

type Search = { modo?: "login" | "cadastro" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    modo: search["modo"] === "cadastro" ? "cadastro" : "login",
  }),
  head: () => ({
    meta: [
      { title: "Entrar no Agendaê — painel de agendamentos" },
      {
        name: "description",
        content: "Acesse o painel do seu negócio para gerenciar agenda, serviços e clientes.",
      },
      { property: "og:title", content: "Entrar no Agendaê" },
      { property: "og:description", content: "Acesse o painel de agendamentos do seu negócio." },
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

// Credencial interna derivada do telefone + senha do estabelecimento.
const phoneLogin = (phone: string) => `${onlyDigits(phone)}@agenda.local`;
const phonePassword = (senha: string) => `agendae:${senha}`;

function AuthPage() {
  const { modo } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isSignup, setIsSignup] = useState(modo === "cadastro");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/painel" });
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
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: phoneLogin(phone),
          password: phonePassword(password),
          options: { data: { full_name: name, phone: digits } },
        });
        if (error) throw error;
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: phoneLogin(phone),
          password: phonePassword(password),
        });
        if (signInError) throw signInError;
        toast.success("Conta criada!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: phoneLogin(phone),
          password: phonePassword(password),
        });
        if (error) throw new Error("Telefone ou senha incorretos.");
        toast.success("Bem-vindo de volta!");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-background px-6">
      {/* Marca gigante cortada no topo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 flex h-[16vh] min-h-24 items-start justify-center overflow-hidden"
      >
        <span className="mt-[-0.32em] whitespace-nowrap font-display text-[clamp(4rem,14vw,11rem)] font-extrabold leading-none tracking-tight text-primary">
          AGENDA SERVIÇO
        </span>
      </div>

      <div className="relative z-10 mt-[15vh] w-full max-w-sm">
        <div className="auth-card">
          <h1 className="auth-card-title">{isSignup ? "criar conta" : "seu login"}</h1>

          <form onSubmit={handleSubmit} className="space-y-3 p-5">
            {isSignup && (
              <div className="auth-field">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do responsável"
                  required
                />
              </div>
            )}
            <div className="auth-field">
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(11) 93935-4416"
                required
              />
              <span className="auth-field-icon">
                <Smartphone className="size-4" />
              </span>
            </div>

            <div className="auth-field">
              <input
                type={showPassword ? "text" : "password"}
                inputMode="numeric"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(onlyDigits(e.target.value).slice(0, 4))}
                placeholder="1234"
                minLength={4}
                maxLength={4}
                pattern="\d{4}"
                required
              />
              <button
                type="button"
                className="auth-field-icon"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-4 accent-[#2563eb]"
              />
              Lembrar senha
            </label>

            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? "Aguarde..." : isSignup ? "Criar conta" : "Entrar"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {isSignup ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
          <button
            type="button"
            className="font-semibold text-primary hover:underline"
            onClick={() => setIsSignup((v) => !v)}
          >
            {isSignup ? "Entrar" : "Criar agora"}
          </button>
        </p>
      </div>
    </div>
  );
}
