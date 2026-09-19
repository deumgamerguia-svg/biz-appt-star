import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarX2, Clock3, Plus, Repeat2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { WEEKDAYS, weekdayLabel, hhmm, toDateInput } from "@/lib/format";
import { NoBusiness } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

export const Route = createFileRoute("/_authenticated/painel/bloqueios")({
  head: () => ({
    meta: [
      { title: "Horários bloqueados — Agenda Agora" },
      { name: "description", content: "Bloqueie horários recorrentes ou de uma data específica." },
      { property: "og:title", content: "Horários bloqueados — Agenda Agora" },
      { property: "og:description", content: "Bloqueios recorrentes e específicos." },
    ],
  }),
  component: BloqueiosPage,
});

const initialForm = {
  recurring: true,
  weekday: "1",
  date: toDateInput(new Date()),
  starts: "09:00",
  ends: "09:30",
  reason: "",
};

function BloqueiosPage() {
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showRecurring, setShowRecurring] = useState(true);
  const [showSpecific, setShowSpecific] = useState(true);
  const [form, setForm] = useState(initialForm);

  const { data: blocks } = useQuery({
    queryKey: ["time_blocks", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_blocks")
        .select("*")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["time_blocks", businessId] });

  const close = () => {
    setOpen(false);
    setForm(initialForm);
  };

  const openCreate = () => {
    setForm(initialForm);
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("time_blocks").insert({
        business_id: businessId!,
        recurring: form.recurring,
        weekday: form.recurring ? Number(form.weekday) : null,
        block_date: form.recurring ? null : form.date,
        starts_at: form.starts,
        ends_at: form.ends,
        reason: form.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bloqueio cadastrado!");
      close();
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });

  if (!businessId) return <NoBusiness />;

  const filtered = (blocks ?? []).filter((block) =>
    block.recurring ? showRecurring : showSpecific,
  );

  return (
    <div className="bloqueios-premium mx-auto w-full max-w-5xl space-y-3">
      <section className="professional-list-panel">
        <div className="professional-segmented-header">
          <button type="button" className="is-active">
            Horários bloqueados
          </button>
          <button type="button" disabled>
            Indisponibilidades
          </button>
        </div>

        <div className="relative z-10 border-b border-[#25272d] px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="professional-icon-box !size-9">
                <CalendarX2 className="size-4" strokeWidth={1.8} />
              </div>
              <div>
                <h1 className="text-[0.98rem] font-semibold text-[#eef0f4]">
                  Horários bloqueados
                </h1>
                <p className="mt-0.5 text-xs text-[#62656e]">
                  Defina folgas, pausas e períodos que não podem receber agendamentos.
                </p>
              </div>
            </div>

            <Button className="professional-primary-button" onClick={openCreate}>
              <Plus className="size-4" />
              Cadastrar bloqueio
            </Button>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2 border-b border-[#22252b] px-4 py-3 sm:px-5">
          <label
            className={`bloqueio-filter-chip ${showRecurring ? "is-selected" : ""}`}
          >
            <Checkbox
              className="sr-only"
              checked={showRecurring}
              onCheckedChange={(value) => setShowRecurring(value === true)}
            />
            <Repeat2 className="size-3.5" />
            Recorrentes
          </label>

          <label
            className={`bloqueio-filter-chip ${showSpecific ? "is-selected" : ""}`}
          >
            <Checkbox
              className="sr-only"
              checked={showSpecific}
              onCheckedChange={(value) => setShowSpecific(value === true)}
            />
            <CalendarX2 className="size-3.5" />
            Específicos
          </label>
        </div>

        {!filtered.length ? (
          <div className="professional-empty-state">
            <div className="professional-icon-box !size-14">
              <CalendarX2 className="size-6" />
            </div>
            <h3>Nenhum horário bloqueado</h3>
            <p>
              Cadastre uma folga, pausa recorrente ou período específico para impedir novos agendamentos.
            </p>
            <Button className="professional-primary-button mt-5" onClick={openCreate}>
              <Plus className="size-4" />
              Criar primeiro bloqueio
            </Button>
          </div>
        ) : (
          <div className="relative z-10 divide-y divide-[#22252b]">
            {filtered.map((block) => (
              <div key={block.id} className="professional-person-row">
                <div className="professional-avatar">
                  {block.recurring ? (
                    <Repeat2 className="size-4" strokeWidth={1.8} />
                  ) : (
                    <CalendarX2 className="size-4" strokeWidth={1.8} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[#eef0f3]">
                      {block.recurring
                        ? weekdayLabel(block.weekday ?? 0)
                        : new Date(`${block.block_date}T00:00:00`).toLocaleDateString("pt-BR")}
                    </p>
                    <span className="professional-badge">
                      {block.recurring ? "Recorrente" : "Específico"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#686b74]">
                    {hhmm(block.starts_at)} até {hhmm(block.ends_at)}
                    {block.reason ? ` · ${block.reason}` : ""}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="professional-icon-action hover:!text-red-400"
                  onClick={() => remove.mutate(block.id)}
                  aria-label="Remover bloqueio"
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
          if (!value) setForm(initialForm);
        }}
      >
        <DialogContent className="professional-dialog max-w-xl overflow-y-auto p-0">
          <DialogHeader className="professional-dialog-header">
            <div className="flex items-start gap-3 text-left">
              <div className="professional-dialog-icon">
                <CalendarX2 className="size-[1.05rem]" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[#f1f2f4]">
                  Adicionar bloqueio
                </DialogTitle>
                <p className="mt-1 text-xs leading-relaxed text-[#686b74]">
                  Escolha se o bloqueio se repete semanalmente ou acontece em uma data específica.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="professional-dialog-body px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="professional-form-section mt-4 space-y-5">
              <div>
                <Label className="professional-section-label">Tipo de bloqueio</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, recurring: true })}
                    className={`bloqueio-type-option ${form.recurring ? "is-selected" : ""}`}
                  >
                    <Repeat2 className="size-4" />
                    Semanal
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, recurring: false })}
                    className={`bloqueio-type-option ${!form.recurring ? "is-selected" : ""}`}
                  >
                    <CalendarX2 className="size-4" />
                    Data específica
                  </button>
                </div>
              </div>

              {form.recurring ? (
                <div className="space-y-2">
                  <Label className="professional-section-label">Dia da semana</Label>
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
              ) : (
                <div className="space-y-2">
                  <Label className="professional-section-label" htmlFor="bdate">
                    Data específica
                  </Label>
                  <Input
                    id="bdate"
                    className="professional-input"
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm({ ...form, date: event.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="professional-section-label" htmlFor="bstart">
                    Começo
                  </Label>
                  <Input
                    id="bstart"
                    className="professional-input"
                    type="time"
                    value={form.starts}
                    onChange={(event) => setForm({ ...form, starts: event.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="professional-section-label" htmlFor="bend">
                    Fim
                  </Label>
                  <Input
                    id="bend"
                    className="professional-input"
                    type="time"
                    value={form.ends}
                    onChange={(event) => setForm({ ...form, ends: event.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="professional-section-label" htmlFor="breason">
                  Motivo (opcional)
                </Label>
                <Input
                  id="breason"
                  className="professional-input"
                  value={form.reason}
                  onChange={(event) => setForm({ ...form, reason: event.target.value })}
                  placeholder="Almoço, compromisso pessoal..."
                />
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
              onClick={() => create.mutate()}
              disabled={create.isPending}
            >
              {create.isPending ? "Salvando..." : "Criar bloqueio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
