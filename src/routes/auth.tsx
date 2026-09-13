import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Search = { modo?: "login" | "cadastro" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    modo: search["modo"] === "cadastro" ? "cadastro" : "login",
  }),
  head: () => ({
    meta: [
      { title: "Entrar no Agenda Agora — painel de agendamentos" },
      {
        name: "description",
        content: "Acesse o painel do seu negócio para gerenciar agenda, serviços e clientes.",
      },
      { property: "og:title", content: "Entrar no Agenda Agora" },
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
const phonePassword = (senha: string) => `agendaagora:${senha}`;

function AuthPage() {
  const { modo } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isSignup, setIsSignup] = useState(modo === "cadastro");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    void (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      void navigate({ to: data ? "/master" : "/painel" });
    })();
  }, [loading, user, navigate]);


  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const isEmail = phone.includes("@");
    const digits = onlyDigits(phone);
    if (!isEmail && digits.length < 10) {
      toast.error("Informe o telefone com DDD.");
      return;
    }
    if (!/^\d{4}$/.test(password)) {
      toast.error("A senha deve ter exatamente 4 dígitos.");
      return;
    }
    setBusy(true);
    try {
      if (isEmail) {
        const { error } = await supabase.auth.signInWithPassword({
          email: phone.trim().toLowerCase(),
          password: phonePassword(password),
        });
        if (error) throw new Error("E-mail ou senha incorretos.");
        toast.success("Bem-vindo de volta!");
      } else if (isSignup) {
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
    <div className="flex min-h-screen items-center justify-center hero-wash px-6 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 block text-center font-display text-2xl font-extrabold">
          Agenda<span className="text-primary">Agora</span>
        </Link>

        <div className="surface p-7">
          <h1 className="text-2xl font-bold">{isSignup ? "Criar sua conta" : "Entrar"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup
              ? "Cadastre seu negócio e comece a receber agendamentos."
              : "Acesse o painel do seu negócio com telefone e senha de 4 dígitos."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="name">Seu nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: João da Silva"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone do estabelecimento</Label>
              <div className="relative">
                <Input
                  id="phone"
                  type="text"
                  autoComplete="username"
                  value={phone}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPhone(v.includes("@") ? v.trim() : formatPhone(v));
                  }}
                  placeholder="(11) 93935-4416"
                  required
                  className="peer pr-10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Smartphone className="size-4" />
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha de 4 dígitos</Label>
              <div className="relative">
                <Input
                  id="password"
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
                  className="peer pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Aguarde..." : isSignup ? "Criar conta" : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
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
    </div>
  );
}
