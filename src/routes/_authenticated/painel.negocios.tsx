import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Copy, ExternalLink, Save, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness, type Business } from "@/lib/business";
import { categoryLabel } from "@/lib/format";
import { PageHeader, EmptyList } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/painel/negocios")({
  head: () => ({
    meta: [
      { title: "Negócio — Agenda Agora" },
      { name: "description", content: "Configure as informações exibidas na página pública do estabelecimento." },
    ],
  }),
  component: NegociosPage,
});

const sanitizeSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

function NegociosPage() {
  const { businesses, refresh } = useBusiness();

  return (
    <div>
      <PageHeader
        title="Negócio"
        subtitle="Controle as informações e o link que aparecem no Painel 1 do cliente."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><Link to="/painel/servicos">Serviços</Link></Button>
            <Button variant="outline" asChild><Link to="/painel/profissionais">Profissionais</Link></Button>
            <Button variant="outline" asChild><Link to="/painel/funcionamento">Funcionamento</Link></Button>
            <Button variant="outline" asChild><Link to="/painel/configuracoes" search={{ secao: "aparencia" }}>Visual do Painel 1</Link></Button>
          </div>
        }
      />

      {businesses.length === 0 ? (
        <EmptyList text="Seu acesso ainda não foi vinculado a um estabelecimento pelo Painel 3 / Master." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {businesses.map((business) => (
            <BusinessSettingsCard key={business.id} business={business} onSaved={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function BusinessSettingsCard({ business, onSaved }: { business: Business; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: business.name,
    slug: business.slug,
    category: business.category,
    phone: business.phone ?? "",
    address: business.address ?? "",
  });

  useEffect(() => {
    setForm({
      name: business.name,
      slug: business.slug,
      category: business.category,
      phone: business.phone ?? "",
      address: business.address ?? "",
    });
  }, [business.id, business.name, business.slug, business.category, business.phone, business.address]);

  const save = useMutation({
    mutationFn: async () => {
      const slug = sanitizeSlug(form.slug);
      if (slug.length < 3) throw new Error("O link público precisa ter pelo menos 3 caracteres.");
      const { error } = await supabase
        .from("businesses")
        .update({
          name: form.name.trim(),
          slug,
          category: form.category.trim() || "outro",
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
        })
        .eq("id", business.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Informações do Painel 1 atualizadas.");
      onSaved();
    },
    onError: (error: Error) => {
      if (/duplicate|unique/i.test(error.message)) {
        toast.error("Esse link público já está sendo usado por outro estabelecimento.");
      } else {
        toast.error(error.message);
      }
    },
  });

  const copyPublicLink = async () => {
    const path = `/agendar/${business.slug}`;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      toast.success("Link do Painel 1 copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <article className="surface p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Store className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold">{business.name}</h2>
          <p className="text-xs text-muted-foreground">{categoryLabel(business.category)}</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`business-name-${business.id}`}>Nome exibido no Painel 1</Label>
          <Input id={`business-name-${business.id}`} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`business-slug-${business.id}`}>Link público editável</Label>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">/agendar/</span>
            <Input
              id={`business-slug-${business.id}`}
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: sanitizeSlug(event.target.value) }))}
              placeholder="meu-estabelecimento"
            />
          </div>
          <p className="text-xs text-muted-foreground">Ao alterar e salvar, o link antigo deixa de ser o endereço principal.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`business-category-${business.id}`}>Categoria</Label>
          <Input id={`business-category-${business.id}`} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`business-phone-${business.id}`}>Telefone</Label>
            <Input id={`business-phone-${business.id}`} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`business-address-${business.id}`}>Endereço</Label>
            <Input id={`business-address-${business.id}`} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim() || sanitizeSlug(form.slug).length < 3}>
          <Save className="size-4" /> {save.isPending ? "Salvando..." : "Salvar"}
        </Button>
        <Button variant="outline" asChild>
          <a href={`/agendar/${business.slug}`} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" /> Abrir Painel 1
          </a>
        </Button>
        <Button variant="outline" onClick={() => void copyPublicLink()}>
          <Copy className="size-4" /> Copiar link
        </Button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">Link atual: /agendar/{business.slug}</p>
    </article>
  );
}
