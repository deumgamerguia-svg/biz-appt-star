import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { formatPrice } from "@/lib/format";
import { PageHeader, NoBusiness, EmptyList } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/painel/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — Agenda Aí" },
      { name: "description", content: "Cadastre serviços com duração e preço." },
      { property: "og:title", content: "Serviços — Agenda Aí" },
      { property: "og:description", content: "Cadastre serviços com duração e preço." },
    ],
  }),
  component: ServicosPage,
});

function ServicosPage() {
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", duration: "30", price: "0", deposit: "0", description: "" });

  const { data: services } = useQuery({
    queryKey: ["services", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("business_id", businessId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["services", businessId] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("services").insert({
        business_id: businessId!,
        name: form.name,
        duration_minutes: Number(form.duration) || 30,
        price_cents: Math.round(Number(form.price.replace(",", ".")) * 100) || 0,
        deposit_cents: Math.round(Number(form.deposit.replace(",", ".")) * 100) || 0,
        description: form.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço cadastrado!");
      setOpen(false);
      setForm({ name: "", duration: "30", price: "0", deposit: "0", description: "" });
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("services").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço removido.");
      void invalidate();
    },
  });

  if (!businessId) return <NoBusiness />;

  return (
    <div>
      <PageHeader
        title="Serviços"
        subtitle="Duração e preço definem os horários da agenda."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Novo serviço
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo serviço</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sname">Nome</Label>
                  <Input
                    id="sname"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Corte masculino"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sdur">Duração (min)</Label>
                    <Input
                      id="sdur"
                      type="number"
                      min={5}
                      step={5}
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sprice">Preço (R$)</Label>
                    <Input
                      id="sprice"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      placeholder="45,00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sdep">Sinal para agendar (R$)</Label>
                  <Input
                    id="sdep"
                    value={form.deposit}
                    onChange={(e) => setForm({ ...form, deposit: e.target.value })}
                    placeholder="10,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sdesc">Descrição para o cliente</Label>
                  <Input
                    id="sdesc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Srs clientes, caso o cliente atrase..."
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
        }
      />

      {!services?.length ? (
        <EmptyList text="Nenhum serviço cadastrado." />
      ) : (
        <ul className="space-y-3">
          {services.map((s) => (
            <li key={s.id} className="surface flex flex-wrap items-center gap-4 p-4">
              <div className="flex-1">
                <p className="font-semibold">{s.name}</p>
                <p className="text-sm text-muted-foreground">
                  {s.duration_minutes} min · {formatPrice(s.price_cents)}
                  {s.deposit_cents > 0 && ` · sinal ${formatPrice(s.deposit_cents)}`}
                </p>
                {s.description && (
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{s.description}</p>
                )}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Ativo
                <Switch
                  checked={s.active}
                  onCheckedChange={(active) => toggle.mutate({ id: s.id, active })}
                />
              </label>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove.mutate(s.id)}
                aria-label={`Remover ${s.name}`}
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
