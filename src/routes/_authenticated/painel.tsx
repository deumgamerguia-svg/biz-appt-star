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
  { to: "/painel", label: "Agenda", icon: CalendarDays, exact: true },
  { to: "/painel/as-pay", label: "AS Pay", icon: Gem },
  { to: "/painel/relatorio", label: "Relatório", icon: PieChart },
  { to: "/painel/caixa", label: "Caixa", icon: Calculator },
  { to: "/painel/assinatura", label: "Assinatura", icon: CreditCard },
  { to: "/painel/produtos", label: "Produtos", icon: ShoppingBasket },
  { to: "/painel/servicos", label: "Serviço", icon: Scissors },
  { to: "/painel/clientes", label: "Clientes", icon: Users },
  { to: "/painel/templates", label: "Templates", icon: MessageSquareText },
  { to: "/painel/pagamentos", label: "Pagamentos", icon: DollarSign },
  { to: "/painel/lembretes", label: "Lembretes", icon: BellRing },
  { to: "/painel/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/painel/bloqueios", label: "Horários Bloqueados", icon: CircleX },
  { to: "/painel/funcionamento", label: "Funcionamento", icon: CalendarCheck },
  { to: "/painel/profissionais", label: "Profissionais", icon: UserRound },
  { to: "/painel/configuracoes", label: "Configurações", icon: Settings2 },
  { to: "/painel/integracoes", label: "Integrações", icon: Plus },
  { to: "/painel/negocios", label: "Negócios", icon: Store },
] as const;

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
  const { businesses, businessId, setBusinessId } = useBusiness();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);


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

        <nav className="space-y-0.5 py-4">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: "exact" in item ? item.exact : false }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-[0.86rem] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{
                className:
                  "flex items-center gap-3 rounded-md border border-sidebar-ring/35 bg-sidebar-accent px-3 py-2.5 text-[0.86rem] font-semibold text-sidebar-accent-foreground shadow-soft",
              }}
            >
              <item.icon className="size-[17px] text-primary" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-2 border-t border-sidebar-border pt-3">
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
