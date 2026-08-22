import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import {
  STATUSES,
  statusLabel,
  formatTime,
  formatDateLong,
  toDateInput,
  localToIso,
  addMinutesIso,
  formatPrice,
} from "@/lib/format";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/painel/")({
  head: () => ({
    meta: [
      { title: "Agenda do dia — Agendaê" },
      { name: "description", content: "Veja e gerencie os agendamentos do dia do seu negócio." },
      { property: "og:title", content: "Agenda do dia — Agendaê" },
      { property: "og:description", content: "Veja e gerencie os agendamentos do dia." },
    ],
  }),
  component: AgendaPage,
});

const statusStyles: Record<string, string> = {
  agendado: "bg-accent text-accent-foreground",
  confirmado: "bg-primary/10 text-primary",
  concluido: "bg-success/15 text-success",
  cancelado: "bg-destructive/10 text-destructive",
};

function AgendaPage() {
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();
  const [day, setDay] = useState(() => toDateInput(new Date()));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    service_id: "",
    professional_id: "",
    time: "09:00",
    notes: "",
  });

  const { data: services } = useQuery({
    queryKey: ["services", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("business_id", businessId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: professionals } = useQuery({
    queryKey: ["professionals", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*")
        .eq("business_id", businessId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["appointments", businessId, day],
    enabled: !!businessId,
    queryFn: async () => {
      const start = new Date(`${day}T00:00:00`).toISOString();
      const end = new Date(`${day}T23:59:59`).toISOString();
      const { data, error } = await supabase
        .from("appointments")
        .select("*, services(name, price_cents), professionals(name)")
        .eq("business_id", businessId!)
        .gte("starts_at", start)
        .lte("starts_at", end)
        .order("starts_at");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["appointments", businessId, day] });

  const create = useMutation({
    mutationFn: async () => {
      const service = services?.find((s) => s.id === form.service_id);
      const startsAt = localToIso(day, form.time);
      const { error } = await supabase.from("appointments").insert({
        business_id: businessId!,
        service_id: form.service_id || null,
        professional_id: form.professional_id || null,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || null,
        starts_at: startsAt,
        ends_at: addMinutesIso(startsAt, service?.duration_minutes ?? 30),
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento criado!");
      setOpen(false);
      setForm({
        customer_name: "",
        customer_phone: "",
        service_id: "",
        professional_id: "",
        time: "09:00",
        notes: "",
      });
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento removido.");
      void invalidate();
    },
  });

  if (!businessId) return <NoBusiness />;

  const shiftDay = (delta: number) => {
    const next = new Date(`${day}T12:00:00`);
    next.setDate(next.getDate() + delta);
    setDay(toDateInput(next));
  };

  const total = (appointments ?? []).reduce(
    (sum, a) =>
      a.status !== "cancelado"
        ? sum + ((a.services as { price_cents: number } | null)?.price_cents ?? 0)
        : sum,
    0,
  );

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle={formatDateLong(new Date(`${day}T12:00:00`))}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Novo agendamento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo agendamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="aname">Cliente</Label>
                    <Input
                      id="aname"
                      value={form.customer_name}
                      onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aphone">Telefone</Label>
                    <Input
                      id="aphone"
                      value={form.customer_phone}
                      onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Serviço</Label>
                  <Select
                    value={form.service_id}
                    onValueChange={(v) => setForm({ ...form, service_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {(services ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} · {s.duration_minutes} min
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Profissional</Label>
                    <Select
                      value={form.professional_id}
                      onValueChange={(v) => setForm({ ...form, professional_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Qualquer um" />
                      </SelectTrigger>
                      <SelectContent>
                        {(professionals ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="atime">Horário</Label>
                    <Input
                      id="atime"
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="anotes">Observações</Label>
                  <Textarea
                    id="anotes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => create.mutate()}
                  disabled={!form.customer_name.trim() || create.isPending}
                >
                  Agendar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="surface mb-6 flex flex-wrap items-center gap-3 p-4">
        <Button variant="outline" size="icon" onClick={() => shiftDay(-1)} aria-label="Dia anterior">
          <ChevronLeft className="size-4" />
        </Button>
        <Input
          type="date"
          className="w-auto"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
        <Button variant="outline" size="icon" onClick={() => shiftDay(1)} aria-label="Próximo dia">
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="ghost" onClick={() => setDay(toDateInput(new Date()))}>
          Hoje
        </Button>
        <span className="ml-auto text-sm text-muted-foreground">
          {(appointments ?? []).length} agendamento(s) · {formatPrice(total)}
        </span>
      </div>

      {isLoading ? (
        <EmptyList text="Carregando agenda..." />
      ) : !appointments?.length ? (
        <EmptyList text="Nenhum agendamento para este dia." />
      ) : (
        <ul className="space-y-3">
          {appointments.map((a) => (
            <li key={a.id} className="surface flex flex-wrap items-center gap-4 p-4">
              <div className="font-display text-lg font-bold">{formatTime(a.starts_at)}</div>
              <div className="min-w-40 flex-1">
                <p className="font-semibold">{a.customer_name}</p>
                <p className="text-sm text-muted-foreground">
                  {(a.services as { name: string } | null)?.name ?? "Serviço não definido"}
                  {(a.professionals as { name: string } | null)?.name
                    ? ` · ${(a.professionals as { name: string }).name}`
                    : ""}
                </p>
                {a.customer_phone && (
                  <p className="text-xs text-muted-foreground">{a.customer_phone}</p>
                )}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[a.status] ?? "bg-muted"}`}
              >
                {statusLabel(a.status)}
              </span>
              <Select
                value={a.status}
                onValueChange={(status) => setStatus.mutate({ id: a.id, status })}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove.mutate(a.id)}
                aria-label="Remover agendamento"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
