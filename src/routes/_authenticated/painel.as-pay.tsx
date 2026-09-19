import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowDownToLine, ArrowUpRight, CircleDollarSign, Clock3, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { formatPrice } from "@/lib/format";
import { PageHeader, NoBusiness } from "@/components/painel/PageHeader";

export const Route = createFileRoute("/_authenticated/painel/as-pay")({
  head: () => ({
    meta: [
      { title: "AS Pay — Agenda Agora" },
      { name: "description", content: "Saldo dos sinais pagos pelos clientes para agendar." },
      { property: "og:title", content: "AS Pay — Agenda Agora" },
      { property: "og:description", content: "Saldo dos sinais pagos pelos clientes." },
    ],
  }),
  component: AsPayPage,
});

function AsPayPage() {
  const { businessId, business } = useBusiness();

  const { data: rows } = useQuery({
    queryKey: ["as-pay", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, customer_name, starts_at, deposit_cents, deposit_paid_at, status")
        .eq("business_id", businessId!)
        .gt("deposit_cents", 0)
        .order("starts_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  if (!businessId) return <NoBusiness />;

  const list = rows ?? [];
  const available = list
    .filter((r) => r.deposit_paid_at && r.status !== "cancelado")
    .reduce((sum, r) => sum + r.deposit_cents, 0);
  const pending = list
    .filter((r) => !r.deposit_paid_at && r.status !== "cancelado")
    .reduce((sum, r) => sum + r.deposit_cents, 0);
  const paidSignals = list.filter((r) => r.deposit_paid_at && r.status !== "cancelado");
  const performance = buildPerformance(paidSignals);
  const now = new Date();
  const monthTotal = paidSignals
    .filter((row) => {
      const paidAt = new Date(row.deposit_paid_at!);
      return paidAt.getMonth() === now.getMonth() && paidAt.getFullYear() === now.getFullYear();
    })
    .reduce((sum, row) => sum + row.deposit_cents, 0);
  const withdrawals = 0;
  const cashFlowTotal = monthTotal + withdrawals;
  const signalsShare = cashFlowTotal ? Math.round((monthTotal / cashFlowTotal) * 100) : 0;
  const withdrawalsShare = cashFlowTotal ? 100 - signalsShare : 0;

  return (
    <div>
      <PageHeader
        title="Sua carteira"
        subtitle={`Sinais pagos pelos clientes de ${business?.name ?? "seu negócio"}.`}
      />

      <div className="report-luminous-card report-effect-strong mx-auto max-w-2xl p-6">
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.18)]">
              <CircleDollarSign className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Saldo disponível</p>
              <p className="font-display text-3xl font-bold text-primary">{formatPrice(available)}</p>
            </div>
          </div>

          <div className="h-px w-full bg-white/10" />

          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.18)]">
              <Clock3 className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Saldo pendente</p>
              <p className="font-display text-3xl font-bold">{formatPrice(pending)}</p>
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-muted-foreground">
        Todas as transações de sinal são intermediadas pelo Agenda Agora.
      </p>

      <div className="mx-auto mt-8 max-w-2xl space-y-3">
        <section className="report-luminous-card report-effect-strong as-pay-card as-pay-performance-card">
          <div className="as-pay-performance-summary">
            <div className="min-w-0">
              <h2>Performance</h2>
              <p>Últimos 7 dias</p>
            </div>
            <Metric label="Total" value={formatPrice(performance.total)} emphasized />
            <Metric label="Média/dia" value={formatPrice(performance.average)} />
            <Metric label="Melhor dia" value={performance.bestDay} emphasized />
          </div>
          <PerformanceChart data={performance.days} />
        </section>

        <section className="report-luminous-card report-effect-medium as-pay-card p-4 sm:p-5">
          <div className="as-pay-section-title">
            <Activity aria-hidden="true" />
            <h2>Fluxo de Caixa</h2>
          </div>
          <div className="mt-4 space-y-2.5">
            <CashFlowRow
              icon={ArrowDownToLine}
              label="Sinais recebidos"
              value={monthTotal}
              percentage={signalsShare}
              positive
            />
            <CashFlowRow
              icon={ArrowUpRight}
              label="Saques"
              value={withdrawals}
              percentage={withdrawalsShare}
            />
          </div>
        </section>

        <section className="report-luminous-card report-effect-subtle as-pay-card as-pay-month-card">
          <div>
            <p className="as-pay-eyebrow">Este mês</p>
            <p className="mt-2 text-2xl font-medium tracking-[-0.03em] text-[#f2f4f8]">
              {formatPrice(monthTotal)}
            </p>
          </div>
          <div className="as-pay-month-segments" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index} className={index === 6 ? "is-active" : undefined} />
            ))}
          </div>
        </section>

        <section className="report-luminous-card report-effect-none as-pay-card as-pay-history-card">
          <div className="as-pay-history-header">
            <h2>Histórico de Saques</h2>
            <p>Acompanhe seus saques realizados</p>
          </div>
          <div className="as-pay-empty-withdrawals">
            <div className="as-pay-empty-icon">
              <Landmark aria-hidden="true" />
            </div>
            <p>Nenhum saque realizado</p>
            <span>Seus saques aparecerão aqui</span>
          </div>
        </section>
      </div>
    </div>
  );
}

type PaidSignal = {
  deposit_cents: number;
  deposit_paid_at: string | null;
};

type PerformanceDay = {
  key: string;
  label: string;
  value: number;
};

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekdayLabel(date: Date) {
  const label = date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildPerformance(signals: PaidSignal[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: PerformanceDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return { key: dateKey(date), label: weekdayLabel(date), value: 0 };
  });
  const totals = new Map(days.map((day) => [day.key, 0]));

  for (const signal of signals) {
    if (!signal.deposit_paid_at) continue;
    const key = dateKey(new Date(signal.deposit_paid_at));
    if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + signal.deposit_cents);
  }

  days.forEach((day) => {
    day.value = totals.get(day.key) ?? 0;
  });

  const total = days.reduce((sum, day) => sum + day.value, 0);
  const best = days.reduce((current, day) => (day.value >= current.value ? day : current));

  return {
    days,
    total,
    average: Math.round(total / 7),
    bestDay: best.label,
  };
}

function Metric({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className="as-pay-metric">
      <span>{label}</span>
      <strong className={emphasized ? "text-[#5da8ff]" : undefined}>{value}</strong>
    </div>
  );
}

function PerformanceChart({ data }: { data: PerformanceDay[] }) {
  const maxValue = Math.max(...data.map((day) => day.value), 1);
  const baseline = 154;
  const points = data.map((day, index) => ({
    ...day,
    x: 12 + index * 112.65,
    y: baseline - (day.value / maxValue) * 124,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `M ${points[0].x} ${baseline} L ${points
    .map((point) => `${point.x} ${point.y}`)
    .join(" L ")} L ${points.at(-1)!.x} ${baseline} Z`;

  return (
    <div className="as-pay-chart">
      <svg viewBox="0 0 700 176" role="img" aria-label="Sinais recebidos nos últimos sete dias">
        <defs>
          <linearGradient id="as-pay-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1677ff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#1677ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[28, 70, 112, 154].map((y) => (
          <line key={y} x1="12" x2="688" y1={y} y2={y} className="as-pay-grid-line" />
        ))}
        <path d={area} fill="url(#as-pay-area)" />
        <polyline points={line} className="as-pay-chart-line" />
        {points.map((point) => (
          <circle key={point.key} cx={point.x} cy={point.y} r="4" className="as-pay-chart-point" />
        ))}
      </svg>
      <div className="as-pay-chart-labels">
        {data.map((day) => (
          <span key={day.key}>{day.label}</span>
        ))}
      </div>
    </div>
  );
}

function CashFlowRow({
  icon: Icon,
  label,
  value,
  percentage,
  positive = false,
}: {
  icon: typeof ArrowDownToLine;
  label: string;
  value: number;
  percentage: number;
  positive?: boolean;
}) {
  return (
    <div className="as-pay-flow-row">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Icon aria-hidden="true" />
          {label}
        </span>
        <strong className={positive ? "text-[#5da8ff]" : undefined}>{formatPrice(value)}</strong>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="as-pay-progress-track">
          <span
            className={positive ? "is-positive" : undefined}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="w-8 text-right text-[0.68rem] text-[#4e545d]">{percentage}%</span>
      </div>
    </div>
  );
}
