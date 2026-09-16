import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, Trash2, Plus, ExternalLink, Ban, PlayCircle, KeyRound } from "lucide-react";
import {
  createBusinessWithOwner,
  deleteBusiness,
  getMasterStatus,
  getPlatformMetrics,
  listAllBusinesses,
  registerSubscriptionCharge,
  setBusinessStatus,
  setMonthlyFee,
} from "@/lib/master-dashboard.functions";
import { updateBusinessOwnerAccess } from "@/lib/master-users.functions";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/master")({
  head: () => ({
    meta: [
      { title: "Painel master — Agenda Agora" },
      {
        name: "description",
        content: "Área da plataforma para cadastrar estabelecimentos e criar o acesso dos donos.",
      },
      { property: "og:title", content: "Painel master — Agenda Agora" },
      { property: "og:description", content: "Gerencie todos os estabelecimentos da plataforma." },
    ],
  }),
  component: MasterPage,
});

const emptyForm = {
  businessName: "",
  category: "outro",
  ownerName: "",
  phone: "",
  password: "",
};

const formatPhone = (value: string) => {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

function MasterPage() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const statusFn = useServerFn(getMasterStatus);
  const listFn = useServerFn(listAllBusinesses);
  const createFn = useServerFn(createBusinessWithOwner);
  const deleteFn = useServerFn(deleteBusiness);
  const metricsFn = useServerFn(getPlatformMetrics);
  const statusUpdateFn = useServerFn(setBusinessStatus);
  const feeFn = useServerFn(setMonthlyFee);
  const chargeFn = useServerFn(registerSubscriptionCharge);
  const ownerAccessFn = useServerFn(updateBusinessOwnerAccess);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const status = useQuery({
    queryKey: ["master-status", session?.user.id],
    enabled: !!accessToken,
    queryFn: () => statusFn({ data: { accessToken } }),
    retry: 1,
  });

  const businesses = useQuery({
    queryKey: ["master-businesses"],
    enabled: !!accessToken && !!status.data?.isMaster,
    queryFn: () => listFn({ data: { accessToken } }),
  });

  const create = useMutation({
    mutationFn: () => createFn({ data: { ...form, accessToken } }),
    onSuccess: () => {
      toast.success("Estabelecimento e acesso do dono criados!");
      setOpen(false);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["master-businesses"] });
      void queryClient.invalidateQueries({ queryKey: ["master-metrics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id, accessToken } }),
    onSuccess: () => {
      toast.success("Estabelecimento removido.");
      void queryClient.invalidateQueries({ queryKey: ["master-businesses"] });
      void queryClient.invalidateQueries({ queryKey: ["master-metrics"] });
    },
    onError: () =>
      toast.error("Não foi possível remover: existem dados vinculados a este negócio."),
  });

  const metrics = useQuery({
    queryKey: ["master-metrics"],
    enabled: !!accessToken && !!status.data?.isMaster,
    queryFn: () => metricsFn({ data: { accessToken } }),
  });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["master-businesses"] });
    void queryClient.invalidateQueries({ queryKey: ["master-metrics"] });
  };

  const setStatus = useMutation({
    mutationFn: (vars: { id: string; status: "ativo" | "suspenso" }) =>
      statusUpdateFn({ data: { ...vars, accessToken } }),
    onSuccess: (_r, vars) => {
      toast.success(
        vars.status === "suspenso"
          ? "Estabelecimento suspenso: a página de agendamento ficou indisponível."
          : "Estabelecimento reativado.",
      );
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fee = useMutation({
    mutationFn: (vars: { id: string; amountCents: number }) =>
      feeFn({ data: { ...vars, accessToken } }),
    onSuccess: () => {
      toast.success("Mensalidade atualizada.");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const charge = useMutation({
    mutationFn: (vars: { businessId: string; month: string; status: "pago" | "pendente" }) =>
      chargeFn({ data: { ...vars, accessToken } }),
    onSuccess: () => {
      toast.success("Cobrança registrada como paga.");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ownerAccess = useMutation({
    mutationFn: (vars: { businessId: string; ownerName: string; phone: string; password: string }) =>
      ownerAccessFn({ data: { ...vars, accessToken } }),
    onSuccess: () => {
      toast.success("Acesso do dono atualizado.");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editOwnerAccess = (business: {
    id: string;
    owner_name: string | null;
    owner_login: string | null;
    phone: string | null;
  }) => {
    const ownerName = window.prompt("Nome do dono", business.owner_name ?? "");
    if (ownerName === null || ownerName.trim().length < 2) return;

    const loginPhone = business.owner_login?.endsWith("@agenda.local")
      ? business.owner_login.replace("@agenda.local", "")
      : business.phone ?? "";
    const phone = window.prompt("Telefone usado para entrar no Painel 2", loginPhone);
    if (phone === null || phone.replace(/\D/g, "").length < 10) {
      toast.error("Informe um telefone válido.");
      return;
    }

    const password = window.prompt(
      "Nova senha de 4 dígitos. Deixe vazio para manter a senha atual.",
      "",
    );
    if (password === null) return;
    if (password && !/^\d{4}$/.test(password)) {
      toast.error("A senha precisa ter exatamente 4 dígitos.");
      return;
    }

    ownerAccess.mutate({
      businessId: business.id,
      ownerName: ownerName.trim(),
      phone,
      password,
    });
  };

  if (!accessToken || status.isLoading) {
    return <p className="p-8 text-sm text-muted-foreground">Carregando...</p>;
  }

  if (status.isError || !status.data?.isMaster) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <ShieldCheck className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 text-xl font-bold">Painel master</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua sessão Master precisa ser validada novamente.
        </p>
        <Link to="/master-login" className="mt-6 block text-sm text-primary hover:underline">
          Entrar novamente no Master
        </Link>
      </div>
    );
  }

  const rows = businesses.data ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <ShieldCheck className="size-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Painel master</h1>
          <p className="text-sm text-muted-foreground">
            Crie estabelecimentos, usuários donos e controle seus acessos.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link to="/painel"><Button variant="secondary">Meu painel</Button></Link>
          <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Novo estabelecimento</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Negócios ativos" value={String(metrics.data?.activeBusinesses ?? 0)} hint={`${metrics.data?.suspendedBusinesses ?? 0} suspenso(s)`} />
        <MetricCard label="Mensalidade prevista" value={formatPrice(metrics.data?.mrrCents ?? 0)} hint="Soma das mensalidades ativas" />
        <MetricCard label="Recebido este mês" value={formatPrice(metrics.data?.paidThisMonthCents ?? 0)} hint={`${metrics.data?.delinquentCount ?? 0} em aberto`} />
        <MetricCard label="Faturamento total" value={formatPrice(metrics.data?.revenueTotalCents ?? 0)} hint={`${metrics.data?.appointments ?? 0} agendamentos na plataforma`} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Estabelecimento</th>
              <th className="px-4 py-3">Dono / usuário</th>
              <th className="px-4 py-3">Mensalidade</th>
              <th className="px-4 py-3">Mês atual</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3">Link do cliente</th>
              <th className="px-4 py-3">Acesso do dono</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const suspended = b.status === "suspenso";
              const paid = b.current_month_status === "pago";
              return (
                <tr key={b.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">
                    {b.name}
                    <span className="block text-xs text-muted-foreground">{b.category} · {b.appointments} agendamento(s)</span>
                  </td>
                  <td className="px-4 py-3">
                    {b.owner_name ?? "—"}
                    <span className="block text-xs text-muted-foreground">{b.owner_login ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" className="text-primary hover:underline" onClick={() => {
                      const input = window.prompt("Valor da mensalidade em reais", ((b.monthly_fee_cents ?? 0) / 100).toFixed(2));
                      if (input === null) return;
                      const amount = Math.round(Number(input.replace(",", ".")) * 100);
                      if (!Number.isFinite(amount) || amount < 0) { toast.error("Valor inválido"); return; }
                      fee.mutate({ id: b.id, amountCents: amount });
                    }}>{formatPrice(b.monthly_fee_cents ?? 0)}</button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${paid ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{paid ? "Pago" : "Em aberto"}</span>
                    {!paid && <button type="button" className="ml-2 text-xs text-primary hover:underline" onClick={() => charge.mutate({ businessId: b.id, month: currentMonth, status: "pago" })}>marcar pago</button>}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant={suspended ? "secondary" : "ghost"} size="sm" onClick={() => setStatus.mutate({ id: b.id, status: suspended ? "ativo" : "suspenso" })}>
                      {suspended ? <><PlayCircle className="size-4" /> Reativar</> : <><Ban className="size-4" /> Suspender</>}
                    </Button>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/agendar/${b.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">/agendar/{b.slug} <ExternalLink className="size-3" /></a>
                  </td>
                  <td className="px-4 py-3">
                    <a href="/auth" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">/auth <ExternalLink className="size-3" /></a>
                    <button type="button" className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline" disabled={ownerAccess.isPending} onClick={() => editOwnerAccess(b)}>
                      <KeyRound className="size-3" /> editar usuário / senha
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" aria-label={`Remover ${b.name}`} onClick={() => {
                      if (window.confirm(`Remover ${b.name}? Esta ação é permanente.`)) remove.mutate(b.id);
                    }}><Trash2 className="size-4" /></Button>
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum estabelecimento cadastrado ainda.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo estabelecimento e usuário dono</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="bname">Nome do estabelecimento</Label><Input id="bname" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="Ex.: Barbearia do João" /></div>
            <div className="space-y-2"><Label htmlFor="bcat">Segmento</Label><Input id="bcat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex.: barbearia" /></div>
            <div className="space-y-2"><Label htmlFor="oname">Nome do dono</Label><Input id="oname" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="Ex.: João da Silva" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="ophone">Telefone de acesso</Label><Input id="ophone" inputMode="numeric" value={formatPhone(form.phone)} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 93935-4416" /></div>
              <div className="space-y-2"><Label htmlFor="opass">Senha de acesso</Label><Input id="opass" inputMode="numeric" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="Ex.: 1237" maxLength={4} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Este telefone e esta senha são o acesso do dono ao Painel 2. Os profissionais recebem acessos individuais criados dentro do Painel 2.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => create.mutate()} disabled={create.isPending || form.businessName.trim().length < 2 || form.ownerName.trim().length < 2 || form.phone.replace(/\D/g, "").length < 10 || form.password.length !== 4}>Criar estabelecimento e usuário</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
