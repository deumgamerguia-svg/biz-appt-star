import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MASTER_CODE = "16092006";
const MASTER_EMAIL = `${MASTER_CODE}@agenda.local`;

export const Route = createFileRoute("/master-login")({
  head: () => ({ meta: [
    { title: "Acesso Master — Agenda Agora" },
    { name: "description", content: "Acesso exclusivo ao responsável pela plataforma Agenda Agora." },
  ] }),
  component: MasterLoginPage,
});

function MasterLoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [code, setCode] = useState("");
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
      if (data) void navigate({ to: "/master" });
    })();
  }, [loading, user, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.trim() !== MASTER_CODE || password.trim() !== MASTER_CODE) {
      toast.error("Código ou senha Master inválidos.");
      return;
    }

    setBusy(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: MASTER_EMAIL,
        password: MASTER_CODE,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Não foi possível iniciar a sessão Master.");

      const { data: role, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (roleError) throw roleError;
      if (!role) {
        await supabase.auth.signOut();
        throw new Error("Usuário Master sem permissão super_admin no Supabase.");
      }

      toast.success("Acesso Master autorizado.");
      void navigate({ to: "/master" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar no Master.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center hero-wash px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <ShieldCheck className="mx-auto size-10 text-primary" />
          <h1 className="mt-3 font-display text-2xl font-extrabold">Acesso Master</h1>
          <p className="mt-1 text-sm text-muted-foreground">Área exclusiva do responsável pela plataforma.</p>
        </div>
        <div className="surface p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="master-code">Código Master</Label>
              <div className="relative">
                <Input id="master-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="16092006" autoComplete="username" maxLength={8} required className="pr-10" />
                <KeyRound className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="master-password">Senha Master</Label>
              <div className="relative">
                <Input id="master-password" type={showPassword ? "text" : "password"} inputMode="numeric" value={password} onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="••••••••" autoComplete="current-password" maxLength={8} required className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Validando..." : "Entrar no Master"}</Button>
          </form>
          <Link to="/auth" className="mt-6 block text-center text-sm text-muted-foreground hover:text-primary hover:underline">Acesso do estabelecimento</Link>
        </div>
      </div>
    </div>
  );
}
