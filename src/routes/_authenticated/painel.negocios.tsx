import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import {
  Clock3,
  Copy,
  ExternalLink,
  Link2,
  Paintbrush,
  Save,
  Scissors,
  Store,
  UsersRound,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness, type Business } from "@/lib/business";
import { categoryLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/painel/negocios")({
  head: () => ({
    meta: [
      { title: "Negócio — Agenda Agora" },
      {
        name: "description",
        content: "Configure as informações exibidas na página pública do estabelecimento.",
      },
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
    <div className="negocios-premium mx-auto w-full max-w-5xl space-y-3">
      <section className="professional-list-panel">
        <div className="professional-segmented-header">
          <button type="button" className="is-active">
            Negócio
          </button>
          <button type="button" disabled>
            Painel 1
          </button>
        </div>

        <div className="relative z-10 border-b border-[#25272d] px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="professional-icon-box !size-9">
                <Store className="size-4" strokeWidth={1.8} />
              </div>
              <div>
                <h1 className="text-[0.98rem] font-semibold text-[#eef0f4]">
                  Configuração do negócio
                </h1>
                <p className="mt-0.5 text-xs text-[#62656e]">
                  Controle as informações e o link exibidos no Painel 1.
                </p>
              </div>
            </div>

            <Button className="professional-primary-button" asChild>
              <Link to="/painel/configuracoes" search={{ secao: "aparencia" }}>
                <Paintbrush className="size-4" />
                Visual do Painel 1
              </Link>
            </Button>
          </div>
        </div>

        {businesses.length === 0 ? (
          <div className="professional-empty-state">
            <div className="professional-icon-box !size-14">
              <Store className="size-6" />
            </div>
            <h3>Nenhum negócio vinculado</h3>
            <p>Seu acesso ainda não foi vinculado a um estabelecimento pelo Painel 3 / Master.</p>
          </div>
        ) : (
          <div className="relative z-10 p-4 sm:p-5">
            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                className="professional-secondary-button w-full justify-start"
                variant="outline"
                asChild
              >
                <Link to="/painel/servicos">
                  <Scissors className="size-4" />
                  Serviços
                </Link>
              </Button>
              <Button
                className="professional-secondary-button w-full justify-start"
                variant="outline"
                asChild
              >
                <Link to="/painel/profissionais">
                  <UsersRound className="size-4" />
                  Profissionais
                </Link>
              </Button>
              <Button
                className="professional-secondary-button w-full justify-start"
                variant="outline"
                asChild
              >
                <Link to="/painel/funcionamento">
                  <Clock3 className="size-4" />
                  Funcionamento
                </Link>
              </Button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {businesses.map((business) => (
                <BusinessSettingsCard key={business.id} business={business} onSaved={refresh} />
              ))}
            </div>
          </div>
        )}
      </section>
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
  }, [
    business.id,
    business.name,
    business.slug,
    business.category,
    business.phone,
    business.address,
  ]);

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
    <article className="professional-form-section">
      <div className="flex items-start gap-3">
        <div className="professional-avatar">
          <Store className="size-4" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-[#eef0f3]">{business.name}</h2>
          <span className="professional-badge mt-1.5">{categoryLabel(business.category)}</span>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label className="professional-section-label" htmlFor={`business-name-${business.id}`}>
            Nome exibido no Painel 1
          </Label>
          <Input
            className="professional-input"
            id={`business-name-${business.id}`}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label className="professional-section-label" htmlFor={`business-slug-${business.id}`}>
            Link público editável
          </Label>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-[#646771]">/agendar/</span>
            <Input
              className="professional-input"
              id={`business-slug-${business.id}`}
              value={form.slug}
              onChange={(event) =>
                setForm((current) => ({ ...current, slug: sanitizeSlug(event.target.value) }))
              }
              placeholder="meu-estabelecimento"
            />
          </div>
          <p className="text-xs leading-relaxed text-[#5f626b]">
            Ao alterar e salvar, o link antigo deixa de ser o endereço principal.
          </p>
        </div>

        <div className="space-y-2">
          <Label
            className="professional-section-label"
            htmlFor={`business-category-${business.id}`}
          >
            Categoria
          </Label>
          <Input
            className="professional-input"
            id={`business-category-${business.id}`}
            value={form.category}
            onChange={(event) =>
              setForm((current) => ({ ...current, category: event.target.value }))
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="professional-section-label" htmlFor={`business-phone-${business.id}`}>
              Telefone
            </Label>
            <Input
              className="professional-input"
              id={`business-phone-${business.id}`}
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label
              className="professional-section-label"
              htmlFor={`business-address-${business.id}`}
            >
              Endereço
            </Label>
            <Input
              className="professional-input"
              id={`business-address-${business.id}`}
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: event.target.value }))
              }
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          className="professional-primary-button"
          onClick={() => save.mutate()}
          disabled={save.isPending || !form.name.trim() || sanitizeSlug(form.slug).length < 3}
        >
          <Save className="size-4" /> {save.isPending ? "Salvando..." : "Salvar"}
        </Button>
        <Button className="professional-secondary-button" variant="outline" asChild>
          <a href={`/agendar/${business.slug}`} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" /> Abrir Painel 1
          </a>
        </Button>
        <Button
          className="professional-secondary-button"
          variant="outline"
          onClick={() => void copyPublicLink()}
        >
          <Copy className="size-4" /> Copiar link
        </Button>
      </div>

      <div className="professional-info-box mt-4">
        <Link2 className="size-4 shrink-0 text-[#5d9cff]" />
        <span className="truncate">Link atual: /agendar/{business.slug}</span>
      </div>
    </article>
  );
}
