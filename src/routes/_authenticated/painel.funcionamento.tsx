import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Clock3, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { WEEKDAYS, weekdayLabel, hhmm } from "@/lib/format";
import { NoBusiness } from "@/components/painel/PageHeader";
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

  const openCreate = () => {
    setEditingDay(null);
    setForm(initialForm);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("Estabelecimento não selecionado.");
      if (!form.starts || !form.ends || form.starts >= form.ends) {
        throw new Error("O horário final precisa ser depois do horário inicial.");
      }

      const weekday = Number(form.weekday);

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
    onError: (error: Error) => toast.error(error.message),
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
    onError: (error: Error) => toast.error(error.message),
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
    <div className="funcionamento-premium mx-auto w-full max-w-5xl space-y-3">
      <section className="professional-list-panel">
        <div className="professional-segmented-header">
          <button type="button" className="is-active">
            Funcionamento
          </button>
          <button type="button" disabled>
            Horários
          </button>
        </div>

        <div className="relative z-10 border-b border-[#25272d] px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="professional-icon-box !size-9">
                <Clock3 className="size-4" strokeWidth={1.8} />
              </div>
              <div>
                <h1 className="text-[0.98rem] font-semibold text-[#eef0f4]">
                  Horários de funcionamento
                </h1>
                <p className="mt-0.5 text-xs text-[#62656e]">
                  Configure os dias e horários disponíveis para atendimento.
                </p>
              </div>
            </div>

            <Button className="professional-primary-button" onClick={openCreate}>
              <Plus className="size-4" />
              Cadastrar horário
            </Button>
          </div>
        </div>

        {!hours?.length ? (
          <div className="professional-empty-state">
            <div className="professional-icon-box !size-14">
              <Clock3 className="size-6" />
            </div>
            <h3>Nenhum horário cadastrado</h3>
            <p>
              Adicione os dias e horários de atendimento para controlar a disponibilidade da agenda.
            </p>
            <Button className="professional-primary-button mt-5" onClick={openCreate}>
              <Plus className="size-4" />
              Criar primeiro horário
            </Button>
          </div>
        ) : (
          <div className="relative z-10 divide-y divide-[#22252b]">
            {hours.map((hour) => (
              <div key={hour.id} className="professional-person-row">
                <div className="professional-avatar">
                  <CalendarDays className="size-4" strokeWidth={1.8} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#eef0f3]">
                    {weekdayLabel(hour.weekday)}
                  </p>
                  <p className="mt-1 text-xs text-[#686b74]">
                    {hhmm(hour.starts_at)} até {hhmm(hour.ends_at)}
                  </p>
                </div>

                <span className="professional-badge">Atendimento</span>

                <Button
                  variant="ghost"
                  size="icon"
                  className="professional-icon-action"
                  onClick={() => edit(hour)}
                  aria-label={`Editar ${weekdayLabel(hour.weekday)}`}
                >
                  <Pencil className="size-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="professional-icon-action hover:!text-red-400"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remover o funcionamento de ${weekdayLabel(hour.weekday)}?`,
                      )
                    ) {
                      remove.mutate(hour.id);
                    }
                  }}
                  aria-label={`Remover ${weekdayLabel(hour.weekday)}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

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
        <DialogContent className="professional-dialog max-w-xl overflow-y-auto p-0">
          <DialogHeader className="professional-dialog-header">
            <div className="flex items-start gap-3 text-left">
              <div className="professional-dialog-icon">
                <Clock3 className="size-[1.05rem]" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[#f1f2f4]">
                  {editingDay === null ? "Adicionar funcionamento" : "Editar funcionamento"}
                </DialogTitle>
                <p className="mt-1 text-xs leading-relaxed text-[#686b74]">
                  Defina o dia, horário de início e horário de encerramento.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="professional-dialog-body px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="professional-form-section mt-4 space-y-5">
              <div className="space-y-2">
                <Label className="professional-section-label">Dia</Label>
                <Select
                  value={form.weekday}
                  onValueChange={(weekday) => setForm({ ...form, weekday })}
                >
                  <SelectTrigger className="professional-input w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="professional-section-label" htmlFor="hstart">
                    Começo
                  </Label>
                  <Input
                    id="hstart"
                    className="professional-input"
                    type="time"
                    value={form.starts}
                    onChange={(event) => setForm({ ...form, starts: event.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="professional-section-label" htmlFor="hend">
                    Fim
                  </Label>
                  <Input
                    id="hend"
                    className="professional-input"
                    type="time"
                    value={form.ends}
                    onChange={(event) => setForm({ ...form, ends: event.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="professional-dialog-footer">
            <Button
              variant="outline"
              className="professional-secondary-button"
              onClick={close}
            >
              Cancelar
            </Button>
            <Button
              className="professional-primary-button"
              onClick={() => save.mutate()}
              disabled={
                save.isPending ||
                !form.starts ||
                !form.ends ||
                form.starts >= form.ends
              }
            >
              {save.isPending
                ? "Salvando..."
                : editingDay === null
                  ? "Criar horário"
                  : "Salvar alteração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
