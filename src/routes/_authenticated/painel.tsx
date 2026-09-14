import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  Users,
  Scissors,
  Store,
  UserRound,
  LogOut,
  Menu,
  Bell,
  BellRing,
  Gem,
  PieChart,
  Calculator,
  CreditCard,
  ShoppingBasket,
  MessageSquareText,
  DollarSign,
  CircleX,
  CalendarCheck,
  Settings2,
  Plus,
  MessageCircle,
  UserCircle,
  Clock3,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/lib/business";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import brandLogo from "@/assets/agenda-agora-logo.png.asset.json";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Agenda Agora" },
      { name: "description", content: "Gerencie a agenda, os serviços e os clientes do negócio." },
      { property: "og:title", content: "Painel — Agenda Agora" },
      { property: "og:description", content: "Gerencie a agenda do seu negócio." },
    ],
  }),
  component: PainelLayout,
});

const nav = [
  { title: "Agenda", items: [
    { to: "/painel", label: "Agenda", hint: "Visão dos horários", icon: CalendarDays, exact: true },
    { to: "/painel/bloqueios", label: "Horários Bloqueados", hint: "Folgas e indisponibilidades", icon: CircleX },
    { to: "/painel/funcionamento", label: "Funcionamento", hint: "Dias e horários", icon: Clock3 },
  ]},
  { title: "Gestão", items: [
    { to: "/painel/clientes", label: "Clientes", hint: "Cadastro de clientes", icon: Users },
    { to: "/painel/profissionais", label: "Profissionais", hint: "Equipe e permissões", icon: UserRound },
    { to: "/painel/servicos", label: "Serviço", hint: "Serviços e valores", icon: Scissors },
    { to: "/painel/produtos", label: "Produtos", hint: "Produtos e estoque", icon: ShoppingBasket },
  ]},
  { title: "Financeiro", items: [
    { to: "/painel/as-pay", label: "AS Pay", hint: "Saldo dos sinais", icon: Gem },
    { to: "/painel/caixa", label: "Caixa", hint: "Entradas e saídas", icon: Calculator },
    { to: "/painel/pagamentos", label: "Pagamentos", hint: "Histórico da assinatura", icon: DollarSign },
    { to: "/painel/relatorio", label: "Relatório", hint: "Métricas e resultados", icon: PieChart },
  ]},
  { title: "Comunicação", items: [
    { to: "/painel/templates", label: "Templates", hint: "Mensagens prontas", icon: MessageSquareText },
    { to: "/painel/whatsapp", label: "WhatsApp", hint: "Conexão e mensagens", icon: MessageCircle },
    { to: "/painel/lembretes", label: "Lembretes", hint: "Envios automáticos", icon: BellRing },
  ]},
  { title: "Sistema", items: [
    { to: "/painel/configuracoes", label: "Configurações", hint: "Preferências do negócio", icon: Settings2 },
    { to: "/painel/integracoes", label: "Integrações", hint: "Serviços conectados", icon: Plus },
    { to: "/painel/assinatura", label: "Assinatura", hint: "Plano e vencimento", icon: CreditCard },
    { to: "/painel/negocios", label: "Negócios", hint: "Gerenciar unidades", icon: Store },
  ]},
] as const;

const routePermission: Partial<Record<string, string>> = {
  "/painel": "view_agenda", "/painel/bloqueios": "block_schedule",
  "/painel/clientes": "view_customer_phone", "/painel/caixa": "view_financial",
  "/painel/pagamentos": "view_financial", "/painel/relatorio": "view_reports",
};

function WhatsappBadge() {
  const { businessId } = useBusiness();
  const { data } = useQuery({
    queryKey: ["whatsapp-badge", businessId],
    queryFn: async () => {
      const { data: row } = await supabase
        .from("businesses")
        .select("whatsapp_status")
        .eq("id", businessId!)
        .maybeSingle();
      return row?.whatsapp_status ?? "desconectado";
    },
    enabled: !!businessId,
    refetchInterval: 15000,
  });
  const connected = data === "conectado";
  return (
    <Link
      to="/painel/whatsapp"
      className={`flex flex-1 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium ${
        connected
          ? "border-success/60 text-success"
          : "border-destructive/50 text-destructive"
      }`}
    >
      <MessageCircle className="mr-2 size-4" />
      {connected ? "WHATSAPP CONECTADO" : "WHATSAPP DESCONECTADO"}
    </Link>
  );
}

function PainelLayout() {
  const { user, signOut } = useAuth();
  const { businesses, business, businessId, setBusinessId } = useBusiness();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: member } = useQuery({
    queryKey: ["current-professional", user?.id, businessId], enabled: !!user?.id && !!businessId,
    queryFn: async () => { const { data } = await supabase.from("professionals").select("permissions").eq("user_id", user!.id).eq("business_id", businessId!).maybeSingle(); return data; },
  });
  const permissions = member?.permissions && typeof member.permissions === "object" && !Array.isArray(member.permissions) ? member.permissions as Record<string, boolean> : null;
  const canOpen = (to: string) => !permissions || !!permissions.admin || !!permissions[routePermission[to] ?? "admin"];


  return (
    <div className="owner-panel min-h-screen bg-background lg:flex">
      <aside
        className={`${open ? "block" : "hidden"} border-b border-sidebar-border bg-sidebar px-3 py-3 lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0`}
      >
        <Link
          to="/painel"
          className="flex h-14 items-center px-1"
        >
          <img
            src={brandLogo.url}
            alt="Agenda Agora"
            className="h-9 w-auto max-w-[190px] object-contain object-left"
          />
        </Link>

        <div className="border-b border-sidebar-border px-1 pb-4 pt-2">
          <Select {...(businessId ? { value: businessId } : {})} onValueChange={setBusinessId}>
            <SelectTrigger className="w-full border-sidebar-border bg-sidebar-accent text-sidebar-foreground">
              <SelectValue placeholder="Nenhum negócio" />
            </SelectTrigger>
            <SelectContent>
              {businesses.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <nav className="space-y-5 py-4">
          {nav.map((group) => (
            <section key={group.title}>
              <p className="px-3 pb-1.5 text-[0.62rem] font-bold uppercase text-muted-foreground/60">{group.title}</p>
              <div className="space-y-0.5">
                {group.items.filter((item) => canOpen(item.to)).map((item) => (
                  <Link key={item.to} to={item.to} activeOptions={{ exact: "exact" in item ? item.exact : false }} onClick={() => setOpen(false)}
                    className="owner-nav-item relative flex items-center gap-3 rounded-md px-3 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    activeProps={{ className: "owner-nav-item owner-nav-active relative flex items-center gap-3 rounded-md bg-sidebar-accent px-3 py-2 text-sidebar-accent-foreground" }}>
                    <item.icon className="size-[18px] shrink-0" strokeWidth={1.8} />
                    <span className="min-w-0"><span className="block text-[0.84rem] font-semibold">{item.label}</span><span className="block truncate text-[0.64rem] text-muted-foreground">{item.hint}</span></span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="mt-2 border-t border-sidebar-border pt-3">
          <Link to="/painel/assinatura" className="mb-2 flex items-center gap-3 rounded-md border border-sidebar-border bg-sidebar-accent/40 p-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary"><UserCircle className="size-5" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-sidebar-accent-foreground">{business?.name ?? "Minha conta"}</span><span className="block text-[0.64rem] text-muted-foreground">{business?.status === "suspenso" ? "Assinatura bloqueada" : "Assinatura ativa"}</span></span>
          </Link>
          <p className="truncate px-3 text-xs text-muted-foreground">{user?.email}</p>

          <Button
            variant="ghost"
            className="mt-1 w-full justify-start text-sidebar-foreground"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex min-h-16 items-center gap-3 border-b border-border bg-card px-3 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Button>
          <WhatsappBadge />
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Notificações">
            <Bell className="size-5" />
          </Button>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
