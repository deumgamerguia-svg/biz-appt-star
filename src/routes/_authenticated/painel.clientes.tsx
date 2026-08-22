import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
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
      { title: "Clientes — Agendaê" },
      { name: "description", content: "Cadastro de clientes com contato e observações." },
      { property: "og:title", content: "Clientes — Agendaê" },
      { property: "og:description", content: "Cadastro de clientes com contato e observações." },
    ],
  }),
  component: ClientesPage,
});

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

  const filtered = (customers ?? []).filter((c) =>
    c.name.toLowerCase().includes(term.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Histórico e contato de quem atende com você."
        action={
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
        <ul className="space-y-3">
          {filtered.map((c) => (
            <li key={c.id} className="surface flex flex-wrap items-center gap-4 p-4">
              <div className="flex-1">
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-muted-foreground">
                  {[c.phone, c.email].filter(Boolean).join(" · ") || "Sem contato cadastrado"}
                </p>
                {c.notes && <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove.mutate(c.id)}
                aria-label={`Remover ${c.name}`}
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
