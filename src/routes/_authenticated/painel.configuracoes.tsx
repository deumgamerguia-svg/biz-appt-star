import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { LOGO_BUCKET, getLogoUrl } from "@/lib/logo";
import { PageHeader, NoBusiness } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/painel/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Agenda Agora" },
      { name: "description", content: "Defina a logotipo que aparece na página de agendamento." },
      { property: "og:title", content: "Configurações — Agenda Agora" },
      { property: "og:description", content: "Defina a logotipo do seu negócio." },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const { data: logo } = useQuery({
    queryKey: ["business-logo", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("logo_url")
        .eq("id", businessId!)
        .maybeSingle();
      if (error) throw error;
      const path = (data as { logo_url: string | null } | null)?.logo_url ?? null;
      return { path, url: await getLogoUrl(path) };
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["business-logo", businessId] });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!businessId) throw new Error("Selecione um negócio");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${businessId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { error: dbError } = await supabase
        .from("businesses")
        .update({ logo_url: path })
        .eq("id", businessId);
      if (dbError) throw dbError;
      if (logo?.path) await supabase.storage.from(LOGO_BUCKET).remove([logo.path]);
    },
    onSuccess: () => {
      toast.success("Logotipo atualizada");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBusy(false),
  });

  const removeLogo = useMutation({
    mutationFn: async () => {
      if (!businessId) return;
      if (logo?.path) await supabase.storage.from(LOGO_BUCKET).remove([logo.path]);
      const { error } = await supabase
        .from("businesses")
        .update({ logo_url: null })
        .eq("id", businessId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Logotipo removida");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!businessId) return <NoBusiness />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle="A logotipo aparece no topo da página em que o cliente agenda."
      />

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col items-center gap-5">
          <div className="flex h-36 w-full max-w-sm items-center justify-center rounded-xl border border-dashed border-border bg-background">
            {logo?.url ? (
              <img
                src={logo.url}
                alt="Logotipo do negócio"
                className="max-h-28 max-w-[80%] object-contain"
              />
            ) : (
              <span className="text-sm text-muted-foreground">Nenhuma logotipo enviada</span>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) {
                toast.error("A imagem precisa ter no máximo 5 MB");
                return;
              }
              setBusy(true);
              upload.mutate(file);
            }}
          />

          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => inputRef.current?.click()} disabled={busy}>
              <ImagePlus className="mr-2 size-4" />
              {busy ? "Enviando..." : logo?.url ? "Trocar logotipo" : "Enviar logotipo"}
            </Button>
            {logo?.url && (
              <Button variant="outline" onClick={() => removeLogo.mutate()}>
                <Trash2 className="mr-2 size-4" /> Remover
              </Button>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Use PNG ou JPG, de preferência com fundo transparente. Máximo de 5 MB.
          </p>
        </div>
      </div>

      <BrandColors businessId={businessId} />
    </div>
  );
}

const DEFAULT_PRIMARY = "#1f6feb";
const DEFAULT_BACKGROUND = "#0f172a";

function BrandColors({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient();
  const [primary, setPrimary] = useState(DEFAULT_PRIMARY);
  const [background, setBackground] = useState(DEFAULT_BACKGROUND);

  const { data: colors } = useQuery({
    queryKey: ["business-colors", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("brand_primary, brand_background")
        .eq("id", businessId)
        .maybeSingle();
      if (error) throw error;
      return data as { brand_primary: string | null; brand_background: string | null } | null;
    },
  });

  useEffect(() => {
    if (!colors) return;
    setPrimary(colors.brand_primary ?? DEFAULT_PRIMARY);
    setBackground(colors.brand_background ?? DEFAULT_BACKGROUND);
  }, [colors]);

  const save = useMutation({
    mutationFn: async (values: { brand_primary: string | null; brand_background: string | null }) => {
      const { error } = await supabase.from("businesses").update(values).eq("id", businessId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cores da página do cliente atualizadas");
      void queryClient.invalidateQueries({ queryKey: ["business-colors", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-bold">Cores da página do cliente</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha o fundo e a cor de destaque que o cliente vê ao agendar.
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="brand-bg" className="text-sm font-medium">
            Cor de fundo
          </label>
          <div className="flex items-center gap-3">
            <input
              id="brand-bg"
              type="color"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent"
            />
            <span className="text-sm text-muted-foreground">{background}</span>
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="brand-primary" className="text-sm font-medium">
            Cor de destaque
          </label>
          <div className="flex items-center gap-3">
            <input
              id="brand-primary"
              type="color"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent"
            />
            <span className="text-sm text-muted-foreground">{primary}</span>
          </div>
        </div>
      </div>

      <div
        className="mt-5 rounded-xl border border-border p-6 text-center"
        style={{ background }}
      >
        <p className="text-sm" style={{ color: primary }}>
          Prévia: assim o cliente vê os destaques da sua página.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          onClick={() => save.mutate({ brand_primary: primary, brand_background: background })}
          disabled={save.isPending}
        >
          Salvar cores
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setPrimary(DEFAULT_PRIMARY);
            setBackground(DEFAULT_BACKGROUND);
            save.mutate({ brand_primary: null, brand_background: null });
          }}
        >
          Usar cores padrão
        </Button>
      </div>
    </div>
  );
}

