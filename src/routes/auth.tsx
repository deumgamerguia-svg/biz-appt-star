import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
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
    <div className="flex min-h-screen items-center justify-center hero-wash px-6 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 block text-center font-display text-2xl font-extrabold">
          Agenda<span className="text-primary">ê</span>
        </Link>

        <div className="surface p-7">
          <h1 className="text-2xl font-bold">{isSignup ? "Criar sua conta" : "Faça seu login"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup
              ? "Cadastre seu negócio e comece a receber agendamentos."
              : "Acesse o painel do seu negócio com telefone e senha."}
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
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(11) 93935-4416"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ex.: 1237"
                minLength={4}
                required
              />
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
              onClick={() => {
                
                setIsSignup((v) => !v);
              }}
            >
              {isSignup ? "Entrar" : "Criar agora"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
