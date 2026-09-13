import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
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

export const Route = createFileRoute("/_authenticated/painel/profissionais")({
  head: () => ({
    meta: [
      { title: "Profissionais — Agenda Aí" },
      { name: "description", content: "Gerencie a equipe que atende no seu negócio." },
      { property: "og:title", content: "Profissionais — Agenda Aí" },
      { property: "og:description", content: "Gerencie a equipe que atende no seu negócio." },
    ],
  }),
  component: ProfissionaisPage,
});

function ProfissionaisPage() {
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "" });

  const { data: people } = useQuery({
    queryKey: ["professionals", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*")
        .eq("business_id", businessId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["professionals", businessId] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("professionals")
        .insert({ business_id: businessId!, name: form.name, role: form.role || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profissional cadastrado!");
      setOpen(false);
      setForm({ name: "", role: "" });
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("professionals").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("professionals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profissional removido.");
      void invalidate();
    },
  });

  if (!businessId) return <NoBusiness />;

  return (
    <div>
      <PageHeader
        title="Profissionais"
        subtitle="Quem atende os clientes na sua agenda."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Novo profissional
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo profissional</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pname">Nome</Label>
                  <Input
                    id="pname"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ana Souza"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prole">Cargo / especialidade</Label>
                  <Input
                    id="prole"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="Barbeira, dentista, esteticista..."
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

      {!people?.length ? (
        <EmptyList text="Nenhum profissional cadastrado." />
      ) : (
        <ul className="space-y-3">
          {people.map((p) => (
            <li key={p.id} className="surface flex flex-wrap items-center gap-4 p-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-accent font-display font-bold text-accent-foreground">
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{p.name}</p>
                {p.role && <p className="text-sm text-muted-foreground">{p.role}</p>}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Ativo
                <Switch
                  checked={p.active}
                  onCheckedChange={(active) => toggle.mutate({ id: p.id, active })}
                />
              </label>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove.mutate(p.id)}
                aria-label={`Remover ${p.name}`}
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
