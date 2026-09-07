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
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMasterStatus } from "@/lib/admin.functions";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/lib/business";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
      { title: "Painel — Agendaê" },
      { name: "description", content: "Gerencie a agenda, os serviços e os clientes do negócio." },
      { property: "og:title", content: "Painel — Agendaê" },
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

function PainelLayout() {
  const { user, signOut } = useAuth();
  const { businesses, businessId, setBusinessId } = useBusiness();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const statusFn = useServerFn(getMasterStatus);
  const { data: masterStatus } = useQuery({
    queryKey: ["master-status"],
    queryFn: () => statusFn(),
  });
  const isMaster = !!masterStatus?.isMaster;

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside
        className={`${open ? "block" : "hidden"} bg-sidebar p-3 lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto`}
      >
        <Link
          to="/"
          className="block px-3 py-3 font-display text-lg font-extrabold uppercase tracking-[0.12em] text-primary"
        >
          Agenda Serviço
        </Link>

        <div className="px-1 pb-3">
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

        <nav className="space-y-0.5">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: "exact" in item ? item.exact : false }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.95rem] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              activeProps={{
                className:
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.95rem] font-semibold bg-sidebar-accent text-sidebar-accent-foreground",
              }}
            >
              <item.icon className="size-[18px] text-primary" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 border-t border-sidebar-border pt-3">
          {isMaster && (
            <Link
              to="/master"
              onClick={() => setOpen(false)}
              className="mb-2 flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.95rem] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            >
              <ShieldCheck className="size-[18px] text-primary" /> Painel master
            </Link>
          )}
          <p className="truncate px-3 text-xs text-muted-foreground">{user?.email}</p>
          <Button
            variant="ghost"
            className="mt-1 w-full justify-start text-sidebar-foreground"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/" });
            }}
          >
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 bg-card px-3 py-3">
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
        <main className="mx-auto w-full max-w-6xl p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
