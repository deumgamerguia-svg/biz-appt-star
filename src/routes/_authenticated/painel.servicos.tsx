import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  ImagePlus,
  Layers3,
  Link2,
  Pencil,
  Plus,
  Scissors,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { formatPrice } from "@/lib/format";
import { LOGO_BUCKET } from "@/lib/logo";
import { NoBusiness } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/painel/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — Agenda Agora" },
      {
        name: "description",
        content: "Cadastre serviços, valores, imagens e profissionais.",
      },
      { property: "og:title", content: "Serviços — Agenda Agora" },
      {
        property: "og:description",
        content: "Gerencie os serviços oferecidos pelo negócio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServicosPage,
});

type Form = {
  id?: string;
  name: string;
  duration: string;
  price: string;
  deposit: string;
  description: string;
  isCombo: boolean;
  showPrice: boolean;
  showDuration: boolean;
  showService: boolean;
  imagePath: string | null;
  professionalIds: string[];
};

const empty: Form = {
  name: "",
  duration: "30",
  price: "0",
  deposit: "0",
  description: "",
  isCombo: false,
  showPrice: true,
  showDuration: true,
  showService: true,
  imagePath: null,
  professionalIds: [],
};

const money = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

function ServicosPage() {
  const { businessId } = useBusiness();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [uploading, setUploading] = useState(false);

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

  const { data: professionals } = useQuery({
    queryKey: ["professionals", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id,name,role,active")
        .eq("business_id", businessId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: links } = useQuery({
    queryKey: ["service-links", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_professionals")
        .select("service_id,professional_id")
        .eq("business_id", businessId!);
      if (error) throw error;
      return data;
    },
  });

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["services", businessId] }),
      qc.invalidateQueries({ queryKey: ["service-links", businessId] }),
    ]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        business_id: businessId!,
        name: form.name.trim(),
        duration_minutes: Number(form.duration) || 30,
        price_cents: Math.round(Number(form.price.replace(",", ".")) * 100) || 0,
        deposit_cents: Math.round(Number(form.deposit.replace(",", ".")) * 100) || 0,
        description: form.description.trim() || null,
        is_combo: form.isCombo,
        show_price: form.showPrice,
        show_duration: form.showDuration,
        show_service: form.showService,
        image_path: form.imagePath,
      };

      const result = form.id
        ? await supabase.from("services").update(payload).eq("id", form.id).select("id").single()
        : await supabase.from("services").insert(payload).select("id").single();

      if (result.error) throw result.error;
      const id = result.data.id;

      const removed = await supabase
        .from("service_professionals")
        .delete()
        .eq("service_id", id)
        .eq("business_id", businessId!);
      if (removed.error) throw removed.error;

      if (form.professionalIds.length) {
        const added = await supabase.from("service_professionals").insert(
          form.professionalIds.map((professional_id) => ({
            business_id: businessId!,
            service_id: id,
            professional_id,
          })),
        );
        if (added.error) throw added.error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Serviço atualizado!" : "Serviço cadastrado!");
      setOpen(false);
      setForm(empty);
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("services")
        .update({ active })
        .eq("id", id)
        .eq("business_id", businessId!);
      if (error) throw error;
    },
    onSuccess: () => void refresh(),
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", id)
        .eq("business_id", businessId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço removido.");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const edit = (service: NonNullable<typeof services>[number]) => {
    setForm({
      id: service.id,
      name: service.name,
      duration: String(service.duration_minutes),
      price: money(service.price_cents),
      deposit: money(service.deposit_cents),
      description: service.description ?? "",
      isCombo: service.is_combo,
      showPrice: service.show_price,
      showDuration: service.show_duration,
      showService: service.show_service,
      imagePath: service.image_path,
      professionalIds: (links ?? [])
        .filter((link) => link.service_id === service.id)
        .map((link) => link.professional_id),
    });
    setOpen(true);
  };

  const openCreate = () => {
    setForm(empty);
    setOpen(true);
  };

  const setProfessional = (professionalId: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      professionalIds: checked
        ? [...new Set([...current.professionalIds, professionalId])]
        : current.professionalIds.filter((id) => id !== professionalId),
    }));
  };

  const upload = async (file?: File) => {
    if (!file || !businessId) return;
    setUploading(true);
    const storagePath = `${businessId}/services/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "-")}`;
    const { error } = await supabase.storage.from(LOGO_BUCKET).upload(storagePath, file, {
      upsert: false,
    });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setForm((current) => ({ ...current, imagePath: storagePath }));
  };

  if (!businessId) return <NoBusiness />;

  const total = services?.length ?? 0;
  const active = services?.filter((service) => service.active).length ?? 0;
  const combos = services?.filter((service) => service.is_combo).length ?? 0;
  const linkCount = links?.length ?? 0;

  return (
    <div className="services-premium mx-auto w-full max-w-5xl space-y-3">
      <section className="professional-main-card">
        <div className="relative z-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="professional-icon-box">
                <Scissors className="size-[1.05rem]" strokeWidth={1.8} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[1.35rem] font-semibold tracking-[-0.035em] text-[#f3f4f6]">
                    Serviços
                  </h1>
                  <span className="professional-badge">Catálogo e valores</span>
                </div>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#6d7079]">
                  Configure serviços, preços, duração, sinal, profissionais vinculados e como cada opção aparece para o cliente.
                </p>
              </div>
            </div>

            <Button className="professional-primary-button" onClick={openCreate}>
              <Plus className="size-4" />
              Novo serviço
            </Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Scissors} label="Serviços" value={String(total)} />
            <MetricCard icon={BadgeCheck} label="Ativos" value={String(active)} />
            <MetricCard icon={Layers3} label="Combos" value={String(combos)} />
            <MetricCard icon={Link2} label="Vínculos" value={String(linkCount)} />
          </div>
        </div>
      </section>

      <section className="professional-list-panel">
        <div className="professional-segmented-header">
          <button type="button" className="is-active">Serviços</button>
          <button type="button" disabled>Catálogo</button>
        </div>

        <div className="relative z-10 border-b border-[#25272d] px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="professional-icon-box !size-9">
                <Scissors className="size-4" />
              </div>
              <div>
                <h2 className="text-[0.98rem] font-semibold text-[#eef0f4]">
                  Serviços cadastrados
                </h2>
                <p className="mt-0.5 text-xs text-[#62656e]">
                  Gerencie preços, duração, sinal e profissionais vinculados.
                </p>
              </div>
            </div>
            <Button className="professional-primary-button" onClick={openCreate}>
              <Plus className="size-4" />
              Cadastrar serviço
            </Button>
          </div>
        </div>

        {!services?.length ? (
          <div className="professional-empty-state">
            <div className="professional-icon-box !size-14">
              <Scissors className="size-6" />
            </div>
            <h3>Nenhum serviço cadastrado</h3>
            <p>
              Adicione o primeiro serviço para configurar preço, duração, sinal, profissionais e exibição para o cliente.
            </p>
            <Button className="professional-primary-button mt-5" onClick={openCreate}>
              <Plus className="size-4" />
              Criar primeiro serviço
            </Button>
          </div>
        ) : (
          <div className="relative z-10 divide-y divide-[#22252b]">
            {services.map((service) => (
              <div key={service.id} className="professional-person-row">
                <div className="professional-avatar">
                  <Scissors className="size-4" strokeWidth={1.8} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[#eef0f3]">
                      {service.name}
                    </p>
                    {service.is_combo && <span className="professional-badge">Combo</span>}
                  </div>
                  <p className="mt-1 text-xs text-[#686b74]">
                    {service.duration_minutes} min · {formatPrice(service.price_cents)} · {(links ?? []).filter((link) => link.service_id === service.id).length} vínculo(s)
                  </p>
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-[#70737b]">
                  Ativo
                  <Switch
                    checked={service.active}
                    onCheckedChange={(isActive) => toggle.mutate({ id: service.id, active: isActive })}
                  />
                </label>

                <Button
                  variant="ghost"
                  size="icon"
                  className="professional-icon-action"
                  onClick={() => edit(service)}
                  aria-label={`Editar ${service.name}`}
                >
                  <Pencil className="size-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="professional-icon-action hover:!text-red-400"
                  onClick={() => remove.mutate(service.id)}
                  aria-label={`Remover ${service.name}`}
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
          if (!value) setForm(empty);
        }}
      >
        <DialogContent className="professional-dialog max-w-xl overflow-y-auto p-0">
          <DialogHeader className="professional-dialog-header">
            <div className="flex items-start gap-3 text-left">
              <div className="professional-dialog-icon">
                <Scissors className="size-[1.05rem]" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[#f1f2f4]">
                  {form.id ? "Editar serviço" : "Adicionar serviço"}
                </DialogTitle>
                <p className="mt-1 text-xs leading-relaxed text-[#686b74]">
                  Configure dados, vínculos, exibição e imagem do serviço.
                </p>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="dados" className="professional-dialog-body px-4 pb-4 sm:px-5 sm:pb-5">
            <TabsList className="professional-tabs grid w-full grid-cols-3">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
              <TabsTrigger value="imagem">Imagem</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="professional-form-section space-y-5 pt-5">
              <Field
                label="Nome do serviço"
                value={form.name}
                onChange={(name) => setForm({ ...form, name })}
                placeholder="Corte masculino"
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label="Valor (R$)"
                  value={form.price}
                  onChange={(price) => setForm({ ...form, price })}
                />
                <Field
                  label="Tempo (min)"
                  value={form.duration}
                  type="number"
                  onChange={(duration) => setForm({ ...form, duration })}
                />
                <Field
                  label="Sinal (R$)"
                  value={form.deposit}
                  onChange={(deposit) => setForm({ ...form, deposit })}
                />
              </div>

              <div className="space-y-2">
                <Label className="professional-section-label">Descrição</Label>
                <Textarea
                  className="professional-input service-description-input min-h-24 resize-none py-3"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>

              <Toggle
                label="Este serviço é um combo"
                checked={form.isCombo}
                onChange={(isCombo) => setForm({ ...form, isCombo })}
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <Toggle
                  label="Mostrar serviço"
                  checked={form.showService}
                  onChange={(showService) => setForm({ ...form, showService })}
                />
                <Toggle
                  label="Mostrar valor"
                  checked={form.showPrice}
                  onChange={(showPrice) => setForm({ ...form, showPrice })}
                />
                <Toggle
                  label="Mostrar duração"
                  checked={form.showDuration}
                  onChange={(showDuration) => setForm({ ...form, showDuration })}
                />
              </div>
            </TabsContent>

            <TabsContent value="vinculos" className="professional-form-section space-y-3 pt-5">
              <div className="professional-info-box">
                <Link2 className="size-4 text-[#5d9cff]" />
                Selecione os profissionais que podem executar este serviço.
              </div>

              {!professionals?.length ? (
                <p className="professional-empty-inline">
                  Nenhum profissional ativo cadastrado. Cadastre profissionais primeiro para criar vínculos.
                </p>
              ) : (
                professionals.map((professional) => (
                  <label key={professional.id} className="professional-choice-row">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[#d8dbe1]">
                        {professional.name}
                      </span>
                      {professional.role ? (
                        <span className="mt-0.5 block truncate text-xs text-[#62656e]">
                          {professional.role}
                        </span>
                      ) : null}
                    </span>
                    <Switch
                      checked={form.professionalIds.includes(professional.id)}
                      onCheckedChange={(checked) => setProfessional(professional.id, checked)}
                      aria-label={`Vincular ${professional.name}`}
                    />
                  </label>
                ))
              )}
            </TabsContent>

            <TabsContent value="imagem" className="professional-form-section pt-5">
              <label className="service-image-dropzone">
                <div className="professional-dialog-icon !size-14">
                  <ImagePlus className="size-6" />
                </div>
                <span className="mt-4 text-sm font-semibold text-[#e4e7ec]">
                  {form.imagePath ? "Imagem selecionada" : "Adicionar imagem do serviço"}
                </span>
                <span className="mt-1 max-w-sm text-center text-xs leading-relaxed text-[#646771]">
                  A imagem aparece nos detalhes do serviço para o cliente.
                </span>
                <span className="mt-4 inline-flex items-center rounded-lg border border-[#2f83ff]/35 bg-[#1677ff]/[0.08] px-3 py-2 text-xs font-semibold text-[#70a8ff]">
                  {uploading ? "Enviando..." : "Selecionar imagem"}
                </span>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(event) => void upload(event.target.files?.[0])}
                />
              </label>
            </TabsContent>
          </Tabs>

          <DialogFooter className="professional-dialog-footer">
            <Button
              variant="outline"
              className="professional-secondary-button"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="professional-primary-button"
              onClick={() => save.mutate()}
              disabled={!form.name.trim() || save.isPending || uploading}
            >
              {uploading
                ? "Enviando..."
                : save.isPending
                  ? "Salvando..."
                  : form.id
                    ? "Salvar alterações"
                    : "Criar serviço"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Scissors;
  label: string;
  value: string;
}) {
  return (
    <div className="professional-stat-card">
      <div className="professional-icon-box !size-9">
        <Icon className="size-4" strokeWidth={1.8} />
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="professional-section-label">{label}</Label>
      <Input
        className="professional-input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="professional-choice-row">
      <span className="text-sm font-medium text-[#d8dbe1]">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
