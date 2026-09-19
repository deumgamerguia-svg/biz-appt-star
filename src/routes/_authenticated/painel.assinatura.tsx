import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Camera, Copy, Check, CreditCard } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/lib/business";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/painel/assinatura")({
  head: () => ({
    meta: [
      { title: "Assinatura — Agenda Agora" },
      { name: "description", content: "Plano mensal, cadastro e dados da sua conta." },
      { property: "og:title", content: "Assinatura — Agenda Agora" },
      { property: "og:description", content: "Plano, cadastro e dados da sua conta." },
    ],
  }),
  component: SubscriptionAccountPage,
});

const ACCOUNT_TABS = [
  "Visão Geral",
  "Assinatura",
  "Faturas",
  "Afiliados",
  "Notificações",
  "Suporte & FAQ",
] as const;

function formatAccountDate(value?: string | null) {
  if (!value) return "Não disponível";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function shortId(value?: string | null) {
  if (!value) return "—";
  return `${value.slice(0, 8)}...`;
}

function SubscriptionAccountPage() {
  const { user } = useAuth();
  const { businesses, business, businessId } = useBusiness();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<(typeof ACCOUNT_TABS)[number]>("Assinatura");

  const { data: profile } = useQuery({
    queryKey: ["subscription-account-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, created_at")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: payment } = useQuery({
    queryKey: ["subscription-account-current-payment", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const referenceMonth = `${new Date().toISOString().slice(0, 7)}-01`;
      const { data, error } = await supabase
        .from("subscription_payments")
        .select("status, amount_cents, reference_month, paid_at")
        .eq("business_id", businessId!)
        .eq("reference_month", referenceMonth)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["subscription-account-invoices", businessId],
    enabled: !!businessId && activeTab === "Faturas",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_payments")
        .select("id, status, amount_cents, reference_month, paid_at, created_at")
        .eq("business_id", businessId!)
        .order("reference_month", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const accountName =
    profile?.full_name?.trim() ||
    (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") ||
    business?.name ||
    "Usuário";
  const accountEmail = profile?.email || user?.email || "E-mail não informado";
  const accountInitial = accountName.charAt(0).toUpperCase() || "U";
  const memberSince = profile?.created_at || user?.created_at || null;
  const lastAccess = user?.last_sign_in_at || user?.updated_at || null;
  const paidCurrentMonth = payment?.status === "pago";
  const planName = paidCurrentMonth ? "Assinatura ativa" : "Teste Grátis";
  const planHint = paidCurrentMonth ? "Plano ativo" : "Plano ativo";
  const currentPlanPrice = payment?.amount_cents ?? business?.monthly_fee_cents ?? 0;

  const copyUserId = async () => {
    if (!user?.id) return;
    await navigator.clipboard.writeText(user.id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="mx-auto w-full max-w-5xl pb-8">
      <section className="overflow-hidden rounded-[20px] border border-[#26292f] bg-[#050607] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            <div className="flex size-[88px] items-center justify-center rounded-[20px] bg-[#f4f4f5] text-2xl font-semibold text-[#111318]">
              {accountInitial}
            </div>
            <button
              type="button"
              aria-label="Alterar foto do perfil"
              className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-[9px] border-2 border-[#050607] bg-[#146cff] text-white shadow-[0_4px_14px_rgba(20,108,255,0.35)]"
            >
              <Camera className="size-4" strokeWidth={2} />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[26px] font-semibold leading-tight tracking-[-0.035em] text-[#f5f5f6]">
              {accountName}
            </h1>
            <p className="mt-1 truncate text-sm text-[#777d87]">{accountEmail}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-emerald-400/35 bg-emerald-400/[0.10] px-3 py-1 text-[11px] font-semibold text-emerald-300">
                {planName}
              </span>
              <button
                type="button"
                onClick={copyUserId}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#2d3037] bg-[#15171b] px-3 py-1 text-[10px] font-medium text-[#7f858f] transition-colors hover:border-[#3b4049] hover:text-[#b8bdc5]"
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {shortId(user?.id)}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[17px] border border-[#0e4eaf] bg-[linear-gradient(145deg,#07101f_0%,#060b14_55%,#070a0f_100%)] p-5 sm:p-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.10em] text-[#69717f]">Seu plano</p>
          <p className="mt-1.5 text-[22px] font-semibold tracking-[-0.03em] text-[#f4f5f7]">{planName}</p>
          <p className="mt-0.5 text-xs text-[#3479ff]">{planHint}</p>
          <Link
            to="/painel/pagamentos"
            className="mt-4 flex h-10 w-full items-center justify-center rounded-[9px] bg-[#0d4bc3] text-sm font-medium text-white transition-colors hover:bg-[#1558d5]"
          >
            Gerenciar assinatura
          </Link>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <AccountStat label="MEMBRO DESDE" value={formatAccountDate(memberSince)} />
        <AccountStat label="ÚLTIMO ACESSO" value={formatAccountDate(lastAccess)} />
        <AccountStat label="CONTAS CONECTADAS" value={String(businesses.length)} className="col-span-1" />
      </section>

      <nav className="mt-7 flex flex-wrap gap-x-7 gap-y-1 border-b border-[#272a30] px-1">
        {ACCOUNT_TABS.map((tab) => {
          const active = tab === activeTab;
          const interactive = tab === "Assinatura" || tab === "Faturas";

          return (
            <button
              key={tab}
              type="button"
              onClick={() => interactive && setActiveTab(tab)}
              className={`relative py-3 text-sm font-medium transition-colors ${
                active ? "text-white" : "text-[#666d78] hover:text-[#d9dce1]"
              } ${interactive ? "cursor-pointer" : "cursor-default"}`}
            >
              {tab}
              {active ? (
                <span className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-full bg-[#1774ff]" />
              ) : null}
            </button>
          );
        })}
      </nav>

      {activeTab === "Faturas" ? (
        <section className="mt-4 rounded-[18px] border border-[#272a30] bg-[#050607] p-4 sm:p-6">
          <div className="mb-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#686f7b]">Faturas</p>
            <p className="mt-1 text-sm text-[#7b818b]">Histórico de mensalidades da sua conta.</p>
          </div>

          {invoicesLoading ? (
            <div className="rounded-[12px] border border-[#25282d] bg-[#0d0e11] px-4 py-5 text-center text-sm text-[#777e88]">
              Carregando faturas...
            </div>
          ) : invoices?.length ? (
            <div className="space-y-3">
              {invoices.map((invoice) => {
                const paid = invoice.status === "pago";
                const dateValue = paid
                  ? invoice.paid_at || invoice.created_at
                  : invoice.reference_month;
                const invoiceDate = new Date(dateValue).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  timeZone: "America/Sao_Paulo",
                });

                return (
                  <div
                    key={invoice.id}
                    className={`grid min-h-[64px] grid-cols-[1fr_1fr_1fr] items-center rounded-[9px] border px-4 text-sm font-semibold ${
                      paid
                        ? "border-emerald-300/70 bg-[#008332] text-white"
                        : "border-amber-200/80 bg-[#dfa900] text-white"
                    }`}
                  >
                    <span className="text-left sm:text-center">{invoiceDate}</span>
                    <span className="text-center">{formatPrice(invoice.amount_cents)}</span>
                    <span className="text-right sm:text-center">{paid ? "Pago" : "A vencer"}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[12px] border border-[#25282d] bg-[#0d0e11] px-4 py-6 text-center text-sm text-[#777e88]">
              Nenhuma fatura registrada ainda.
            </div>
          )}
        </section>
      ) : (
        <section className="mt-4 rounded-[18px] border border-[#272a30] bg-[#050607] p-5 sm:p-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#686f7b]">Plano atual</p>
          <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.10em] text-[#686f7b]">Seu plano</p>
          <p className="mt-2 text-[26px] font-medium tracking-[-0.04em] text-[#f5f5f6]">{planName}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-emerald-300">
              Ativo
            </span>
            <span className="text-sm font-medium text-emerald-300">
              {paidCurrentMonth
                ? payment?.paid_at
                  ? `Pagamento confirmado em ${formatAccountDate(payment.paid_at)}`
                  : "Pagamento confirmado"
                : "Conta ativa em período de teste"}
            </span>
          </div>

          {currentPlanPrice > 0 ? (
            <div className="mt-5 flex items-center gap-2 border-t border-[#202329] pt-4 text-sm">
              <CreditCard className="size-4 text-[#6d7480]" />
              <span className="text-[#6d7480]">Valor mensal</span>
              <span className="ml-auto font-semibold text-[#e8eaed]">{formatPrice(currentPlanPrice)}</span>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

function AccountStat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-[14px] border border-[#282b31] bg-[#0d0e11] p-4 ${className}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#676d77]">{label}</p>
      <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em] text-[#e6e8eb]">{value}</p>
    </div>
  );
}
