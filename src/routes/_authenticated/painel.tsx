import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
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
  MessageSquareText,
  CircleX,
  Settings2,
  Plus,
  MessageCircle,
  Clock3,
  LoaderCircle,
  Package,
  ChevronDown,
  SlidersHorizontal,
  Paintbrush,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/lib/business";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import brandLogo from "@/assets/agenda-agora-logo.png.asset.json";
import { RuntimeProfiler } from "@/lib/runtime-profiler";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Agenda Agora" },
      {
        name: "description",
        content: "Gerencie a agenda, os serviços e os clientes do negócio.",
      },
      { property: "og:title", content: "Painel — Agenda Agora" },
      { property: "og:description", content: "Gerencie a agenda do seu negócio." },
    ],
  }),
  component: ProfiledPainelLayout,
});

function ProfiledPainelLayout() {
  return (
    <RuntimeProfiler id="PainelLayout">
      <PainelLayout />
    </RuntimeProfiler>
  );
}

const nav = [
  {
    title: "Agenda",
    items: [
      {
        to: "/painel",
        label: "Agenda",
        hint: "Visão dos horários",
        icon: CalendarDays,
        exact: true,
      },
      {
        to: "/painel/bloqueios",
        label: "Horários Bloqueados",
        hint: "Folgas e indisponibilidades",
        icon: CircleX,
      },
      {
        to: "/painel/funcionamento",
        label: "Funcionamento",
        hint: "Dias e horários",
        icon: Clock3,
      },
    ],
  },
  {
    title: "Gestão",
    items: [
      { to: "/painel/clientes", label: "Clientes", hint: "Cadastro de clientes", icon: Users },
      {
        to: "/painel/profissionais",
        label: "Profissionais",
        hint: "Equipe e permissões",
        icon: UserRound,
      },
      { to: "/painel/servicos", label: "Serviço", hint: "Serviços e valores", icon: Scissors },
      { to: "/painel/produtos", label: "Produtos", hint: "Produtos e catálogo", icon: Package },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { to: "/painel/as-pay", label: "AS Pay", hint: "Saldo dos sinais", icon: Gem },
      {
        to: "/painel/relatorio",
        label: "Relatório",
        hint: "Métricas e resultados",
        icon: PieChart,
      },
    ],
  },
  {
    title: "Comunicação",
    items: [
      {
        to: "/painel/templates",
        label: "Templates",
        hint: "Mensagens prontas",
        icon: MessageSquareText,
      },
      { to: "/painel/whatsapp", label: "WhatsApp", hint: "Conexão e mensagens", icon: MessageCircle },
      { to: "/painel/lembretes", label: "Lembretes", hint: "Envios automáticos", icon: BellRing },
    ],
  },
  {
    title: "Sistema",
    items: [
      {
        to: "/painel/configuracoes",
        label: "Configurações",
        hint: "Preferências do negócio",
        icon: Settings2,
      },
      { to: "/painel/integracoes", label: "Integrações", hint: "Serviços conectados", icon: Plus },
      { to: "/painel/negocios", label: "Negócios", hint: "Configurar Painel 1", icon: Store },
    ],
  },
] as const;

const WEEKDAYS = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"] as const;
const MONTHS = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
] as const;

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function panelDate(date: Date) {
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} DE ${MONTHS[date.getMonth()]} DE ${date.getFullYear()}`;
}

function formatAccountPhone(phone?: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone || "Não informado";
}

function PanelGreeting({ name }: { name: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-w-0">
      <p className="truncate text-[14px] font-semibold leading-[16px] tracking-[-0.012em] text-[#e6e6e6]">
        {greetingFor(now)},{" "}
        <span
          key={name}
          className="inline-block font-bold text-[#1f6df9] animate-in fade-in slide-in-from-bottom-1 duration-500"
        >
          {name}
        </span>
      </p>
      <p className="mt-[5px] truncate text-[10px] font-medium uppercase leading-[12px] tracking-[0.09em] text-[#6a6a73]">
        {panelDate(now)}
      </p>
    </div>
  );
}

function WhatsAppBrandIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20.52 3.48A11.82 11.82 0 0 0 12.08 0C5.5 0 .14 5.36.14 11.95c0 2.1.55 4.16 1.6 5.97L.04 24l6.23-1.64a11.9 11.9 0 0 0 5.8 1.48h.01C18.66 23.84 24 18.48 24 11.9c0-3.18-1.24-6.17-3.48-8.42Zm-8.44 18.35h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.7.97.99-3.6-.23-.37a9.88 9.88 0 0 1-1.52-5.29c0-5.47 4.44-9.92 9.9-9.92a9.84 9.84 0 0 1 7 2.91 9.84 9.84 0 0 1 2.9 7c-.01 5.46-4.45 9.89-9.91 9.89Zm5.43-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.21 5.1 4.5.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
      className={`group flex flex-1 items-center justify-center rounded-xl border px-4 py-2.5 text-[13px] font-semibold tracking-[0.02em] transition-all ${
        connected
          ? "border-[#1677ff]/45 bg-[#1677ff]/[0.06] text-[#5da8ff] hover:border-[#1677ff]/70 hover:bg-[#1677ff]/10"
          : "border-red-500/30 bg-red-500/[0.04] text-red-400 hover:bg-red-500/[0.08]"
      }`}
    >
      <MessageCircle className="mr-2 size-4 transition-transform group-hover:scale-105" />
      {connected ? "WHATSAPP CONECTADO" : "WHATSAPP DESCONECTADO"}
    </Link>
  );
}

function PainelLayout() {
  const { user, signOut } = useAuth();
  const { business, businessId } = useBusiness();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [configOpen, setConfigOpen] = useState(() => pathname.startsWith("/painel/configuracoes"));

  const { data: greetingProfile } = useQuery({
    queryKey: ["owner-greeting-name", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: accountSubscription } = useQuery({
    queryKey: ["sidebar-account-subscription", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const referenceMonth = `${new Date().toISOString().slice(0, 7)}-01`;
      const { data, error } = await supabase
        .from("subscription_payments")
        .select("status, reference_month, paid_at")
        .eq("business_id", businessId!)
        .eq("reference_month", referenceMonth)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (pathname.startsWith("/painel/configuracoes")) setConfigOpen(true);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!transitioning) return;
    const timer = window.setTimeout(() => setTransitioning(false), 360);
    return () => window.clearTimeout(timer);
  }, [pathname, transitioning]);

  useEffect(() => {
    if (!accountOpen && !supportOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        setSupportOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [accountOpen, supportOpen]);

  const beginNavigation = () => {
    setOpen(false);
    setAccountOpen(false);
    setTransitioning(true);
  };

  const greetingName = greetingProfile?.full_name?.trim() || business?.name || "Usuário";
  const accountName = greetingProfile?.full_name?.trim() || business?.name || "Usuário";
  const accountInitial = accountName.charAt(0).toUpperCase() || "U";
  const paidCurrentMonth = accountSubscription?.status === "pago";
  const accountPlanLabel = paidCurrentMonth ? "Assinatura ativa" : "Teste Grátis";
  const accountPhone = formatAccountPhone(business?.phone);

  return (
    <div className="owner-panel relative min-h-screen overflow-x-hidden bg-[#050607] text-[#f3f4f6] lg:flex">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_0%_20%,rgba(15,48,86,0.42),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(0,70,150,0.16),transparent_34%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(115deg,rgba(11,29,49,0.18),transparent_32%,transparent_70%,rgba(4,15,28,0.18))]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -left-40 top-1/4 z-0 size-[28rem] rounded-full bg-blue-600/[0.055] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -right-40 bottom-0 z-0 size-[30rem] rounded-full bg-cyan-400/[0.045] blur-3xl"
      />

      <Button
        type="button"
        variant="ghost"
        aria-label="Fechar menu"
        onClick={() => setOpen(false)}
        className={`${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        } fixed inset-0 z-40 h-auto w-auto rounded-none bg-[#050607]/75 p-0 backdrop-blur-[2px] transition-opacity hover:bg-[#050607]/75 lg:hidden`}
      />

      <RuntimeProfiler id="Sidebar">
      <aside
        className={`${
          open ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-50 flex w-[17.5rem] max-w-[82vw] flex-col overflow-hidden border-r border-[#1b2d47] bg-[radial-gradient(ellipse_120%_54%_at_0%_0%,rgba(22,119,255,0.28)_0%,rgba(22,119,255,0.15)_28%,rgba(22,119,255,0.055)_49%,transparent_72%),linear-gradient(180deg,rgba(6,9,15,0.72)_0%,rgba(5,7,11,0.68)_34%,rgba(5,6,7,0.62)_100%)] px-5 py-4 shadow-[18px_0_55px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(93,168,255,0.10),inset_-1px_0_0_rgba(22,119,255,0.08)] backdrop-blur-xl transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:w-[18.5rem] lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:px-5 lg:shadow-[inset_0_1px_0_rgba(93,168,255,0.10),inset_-1px_0_0_rgba(22,119,255,0.08)]`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-28 -top-32 z-0 h-[23rem] w-[23rem] rounded-full bg-[#1677ff]/[0.16] blur-[86px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-0 h-[18rem] w-px bg-gradient-to-b from-[#5da8ff]/70 via-[#1677ff]/30 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-32 bg-[linear-gradient(180deg,rgba(93,168,255,0.075)_0%,rgba(22,119,255,0.025)_42%,transparent_100%)]"
        />

        <Link
          to="/painel"
          onClick={beginNavigation}
          className="group relative z-10 flex h-[5.25rem] shrink-0 items-center border-b border-[#25282c] px-1"
        >
          <img
            src={brandLogo.url}
            alt="Agenda Agora"
            className="h-11 w-auto max-w-[220px] object-contain object-left transition-transform duration-300 group-hover:scale-[1.01]"
          />
        </Link>

        <div className="relative z-50 shrink-0 border-b border-[#25282c] px-1 py-3">
          <div className="flex items-center rounded-xl px-1 py-1 transition-colors hover:bg-white/[0.025]">
            <button
              type="button"
              aria-expanded={accountOpen}
              aria-label="Abrir dados da conta"
              onClick={() => setAccountOpen((value) => !value)}
              className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[#1677ff]/70"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[#f2f3f5] text-[11px] font-semibold text-[#111318] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition-transform duration-150 group-hover:scale-[1.02]">
                {accountInitial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold leading-[14px] tracking-[-0.01em] text-[#f0f1f3]">
                  {accountName}
                </span>
                <span className="mt-[3px] flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[9.5px] leading-3 text-[#626872]">Usuário</span>
                  <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/[0.09] px-1.5 py-[2px] text-[8.5px] font-semibold leading-none text-emerald-300">
                    {accountPlanLabel}
                  </span>
                </span>
              </span>
            </button>

            <button
              type="button"
              aria-label="Sair da conta"
              title="Sair da conta"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#666d76] transition-colors hover:bg-white/[0.04] hover:text-[#d7dbe1] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1677ff]/70"
              onClick={async () => {
                await signOut();
                void navigate({ to: "/auth" });
              }}
            >
              <LogOut className="size-[15px]" strokeWidth={1.7} />
            </button>
          </div>

          {accountOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+0.6rem)] z-[60] isolate rounded-2xl border border-[#272a2f] bg-[#050607] p-3.5 shadow-[0_18px_55px_rgba(0,0,0,0.82)] animate-in fade-in slide-in-from-top-2 duration-150" style={{ backgroundColor: "#050607" }}>
              <div className="flex items-center gap-3 border-b border-[#22252a] pb-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f2f3f5] text-[12px] font-semibold text-[#111318] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                  {accountInitial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold leading-4 text-[#f0f1f3]">
                    {accountName}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-4 text-[#676d76]">Dados da conta</p>
                </div>
              </div>

              <div className="mt-3 space-y-2.5 text-[11px]">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[#646b75]">Estabelecimento</span>
                  <span className="max-w-[58%] truncate text-right font-medium text-[#cfd3d9]">
                    {business?.name ?? "Não configurado"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[#646b75]">Telefone</span>
                  <span className="text-right font-medium text-[#cfd3d9]">{accountPhone}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#646b75]">Plano</span>
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/[0.09] px-2 py-0.5 text-[9px] font-semibold text-emerald-300">
                    {accountPlanLabel}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[#646b75]">Acesso</span>
                  <span className={`text-right font-medium ${business?.status === "suspenso" ? "text-red-400" : "text-[#cfd3d9]"}`}>
                    {business?.status === "suspenso" ? "Suspenso" : "Ativo"}
                  </span>
                </div>
              </div>

              <Link
                to="/painel/assinatura"
                onClick={beginNavigation}
                className="mt-3 flex w-full items-center justify-center rounded-xl border border-[#262a30] bg-[#111317] px-3 py-2 text-[11px] font-medium text-[#cfd3d9] transition-colors hover:border-[#1677ff]/30 hover:bg-[#1677ff]/[0.06] hover:text-white"
              >
                Ver dados da assinatura
              </Link>
            </div>
          )}
        </div>

        <nav className="relative z-10 min-h-0 flex-1 space-y-6 overflow-y-auto py-5 pr-1">
          {nav.map((group) => (
            <section key={group.title}>
              <p className="px-3 pb-2 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#4f5660]">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  if (item.to === "/painel/configuracoes") {
                    const active = pathname.startsWith("/painel/configuracoes");
                    return (
                      <div key={item.to} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setConfigOpen((value) => !value)}
                          className={`owner-nav-item group relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${active ? "owner-nav-active border-[#1677ff]/15 bg-[#1677ff]/[0.09] text-[#f3f4f6]" : "border-transparent text-[#7f8793] hover:border-[#1677ff]/10 hover:bg-[#1677ff]/[0.055] hover:text-[#e5e7eb]"}`}
                        >
                          <Settings2 className="size-5 shrink-0 transition-colors group-hover:text-[#5da8ff]" strokeWidth={1.8} />
                          <span className="min-w-0 flex-1 leading-[1.25]"><span className="owner-nav-label block text-[0.86rem] font-medium">Configurações</span><span className="owner-nav-hint block truncate text-[0.7rem] font-normal text-[#555d68]">Preferências do negócio</span></span>
                          <ChevronDown className={`size-4 shrink-0 transition-transform duration-200 ${configOpen ? "rotate-180" : ""}`} />
                        </button>
                        {configOpen && (
                          <div className="ml-2 space-y-1 rounded-xl border border-[#1677ff]/10 bg-[#1677ff]/[0.045] p-1.5">
                            <Link
                              to="/painel/configuracoes"
                              search={{ secao: "preferencias" }}
                              onClick={beginNavigation}
                              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[0.82rem] font-medium text-[#c9ced6] transition-colors hover:bg-[#1677ff]/10 hover:text-white"
                            >
                              <SlidersHorizontal className="size-4 text-[#5da8ff]" />
                              Preferências
                            </Link>
                            <Link
                              to="/painel/configuracoes"
                              search={{ secao: "aparencia" }}
                              onClick={beginNavigation}
                              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[0.82rem] font-medium text-[#c9ced6] transition-colors hover:bg-[#1677ff]/10 hover:text-white"
                            >
                              <Paintbrush className="size-4 text-[#5da8ff]" />
                              Aparências
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={{ exact: "exact" in item ? item.exact : false }}
                      onClick={beginNavigation}
                      className="owner-nav-item group relative flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-[#7f8793] transition-all duration-200 hover:border-[#1677ff]/10 hover:bg-[#1677ff]/[0.055] hover:text-[#e5e7eb]"
                      activeProps={{
                        className:
                          "owner-nav-item owner-nav-active group relative flex items-center gap-3 rounded-xl border border-[#1677ff]/15 bg-[#1677ff]/[0.09] px-3 py-2.5 text-[#f3f4f6] shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
                      }}
                    >
                      <item.icon
                        className="size-5 shrink-0 transition-colors group-hover:text-[#5da8ff]"
                        strokeWidth={1.8}
                      />
                      <span className="min-w-0 leading-[1.25]">
                        <span className="owner-nav-label block text-[0.86rem] font-medium">
                          {item.label}
                        </span>
                        <span className="owner-nav-hint block truncate text-[0.7rem] font-normal text-[#555d68]">
                          {item.hint}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="relative z-20 shrink-0 border-t border-[#25282c] pt-3">
          {supportOpen && (
            <div className="absolute bottom-[calc(100%+0.55rem)] left-0 right-0 rounded-[13px] border border-[#303238] bg-[#0a0b0d] p-2.5 shadow-[0_18px_45px_rgba(0,0,0,0.62)] animate-in fade-in slide-in-from-bottom-2 duration-150">
              <a
                href="https://wa.me/5511948037906"
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12px] font-semibold text-[#e9ebef] transition-colors hover:bg-white/[0.045]"
              >
                <WhatsAppBrandIcon className="size-[18px] shrink-0 text-[#25d366]" />
                <span className="truncate">Suporte Agenda Agora</span>
              </a>
            </div>
          )}

          <button
            type="button"
            aria-expanded={supportOpen}
            aria-label="Abrir suporte WhatsApp"
            onClick={() => setSupportOpen((value) => !value)}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[#c8cdd4] transition-colors hover:bg-white/[0.035] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#25d366]/50"
          >
            <WhatsAppBrandIcon className="size-5 shrink-0 text-[#25d366]" />
            <span className="min-w-0 flex-1 text-[0.86rem] font-medium">Suporte WhatsApp</span>
            <ChevronDown
              className={`size-4 shrink-0 text-[#25d366] transition-transform duration-200 ${supportOpen ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          </button>
        </div>
      </aside>
      </RuntimeProfiler>

      <div className="relative z-10 min-w-0 flex-1">
        <div
          aria-hidden="true"
          className={`owner-route-progress ${transitioning ? "is-visible" : ""}`}
        />
        <RuntimeProfiler id="Header">
        <header className="sticky top-0 z-30 grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#25282c] bg-[#050607]/90 px-3 py-3 shadow-[0_10px_35px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 rounded-[11px] border border-[#2b2b2e] bg-[#0d0d10] text-[#e6e6e6] shadow-none hover:bg-[#121216] hover:text-white"
              onClick={() => setOpen((v) => !v)}
              aria-label="Abrir menu"
            >
              <Menu className="size-5" />
            </Button>
            <PanelGreeting name={greetingName} />
          </div>
          <WhatsappBadge />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-xl text-[#7f8793] hover:bg-[#1677ff]/[0.055] hover:text-[#f3f4f6]"
            aria-label="Notificações"
          >
            <Bell className="size-5" />
          </Button>
        </header>
        </RuntimeProfiler>

        <main className="relative mx-auto w-full max-w-7xl p-4 sm:p-7 lg:p-8">
          {transitioning && (
            <div className="owner-route-loader" aria-label="Carregando página" role="status">
              <LoaderCircle className="size-6 animate-spin text-[#1677ff]" />
            </div>
          )}
          <RuntimeProfiler id="RouteOutlet">
            <div key={pathname} className="owner-route-content">
              <Outlet />
            </div>
          </RuntimeProfiler>
        </main>
      </div>
    </div>
  );
}
