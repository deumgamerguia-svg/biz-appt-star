import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, Trash2, Plus, ExternalLink } from "lucide-react";
import {
  claimMaster,
  createBusinessWithOwner,
  deleteBusiness,
  getMasterStatus,
  listAllBusinesses,
} from "@/lib/admin.functions";
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
      { title: "Painel master — Agendaê" },
      {
        name: "description",
        content: "Área da plataforma para cadastrar estabelecimentos e criar o acesso dos donos.",
      },
      { property: "og:title", content: "Painel master — Agendaê" },
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
  const statusFn = useServerFn(getMasterStatus);
  const listFn = useServerFn(listAllBusinesses);
  const claimFn = useServerFn(claimMaster);
  const createFn = useServerFn(createBusinessWithOwner);
  const deleteFn = useServerFn(deleteBusiness);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const status = useQuery({ queryKey: ["master-status"], queryFn: () => statusFn() });

  const businesses = useQuery({
    queryKey: ["master-businesses"],
    enabled: !!status.data?.isMaster,
    queryFn: () => listFn(),
  });

  const claim = useMutation({
    mutationFn: () => claimFn(),
    onSuccess: () => {
      toast.success("Você agora é o master da plataforma.");
      void queryClient.invalidateQueries({ queryKey: ["master-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: () => {
      toast.success("Estabelecimento e acesso do dono criados!");
      setOpen(false);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["master-businesses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Estabelecimento removido.");
      void queryClient.invalidateQueries({ queryKey: ["master-businesses"] });
    },
    onError: () =>
      toast.error("Não foi possível remover: existem agendamentos vinculados a este negócio."),
  });

  if (status.isLoading) {
    return <p className="p-8 text-sm text-muted-foreground">Carregando...</p>;
  }

  if (!status.data?.isMaster) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <ShieldCheck className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 text-xl font-bold">Painel master</h1>
        {status.data?.hasMaster ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Esta área é restrita ao responsável pela plataforma.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Ninguém assumiu esta área ainda. Assuma agora com a sua conta.
            </p>
            <Button className="mt-4" onClick={() => claim.mutate()} disabled={claim.isPending}>
              Assumir o painel master
            </Button>
          </>
        )}
        <Link to="/painel" className="mt-6 block text-sm text-primary hover:underline">
          Voltar ao painel
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
            Cadastre estabelecimentos e gere o acesso de cada dono.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link to="/painel">
            <Button variant="secondary">Meu painel</Button>
          </Link>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Novo estabelecimento
          </Button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Estabelecimento</th>
              <th className="px-4 py-3">Dono</th>
              <th className="px-4 py-3">Agendamentos</th>
              <th className="px-4 py-3">Link do cliente</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">
                  {b.name}
                  <span className="block text-xs text-muted-foreground">{b.category}</span>
                </td>
                <td className="px-4 py-3">
                  {b.owner_name ?? "—"}
                  <span className="block text-xs text-muted-foreground">
                    {b.phone ? formatPhone(b.phone) : "—"}
                  </span>
                </td>
                <td className="px-4 py-3">{b.appointments}</td>
                <td className="px-4 py-3">
                  <a
                    href={`/agendar/${b.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    /agendar/{b.slug} <ExternalLink className="size-3" />
                  </a>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${b.name}`}
                    onClick={() => remove.mutate(b.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum estabelecimento cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo estabelecimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bname">Nome do estabelecimento</Label>
              <Input
                id="bname"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                placeholder="Ex.: Barbearia do João"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bcat">Segmento</Label>
              <Input
                id="bcat"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Ex.: barbearia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oname">Nome do dono</Label>
              <Input
                id="oname"
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                placeholder="Ex.: João da Silva"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ophone">Telefone de acesso</Label>
                <Input
                  id="ophone"
                  inputMode="numeric"
                  value={formatPhone(form.phone)}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 93935-4416"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opass">Senha de acesso</Label>
                <Input
                  id="opass"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Ex.: 1237"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Todos que trabalham no estabelecimento entram com este telefone e esta senha.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => create.mutate()}
              disabled={
                create.isPending ||
                form.businessName.trim().length < 2 ||
                form.ownerName.trim().length < 2 ||
                form.phone.replace(/\D/g, "").length < 10 ||
                form.password.length < 4
              }
            >
              Criar acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
