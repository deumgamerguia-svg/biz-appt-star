import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Paintbrush, SlidersHorizontal, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LOGO_BUCKET, getLogoUrl } from "@/lib/logo";
import { Button } from "@/components/ui/button";

type Appearance = {
  page_text: string;
  service_background: string;
  service_text: string;
  service_border: string;
  service_hover_background: string;
  service_hover_text: string;
  service_hover_border: string;
  modal_background: string;
  modal_text: string;
  modal_active_background: string;
  modal_active_text: string;
  modal_border: string;
  agenda_background: string;
  agenda_text: string;
  agenda_border: string;
};

const DEFAULT_APPEARANCE: Appearance = {
  page_text: "#f3f4f6",
  service_background: "#0b0d0f",
  service_text: "#f3f4f6",
  service_border: "#2a2d32",
  service_hover_background: "#101828",
  service_hover_text: "#ffffff",
  service_hover_border: "#1677ff",
  modal_background: "#0b0d0f",
  modal_text: "#f3f4f6",
  modal_active_background: "#10294a",
  modal_active_text: "#5da8ff",
  modal_border: "#2a2d32",
  agenda_background: "#0b0d0f",
  agenda_text: "#f3f4f6",
  agenda_border: "#2a2d32",
};

export function AppearanceSettings({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [primary, setPrimary] = useState("#1677ff");
  const [background, setBackground] = useState("#050607");
  const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);

  const { data } = useQuery({
    queryKey: ["panel1-appearance", businessId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("businesses") as any)
        .select("logo_url, brand_primary, brand_background, booking_appearance")
        .eq("id", businessId)
        .maybeSingle();
      if (error) throw error;
      const path = data?.logo_url ?? null;
      return {
        ...data,
        logoPath: path,
        logoUrl: await getLogoUrl(path),
      } as {
        logoPath: string | null;
        logoUrl: string | null;
        brand_primary?: string | null;
        brand_background?: string | null;
        booking_appearance?: Partial<Appearance>;
      };
    },
  });

  useEffect(() => {
    if (!data) return;
    setPrimary(data.brand_primary ?? "#1677ff");
    setBackground(data.brand_background ?? "#050607");
    setAppearance({ ...DEFAULT_APPEARANCE, ...(data.booking_appearance ?? {}) });
  }, [data]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["panel1-appearance", businessId] });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("businesses") as any)
        .update({
          brand_primary: primary,
          brand_background: background,
          booking_appearance: appearance,
        })
        .eq("id", businessId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aparência do Painel 1 atualizada");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
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
      if (data?.logoPath) await supabase.storage.from(LOGO_BUCKET).remove([data.logoPath]);
    },
    onSuccess: () => {
      toast.success("Logotipo atualizada");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBusy(false),
  });

  const removeLogo = useMutation({
    mutationFn: async () => {
      if (data?.logoPath) await supabase.storage.from(LOGO_BUCKET).remove([data.logoPath]);
      const { error } = await supabase
        .from("businesses")
        .update({ logo_url: null })
        .eq("id", businessId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Logotipo removida");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setColor = (key: keyof Appearance, value: string) =>
    setAppearance((current) => ({ ...current, [key]: value }));

  return (
    <div className="rounded-2xl border border-[#25282c] bg-[#090a0c] p-5 sm:p-7">
      <div className="flex flex-col gap-2 border-b border-[#25282c] pb-6">
        <div className="flex items-center gap-3">
          <Paintbrush className="size-5 text-[#5da8ff]" />
          <h2 className="text-xl font-semibold">Alterar cores</h2>
        </div>
        <p className="text-sm text-[#8b929d]">
          Customize a página inicial que o cliente usa para marcar o horário.
        </p>
      </div>

      <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-[#2a2d32] bg-[#111316] p-5 sm:p-7">
          <div
            className="mx-auto max-w-xl rounded-2xl border p-7"
            style={{
              background,
              color: appearance.page_text,
              borderColor: appearance.service_border,
            }}
          >
            <div className="flex min-h-24 items-center justify-center">
              {data?.logoUrl ? (
                <img
                  src={data.logoUrl}
                  alt="Logotipo"
                  className="max-h-20 max-w-[72%] object-contain"
                />
              ) : (
                <span className="text-sm opacity-60">Sua logotipo</span>
              )}
            </div>
            <h3 className="mt-4 text-center text-xl font-semibold">SERVIÇOS</h3>
            <div className="mt-5 space-y-4">
              {["Serviço de exemplo", "Outro serviço", "Serviço premium"].map(
                (label, index) => (
                  <div
                    key={label}
                    className="rounded-lg border px-4 py-4 text-center"
                    style={{
                      background: appearance.service_background,
                      color: appearance.service_text,
                      borderColor: appearance.service_border,
                    }}
                  >
                    <p>{label}</p>
                    <p className="mt-2 text-sm opacity-75">
                      R$ {index === 0 ? "25,00 · 30min" : index === 1 ? "45,00 · 40min" : "80,00 · 60min"}
                    </p>
                  </div>
                ),
              )}
            </div>
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
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
              <ImagePlus className="mr-2 size-4" />
              {busy ? "Enviando..." : data?.logoUrl ? "Trocar logotipo" : "Enviar logotipo"}
            </Button>
            {data?.logoUrl && (
              <Button variant="outline" onClick={() => removeLogo.mutate()}>
                <Trash2 className="mr-2 size-4" /> Remover
              </Button>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <ColorControl label="Cor de fundo" value={background} onChange={setBackground} />
          <ColorControl label="Cor de destaque" value={primary} onChange={setPrimary} />
          <ColorControl
            label="Texto da página"
            value={appearance.page_text}
            onChange={(value) => setColor("page_text", value)}
          />
        </aside>
      </div>

      <div className="mt-8 rounded-2xl border border-[#2a2d32] bg-[#111316] p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <SlidersHorizontal className="size-5 text-[#5da8ff]" />
          <h3 className="font-semibold">Configurações avançadas</h3>
        </div>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          <ColorControl label="Borda hover serviço" value={appearance.service_hover_border} onChange={(value) => setColor("service_hover_border", value)} />
          <ColorControl label="Borda serviço" value={appearance.service_border} onChange={(value) => setColor("service_border", value)} />
          <ColorControl label="Texto hover serviço" value={appearance.service_hover_text} onChange={(value) => setColor("service_hover_text", value)} />
          <ColorControl label="Texto serviço" value={appearance.service_text} onChange={(value) => setColor("service_text", value)} />
          <ColorControl label="Hover serviço" value={appearance.service_hover_background} onChange={(value) => setColor("service_hover_background", value)} />
          <ColorControl label="Background serviço" value={appearance.service_background} onChange={(value) => setColor("service_background", value)} />
          <ColorControl label="Texto hover modal" value={appearance.modal_active_text} onChange={(value) => setColor("modal_active_text", value)} />
          <ColorControl label="Texto modal" value={appearance.modal_text} onChange={(value) => setColor("modal_text", value)} />
          <ColorControl label="Borda modal" value={appearance.modal_border} onChange={(value) => setColor("modal_border", value)} />
          <ColorControl label="Background modal" value={appearance.modal_background} onChange={(value) => setColor("modal_background", value)} />
          <ColorControl label="Background ativo modal" value={appearance.modal_active_background} onChange={(value) => setColor("modal_active_background", value)} />
          <ColorControl label="Borda agenda" value={appearance.agenda_border} onChange={(value) => setColor("agenda_border", value)} />
          <ColorControl label="Texto agenda" value={appearance.agenda_text} onChange={(value) => setColor("agenda_text", value)} />
          <ColorControl label="Background agenda" value={appearance.agenda_background} onChange={(value) => setColor("agenda_background", value)} />
        </div>
      </div>

      <div className="mt-7 flex flex-wrap justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => {
            setPrimary("#1677ff");
            setBackground("#050607");
            setAppearance(DEFAULT_APPEARANCE);
          }}
        >
          Restaurar padrão
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando..." : "Salvar aparência"}
        </Button>
      </div>
    </div>
  );
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-[#d9dde3]">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-11 cursor-pointer rounded-full border-0 bg-transparent p-0"
        />
        <span className="w-[74px] text-xs uppercase text-[#7f8793]">{value}</span>
      </span>
    </label>
  );
}
