import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { CATEGORIES, categoryLabel, slugify } from "@/lib/format";
import { PageHeader, EmptyList } from "@/components/painel/PageHeader";
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

export const Route = createFileRoute("/_authenticated/painel/negocios")({
  head: () => ({
    meta: [
      { title: "Negócios — Agenda Agora" },
      { name: "description", content: "Cadastre e gerencie as unidades do seu negócio." },
      { property: "og:title", content: "Negócios — Agenda Agora" },
      { property: "og:description", content: "Cadastre e gerencie as unidades do seu negócio." },
    ],
  }),
  component: NegociosPage,
});

function NegociosPage() {
  const { businesses, setBusinessId, refresh } = useBusiness();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "barbearia", phone: "", address: "" });

  const createBusiness = useMutation({
    mutationFn: async () => {
      const slug = `${slugify(form.name)}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error } = await supabase
        .from("businesses")
        .insert({
          name: form.name,
          slug,
          category: form.category,
          phone: form.phone || null,
          address: form.address || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Negócio criado!");
      setOpen(false);
      setForm({ name: "", category: "barbearia", phone: "", address: "" });
      refresh();
      if (data?.id) setBusinessId(data.id);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeBusiness = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("businesses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Negócio removido.");
      refresh();
      void queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div>
      <PageHeader
        title="Negócios"
        subtitle="Cada negócio tem agenda, serviços e clientes próprios."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Novo negócio
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo negócio</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bname">Nome</Label>
                  <Input
                    id="bname"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Barbearia do Zé"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bphone">Telefone</Label>
                  <Input
                    id="bphone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(11) 90000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baddr">Endereço</Label>
                  <Input
                    id="baddr"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Rua Exemplo, 123"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createBusiness.mutate()}
                  disabled={!form.name.trim() || createBusiness.isPending}
                >
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {businesses.length === 0 ? (
        <EmptyList text="Nenhum negócio cadastrado ainda." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {businesses.map((b) => (
            <article key={b.id} className="surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">{b.name}</h2>
                  <p className="text-xs text-muted-foreground">{categoryLabel(b.category)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeBusiness.mutate(b.id)}
                  aria-label={`Remover ${b.name}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              <dl className="mt-4 space-y-1 text-sm text-muted-foreground">
                {b.phone && <dd>{b.phone}</dd>}
                {b.address && <dd>{b.address}</dd>}
                <dd className="text-xs">Link público: /{b.slug}</dd>
              </dl>
              <Button variant="outline" className="mt-4" onClick={() => setBusinessId(b.id)}>
                Selecionar
              </Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
