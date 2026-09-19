import { lazy, Suspense, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RuntimeProfiler } from "@/lib/runtime-profiler";
import { useBusiness } from "@/lib/business";
import { formatPrice } from "@/lib/format";
import { PageHeader, NoBusiness } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import {
  CalendarCheck2,
  ChartNoAxesColumnIncreasing,
  CircleDollarSign,
  HandCoins,
  Scissors,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

const ReportChart = lazy(() =>
  import("@/components/painel/ReportChart").then((module) => ({ default: module.ReportChart })),
);

export const Route = createFileRoute("/_authenticated/painel/relatorio")({
  head: () => ({
    meta: [
      { title: "Relatório — Agenda Agora" },
      { name: "description", content: "Desempenho de atendimentos, faturamento e ocupação." },
      { property: "og:title", content: "Relatório — Agenda Agora" },
      { property: "og:description", content: "Desempenho e faturamento do negócio." },
    ],
  }),
  component: ProfiledRelatorioPage,
});

const RANGES = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

const REPORT_DAY_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

function ProfiledRelatorioPage() {
  return (
    <RuntimeProfiler id="RelatorioPage">
      <RelatorioPage />
    </RuntimeProfiler>
  );
}

function RelatorioPage() {
  const { businessId } = useBusiness();
  const [days, setDays] = useState(30);

  const since = useMemo(() => new Date(Date.now() - days * 86400000).toISOString(), [days]);

  const { data } = useQuery({
    queryKey: ["report", businessId, days],
    enabled: !!businessId,
    queryFn: async () => {
      const [appts, services, pros] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, starts_at, status, service_id, professional_id, customer_name, deposit_cents, deposit_paid_at",
          )
          .eq("business_id", businessId!)
          .gte("starts_at", since)
          .order("starts_at"),
        supabase.from("services").select("id, name, price_cents").eq("business_id", businessId!),
        supabase.from("professionals").select("id, name").eq("business_id", businessId!),
      ]);
      if (appts.error) throw appts.error;
      return {
        appointments: appts.data ?? [],
        services: services.data ?? [],
        professionals: pros.data ?? [],
      };
    },
  });

  const report = useMemo(() => {
    const services = data?.services ?? [];
    const professionals = data?.professionals ?? [];
    const appointments = data?.appointments ?? [];

    const serviceById = new Map(
      services.map((service) => [service.id, service] as const),
    );
    const serviceTotals = new Map<string, number>();
    const professionalTotals = new Map<string, number>();
    const perDay = new Map<string, number>();
    const clients = new Set<string>();

    let total = 0;
    let done = 0;
    let canceled = 0;
    let revenue = 0;
    let deposits = 0;

    for (const appointment of appointments) {
      if (appointment.status === "bloqueado") continue;

      total += 1;
      const completed =
        appointment.status === "concluido" || appointment.status === "confirmado";

      if (completed) {
        done += 1;
        if (appointment.service_id) {
          revenue += serviceById.get(appointment.service_id)?.price_cents ?? 0;
        }
      }
      if (appointment.status === "cancelado") canceled += 1;
      if (appointment.deposit_paid_at) deposits += appointment.deposit_cents ?? 0;

      if (appointment.service_id) {
        serviceTotals.set(
          appointment.service_id,
          (serviceTotals.get(appointment.service_id) ?? 0) + 1,
        );
      }
      if (appointment.professional_id) {
        professionalTotals.set(
          appointment.professional_id,
          (professionalTotals.get(appointment.professional_id) ?? 0) + 1,
        );
      }

      const dayKey = REPORT_DAY_FORMATTER.format(new Date(appointment.starts_at));
      perDay.set(dayKey, (perDay.get(dayKey) ?? 0) + 1);
      clients.add(appointment.customer_name.trim().toLowerCase());
    }

    const byService = services
      .map((service) => {
        const serviceTotal = serviceTotals.get(service.id) ?? 0;
        return {
          name: service.name,
          total: serviceTotal,
          valor: serviceTotal * service.price_cents,
        };
      })
      .filter((service) => service.total > 0)
      .sort((a, b) => b.total - a.total);

    const byProfessional = professionals
      .map((professional) => ({
        name: professional.name,
        total: professionalTotals.get(professional.id) ?? 0,
      }))
      .filter((professional) => professional.total > 0)
      .sort((a, b) => b.total - a.total);

    const chart = [...perDay.entries()].map(([dia, dayTotal]) => ({
      dia,
      total: dayTotal,
    }));

    return {
      total,
      done,
      canceled,
      revenue,
      deposits,
      byService,
      byProfessional,
      chart,
      clients: clients.size,
      ticket: done ? Math.round(revenue / done) : 0,
    };
  }, [data]);

  if (!businessId) return <NoBusiness />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatório"
        subtitle="Faturamento, atendimentos e ocupação do período."
        action={
          <div className="flex gap-2">
            {RANGES.map((r) => (
              <Button
                key={r.days}
                size="sm"
                variant={days === r.days ? "default" : "outline"}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          icon={WalletCards}
          effect="strong"
          label="Faturamento"
          value={formatPrice(report.revenue)}
          hint="Serviços concluídos"
        />
        <Card
          icon={HandCoins}
          effect="medium"
          label="Sinais recebidos"
          value={formatPrice(report.deposits)}
          hint="Pagos pelo cliente"
        />
        <Card
          icon={CalendarCheck2}
          effect="subtle"
          label="Atendimentos"
          value={String(report.total)}
          hint={`${report.done} concluídos · ${report.canceled} cancelados`}
        />
        <Card
          icon={CircleDollarSign}
          effect="none"
          label="Ticket médio"
          value={formatPrice(report.ticket)}
          hint={`${report.clients} cliente(s) no período`}
        />
      </div>

      <RuntimeProfiler id="ReportChartSection">
      <section className="report-luminous-card report-effect-none report-chart-card p-5 sm:p-6">
        <ReportCardTitle icon={ChartNoAxesColumnIncreasing} title="Atendimentos por dia" />
        {report.chart.length ? (
          <div className="relative z-10 mt-5 h-64">
            <Suspense fallback={null}>
              <ReportChart data={report.chart} />
            </Suspense>
          </div>
        ) : (
          <p className="relative z-10 flex min-h-36 items-center justify-center text-center text-sm text-muted-foreground">
            Nenhum atendimento no período.
          </p>
        )}
      </section>
      </RuntimeProfiler>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard
          icon={Scissors}
          title="Serviços mais vendidos"
          rows={report.byService.map((s) => ({
            name: s.name,
            value: `${s.total}x · ${formatPrice(s.valor)}`,
          }))}
        />
        <ListCard
          icon={UsersRound}
          title="Ocupação por profissional"
          rows={report.byProfessional.map((p) => ({
            name: p.name,
            value: `${p.total} atendimento(s)`,
          }))}
        />
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  effect,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  effect: "strong" | "medium" | "subtle" | "none";
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article
      className={`report-luminous-card report-effect-${effect} report-metric-card p-4 sm:p-[1.125rem]`}
    >
      <div className="report-icon-box">
        <Icon className="size-[1.05rem]" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <div className="relative z-10 mt-4">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[#70757f]">
          {label}
        </p>
        <p className="mt-1.5 text-[1.35rem] font-semibold leading-none tracking-[-0.025em] text-[#f2f4f8]">
          {value}
        </p>
        {hint && <p className="mt-2 text-xs leading-relaxed text-[#777d87]">{hint}</p>}
      </div>
    </article>
  );
}

function ReportCardTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="relative z-10 flex items-center gap-3">
      <div className="report-icon-box">
        <Icon className="size-[1.05rem]" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[#eef1f6]">{title}</h2>
    </div>
  );
}

function ListCard({
  icon,
  title,
  rows,
}: {
  icon: LucideIcon;
  title: string;
  rows: { name: string; value: string }[];
}) {
  return (
    <section className="report-luminous-card report-effect-none report-list-card p-5 sm:p-6">
      <ReportCardTitle icon={icon} title={title} />
      {rows.length ? (
        <ul className="relative z-10 mt-5 space-y-2 text-sm">
          {rows.map((r) => (
            <li
              key={r.name}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.055] bg-black/20 px-3.5 py-3"
            >
              <span className="text-[#dfe3ea]">{r.name}</span>
              <span className="shrink-0 text-[#777d87]">{r.value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="relative z-10 flex min-h-32 items-center justify-center text-center text-sm text-muted-foreground">
          Sem dados no período.
        </p>
      )}
    </section>
  );
}
