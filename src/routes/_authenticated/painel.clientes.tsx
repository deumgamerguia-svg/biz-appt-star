import { useDeferredValue, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { Plus, Trash2, Search, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RuntimeProfiler } from "@/lib/runtime-profiler";
import { useBusiness } from "@/lib/business";
import { daysSince } from "@/lib/format";
import { PageHeader, NoBusiness, EmptyList } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/painel/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Agenda Agora" },
      { name: "description", content: "Cadastro de clientes com contato e observações." },
      { property: "og:title", content: "Clientes — Agenda Agora" },
      { property: "og:description", content: "Cadastro de clientes com contato e observações." },
    ],
  }),
  component: ProfiledClientesPage,
});

function ProfiledClientesPage() {
  return (
    <RuntimeProfiler id="ClientesPage">
      <ClientesPage />
    </RuntimeProfiler>
  );
}

function ClientesPage() {
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });

  const { data: customers } = useQuery({
    queryKey: ["customers", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("business_id", businessId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: visits } = useQuery({
    queryKey: ["customer-visits", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("customer_id, starts_at")
        .eq("business_id", businessId!)
        .not("customer_id", "is", null)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const lastVisit = useMemo(() => {
    const map: Record<string, string> = {};
    for (const visit of visits ?? []) {
      if (visit.customer_id && !map[visit.customer_id]) map[visit.customer_id] = visit.starts_at;
    }
    return map;
  }, [visits]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customers", businessId] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").insert({
        business_id: businessId!,
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente cadastrado!");
      setOpen(false);
      setForm({ name: "", phone: "", email: "", notes: "" });
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente removido.");
      void invalidate();
    },
  });

  if (!businessId) return <NoBusiness />;

  const deferredTerm = useDeferredValue(term);
  const filtered = useMemo(() => {
    const normalized = deferredTerm.trim().toLowerCase();
    if (!normalized) return customers ?? [];
    return (customers ?? []).filter((customer) =>
      customer.name.toLowerCase().includes(normalized),
    );
  }, [customers, deferredTerm]);

  const exportCsv = () => {
    const rows = filtered.map((c) => [
      c.name,
      c.phone ?? "",
      c.email ?? "",
      lastVisit[c.id] ? new Date(lastVisit[c.id]!).toLocaleDateString("pt-BR") : "",
      (c.notes ?? "").replace(/\s+/g, " "),
    ]);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [
      ["Nome", "Telefone", "E-mail", "Último atendimento", "Observações"],
      ...rows,
    ]
      .map((r) => r.map((cell) => escape(String(cell))).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Lista de clientes exportada");
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Histórico e contato de quem atende com você."
        action={
          <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="size-4" /> Exportar
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Novo cliente
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo cliente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cname">Nome</Label>
                  <Input
                    id="cname"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cphone">Telefone</Label>
                    <Input
                      id="cphone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cmail">E-mail</Label>
                    <Input
                      id="cmail"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnotes">Observações</Label>
                  <Textarea
                    id="cnotes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Preferências, alergias, histórico..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => create.mutate()}
                  disabled={!form.name.trim() || create.isPending}
                >
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar cliente pelo nome"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      {!filtered.length ? (
        <EmptyList text="Nenhum cliente encontrado." />
      ) : (
        <RuntimeProfiler id="ClientesTable">
          <CustomersTable
            customers={filtered}
            lastVisit={lastVisit}
            onRemove={(id) => remove.mutate(id)}
          />
        </RuntimeProfiler>
      )}

    </div>
  );
}


const CUSTOMER_ROW_HEIGHT = 49;
const CUSTOMER_VIRTUAL_THRESHOLD = 200;
const CUSTOMER_VIEWPORT_HEIGHT = 560;
const CUSTOMER_OVERSCAN = 8;

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
};

function CustomersTable({
  customers,
  lastVisit,
  onRemove,
}: {
  customers: CustomerRow[];
  lastVisit: Record<string, string>;
  onRemove: (id: string) => void;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const virtualized = customers.length > CUSTOMER_VIRTUAL_THRESHOLD;

  if (!virtualized) {
    return (
      <div className="surface overflow-hidden">
        <table className="w-full text-sm">
          <CustomerTableHead />
          <tbody>
            {customers.map((customer) => (
              <CustomerTableRow
                key={customer.id}
                customer={customer}
                lastVisit={lastVisit[customer.id]}
                onRemove={onRemove}
              />
            ))}
          </tbody>
        </table>
        <CustomerTableFooter count={customers.length} />
      </div>
    );
  }

  const visibleCount = Math.ceil(CUSTOMER_VIEWPORT_HEIGHT / CUSTOMER_ROW_HEIGHT);
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / CUSTOMER_ROW_HEIGHT) - CUSTOMER_OVERSCAN,
  );
  const endIndex = Math.min(
    customers.length,
    startIndex + visibleCount + CUSTOMER_OVERSCAN * 2,
  );
  const visible = customers.slice(startIndex, endIndex);

  return (
    <div className="surface overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(110px,.7fr)_52px] bg-muted/40 text-left text-xs uppercase text-muted-foreground">
        <div className="px-4 py-3">Nome</div>
        <div className="px-4 py-3">Telefone</div>
        <div className="px-4 py-3">Dias ausente</div>
        <div className="px-4 py-3" />
      </div>
      <div
        className="overflow-y-auto"
        style={{ height: CUSTOMER_VIEWPORT_HEIGHT }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div
          className="relative"
          style={{ height: customers.length * CUSTOMER_ROW_HEIGHT }}
        >
          {visible.map((customer, offset) => {
            const index = startIndex + offset;
            const last = lastVisit[customer.id];
            const days = last === undefined ? null : daysSince(last);
            return (
              <div
                key={customer.id}
                className="absolute left-0 right-0 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(110px,.7fr)_52px] items-center border-t border-border/60 text-sm"
                style={{
                  height: CUSTOMER_ROW_HEIGHT,
                  transform: `translateY(${index * CUSTOMER_ROW_HEIGHT}px)`,
                }}
              >
                <div className="truncate px-4 py-3 font-medium">{customer.name}</div>
                <div className="truncate px-4 py-3 text-primary">
                  {customer.phone ?? "—"}
                </div>
                <div className="px-4 py-3">{days === null ? "—" : `${days} dias`}</div>
                <div className="px-2 py-1 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(customer.id)}
                    aria-label={`Remover ${customer.name}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <CustomerTableFooter count={customers.length} />
    </div>
  );
}

function CustomerTableHead() {
  return (
    <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
      <tr>
        <th className="px-4 py-3">Nome</th>
        <th className="px-4 py-3">Telefone</th>
        <th className="px-4 py-3">Dias ausente</th>
        <th className="px-4 py-3" />
      </tr>
    </thead>
  );
}

function CustomerTableRow({
  customer,
  lastVisit,
  onRemove,
}: {
  customer: CustomerRow;
  lastVisit?: string;
  onRemove: (id: string) => void;
}) {
  const days = lastVisit === undefined ? null : daysSince(lastVisit);
  return (
    <tr className="border-t border-border/60">
      <td className="px-4 py-3 font-medium">{customer.name}</td>
      <td className="px-4 py-3 text-primary">{customer.phone ?? "—"}</td>
      <td className="px-4 py-3">{days === null ? "—" : `${days} dias`}</td>
      <td className="px-4 py-3 text-right">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(customer.id)}
          aria-label={`Remover ${customer.name}`}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </td>
    </tr>
  );
}

function CustomerTableFooter({ count }: { count: number }) {
  return (
    <p className="border-t border-border/60 px-4 py-3 text-center text-sm text-muted-foreground">
      Total de clientes: <span className="text-primary">{count}</span>
    </p>
  );
}
