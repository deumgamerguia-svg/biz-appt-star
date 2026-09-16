import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { WEEKDAYS, weekdayLabel, hhmm } from "@/lib/format";
import { PageHeader, NoBusiness, EmptyList } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/_authenticated/painel/funcionamento")({
  head: () => ({
    meta: [
      { title: "Funcionamento — Agenda Agora" },
      { name: "description", content: "Dias e horários fixos de atendimento do seu negócio." },
      { property: "og:title", content: "Funcionamento — Agenda Agora" },
      { property: "og:description", content: "Dias e horários fixos de atendimento." },
    ],
  }),
  component: FuncionamentoPage,
});

const initialForm = { weekday: "1", starts: "08:30", ends: "19:00" };

function FuncionamentoPage() {
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editingDay, setEditingDay] = useState<number | null>(null);

  const { data: hours } = useQuery({
    queryKey: ["business_hours", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("*")
        .eq("business_id", businessId!)
        .order("weekday");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["business_hours", businessId] });

  const close = () => {
    setOpen(false);
    setEditingDay(null);
    setForm(initialForm);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("Estabelecimento não selecionado.");
      if (!form.starts || !form.ends || form.starts >= form.ends) {
        throw new Error("O horário final precisa ser depois do horário inicial.");
      }
      const weekday = Number(form.weekday);

      // Se o dia foi trocado durante uma edição, remove a configuração antiga
      // antes do upsert para manter exatamente um expediente por dia.
      if (editingDay !== null && editingDay !== weekday) {
        const removed = await supabase
          .from("business_hours")
          .delete()
          .eq("business_id", businessId)
          .eq("weekday", editingDay);
        if (removed.error) throw removed.error;
      }

      const { error } = await supabase.from("business_hours").upsert(
        {
          business_id: businessId,
          weekday,
          starts_at: form.starts,
          ends_at: form.ends,
        },
        { onConflict: "business_id,weekday" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editingDay === null ? "Horário cadastrado!" : "Horário atualizado!");
      close();
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("business_hours")
        .delete()
        .eq("id", id)
        .eq("business_id", businessId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dia removido do atendimento.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const edit = (hour: NonNullable<typeof hours>[number]) => {
    setEditingDay(hour.weekday);
    setForm({
      weekday: String(hour.weekday),
      starts: hhmm(hour.starts_at),
      ends: hhmm(hour.ends_at),
    });
    setOpen(true);
  };

  if (!businessId) return <NoBusiness />;

  return (
    <div>
      <PageHeader
        title="Funcionamento"
        subtitle="Dias e horários que controlam diretamente as datas disponíveis no Painel 1."
        action={
          <Dialog
            open={open}
            onOpenChange={(value) => {
              setOpen(value);
              if (!value) {
                setEditingDay(null);
                setForm(initialForm);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingDay(null); setForm(initialForm); }}>
                <Plus className="size-4" /> Cadastrar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingDay === null ? "Cadastrar funcionamento" : "Editar funcionamento"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Dia</Label>
                  <Select value={form.weekday} onValueChange={(weekday) => setForm({ ...form, weekday })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((day) => (
                        <SelectItem key={day.value} value={String(day.value)}>{day.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hstart">Começo</Label>
                    <Input id="hstart" type="time" value={form.starts} onChange={(e) => setForm({ ...form, starts: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hend">Fim</Label>
                    <Input id="hend" type="time" value={form.ends} onChange={(e) => setForm({ ...form, ends: e.target.value })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => save.mutate()} disabled={save.isPending || !form.starts || !form.ends || form.starts >= form.ends}>
                  {save.isPending ? "Salvando..." : editingDay === null ? "Cadastrar" : "Salvar alteração"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {!hours?.length ? (
        <EmptyList text="Nenhum dia de funcionamento cadastrado." />
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-3">Dia</th><th className="px-4 py-3">Começo</th><th className="px-4 py-3">Fim</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody>
              {hours.map((hour) => (
                <tr key={hour.id} className="border-t border-border/60">
                  <td className="px-4 py-3 font-medium">{weekdayLabel(hour.weekday)}</td>
                  <td className="px-4 py-3">{hhmm(hour.starts_at)}</td>
                  <td className="px-4 py-3">{hhmm(hour.ends_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => edit(hour)} aria-label={`Editar ${weekdayLabel(hour.weekday)}`}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (window.confirm(`Remover o funcionamento de ${weekdayLabel(hour.weekday)}?`)) remove.mutate(hour.id);
                    }} aria-label={`Remover ${weekdayLabel(hour.weekday)}`}><Trash2 className="size-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
