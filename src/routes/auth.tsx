import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Entrar no Agenda Agora — painel de agendamentos" },
    { name: "description", content: "Acesse o painel do seu negócio para gerenciar agenda, serviços e clientes." },
    { property: "og:title", content: "Entrar no Agenda Agora" },
    { property: "og:description", content: "Acesse o painel de agendamentos do seu negócio." },
  ] }),
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
    if (digits.length < 10) { toast.error("Informe o telefone com DDD."); return; }
    if (!/^\d{4}$/.test(password)) { toast.error("A senha deve ter exatamente 4 dígitos."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: phoneLogin(phone), password: phonePassword(password) });
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
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center hero-wash px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center font-display text-2xl font-extrabold">Agenda<span className="text-primary">Agora</span></div>
        <div className="surface p-7">
          <h1 className="text-2xl font-bold">Entrar no painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesse seu painel de estabelecimento com telefone e senha.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone do estabelecimento</Label>
              <div className="relative">
                <Input id="phone" type="tel" autoComplete="username" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(11) 93935-4416" required className="pr-10" />
                <Smartphone className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha de 4 dígitos</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} inputMode="numeric" autoComplete="current-password" value={password} onChange={(e) => setPassword(onlyDigits(e.target.value).slice(0, 4))} placeholder="1234" minLength={4} maxLength={4} pattern="\d{4}" required className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Aguarde..." : "Entrar"}</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
