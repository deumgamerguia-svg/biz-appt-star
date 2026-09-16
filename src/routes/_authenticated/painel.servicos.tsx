import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { formatPrice } from "@/lib/format";
import { LOGO_BUCKET } from "@/lib/logo";
import { PageHeader, NoBusiness, EmptyList } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/painel/servicos")({
  head: () => ({ meta: [
    { title: "Serviços — Agenda Agora" },
    { name: "description", content: "Cadastre serviços, valores, imagens e profissionais." },
    { property: "og:title", content: "Serviços — Agenda Agora" },
    { property: "og:description", content: "Gerencie os serviços oferecidos pelo negócio." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ]}), component: ServicosPage,
});

const SERVICE_DAYS = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
] as const;
const DEFAULT_SERVICE_DAYS = SERVICE_DAYS.map((day) => day.value);

type Form = { id?: string; name: string; duration: string; price: string; deposit: string; description: string; isCombo: boolean; showPrice: boolean; showDuration: boolean; showService: boolean; imagePath: string | null; professionalIds: string[]; workingDays: number[] };
const empty: Form = { name: "", duration: "30", price: "0", deposit: "0", description: "", isCombo: false, showPrice: true, showDuration: true, showService: true, imagePath: null, professionalIds: [], workingDays: [...DEFAULT_SERVICE_DAYS] };
const money = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

function ServicosPage() {
  const { businessId } = useBusiness(); const qc = useQueryClient();
  const [open, setOpen] = useState(false); const [form, setForm] = useState<Form>(empty); const [uploading, setUploading] = useState(false);
  const { data: services } = useQuery({ queryKey: ["services", businessId], enabled: !!businessId, queryFn: async () => { const { data, error } = await supabase.from("services").select("*").eq("business_id", businessId!).order("created_at"); if (error) throw error; return data; } });
  const { data: links } = useQuery({ queryKey: ["service-links", businessId], enabled: !!businessId, queryFn: async () => { const { data, error } = await supabase.from("service_professionals").select("service_id,professional_id").eq("business_id", businessId!); if (error) throw error; return data; } });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["services", businessId] }), qc.invalidateQueries({ queryKey: ["service-links", businessId] })]);
  const save = useMutation({ mutationFn: async () => {
    const payload = { business_id: businessId!, name: form.name.trim(), duration_minutes: Number(form.duration) || 30, price_cents: Math.round(Number(form.price.replace(",", ".")) * 100) || 0, deposit_cents: Math.round(Number(form.deposit.replace(",", ".")) * 100) || 0, description: form.description || null, is_combo: form.isCombo, show_price: form.showPrice, show_duration: form.showDuration, show_service: form.showService, image_path: form.imagePath, working_days: form.workingDays };
    const result = form.id ? await (supabase.from("services") as any).update(payload).eq("id", form.id).select("id").single() : await (supabase.from("services") as any).insert(payload).select("id").single();
    if (result.error) throw result.error; const id = result.data.id;
    const removed = await supabase.from("service_professionals").delete().eq("service_id", id); if (removed.error) throw removed.error;
    if (form.professionalIds.length) { const added = await supabase.from("service_professionals").insert(form.professionalIds.map((professional_id) => ({ business_id: businessId!, service_id: id, professional_id }))); if (added.error) throw added.error; }
  }, onSuccess: () => { toast.success(form.id ? "Serviço atualizado!" : "Serviço cadastrado!"); setOpen(false); setForm(empty); void refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const toggle = useMutation({ mutationFn: async ({ id, active }: { id: string; active: boolean }) => { const { error } = await supabase.from("services").update({ active }).eq("id", id); if (error) throw error; }, onSuccess: () => void refresh() });
  const remove = useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("services").delete().eq("id", id); if (error) throw error; }, onSuccess: () => { toast.success("Serviço removido."); void refresh(); } });
  const edit = (s: NonNullable<typeof services>[number]) => { const workingDays = ((s as typeof s & { working_days?: number[] }).working_days ?? DEFAULT_SERVICE_DAYS).filter((day) => DEFAULT_SERVICE_DAYS.includes(day as (typeof DEFAULT_SERVICE_DAYS)[number])); setForm({ id: s.id, name: s.name, duration: String(s.duration_minutes), price: money(s.price_cents), deposit: money(s.deposit_cents), description: s.description ?? "", isCombo: s.is_combo, showPrice: s.show_price, showDuration: s.show_duration, showService: s.show_service, imagePath: s.image_path, professionalIds: (links ?? []).filter((l) => l.service_id === s.id).map((l) => l.professional_id), workingDays }); setOpen(true); };
  const upload = async (file?: File) => { if (!file || !businessId) return; setUploading(true); const path = `${businessId}/services/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "-")}`; const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, { upsert: false }); setUploading(false); if (error) { toast.error(error.message); return; } setForm((v) => ({ ...v, imagePath: path })); };
  if (!businessId) return <NoBusiness />;
  const allDaysSelected = SERVICE_DAYS.every((day) => form.workingDays.includes(day.value));
  const setAllDays = (checked: boolean) => setForm({ ...form, workingDays: checked ? [...DEFAULT_SERVICE_DAYS] : [] });
  const setDay = (day: number, checked: boolean) => setForm({ ...form, workingDays: checked ? [...new Set([...form.workingDays, day])].sort((a, b) => a - b) : form.workingDays.filter((value) => value !== day) });
  return <div><PageHeader title="Serviços" subtitle="Configure como cada serviço aparece para o cliente." action={<Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty); }}><DialogTrigger asChild><Button><Plus className="size-4" /> Novo serviço</Button></DialogTrigger><DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{form.id ? "Editar serviço" : "Cadastrar serviço"}</DialogTitle></DialogHeader>
    <Tabs defaultValue="dados"><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="dados">Dados</TabsTrigger><TabsTrigger value="vinculos">Vínculos</TabsTrigger><TabsTrigger value="imagem">Imagem</TabsTrigger></TabsList>
      <TabsContent value="dados" className="space-y-4 pt-4"><div className="space-y-2"><Label>Nome do serviço</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Corte masculino" /></div><div className="grid gap-4 sm:grid-cols-3"><Field label="Valor (R$)" value={form.price} onChange={(price) => setForm({ ...form, price })} /><Field label="Tempo (min)" value={form.duration} type="number" onChange={(duration) => setForm({ ...form, duration })} /><Field label="Sinal (R$)" value={form.deposit} onChange={(deposit) => setForm({ ...form, deposit })} /></div><div className="space-y-2"><Label>Descrição</Label><Textarea className="min-h-28" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div><Toggle label="Este serviço é um combo" checked={form.isCombo} onChange={(isCombo) => setForm({ ...form, isCombo })} /><div className="grid gap-3 sm:grid-cols-3"><Toggle label="Mostrar serviço" checked={form.showService} onChange={(showService) => setForm({ ...form, showService })} /><Toggle label="Mostrar valor" checked={form.showPrice} onChange={(showPrice) => setForm({ ...form, showPrice })} /><Toggle label="Mostrar duração" checked={form.showDuration} onChange={(showDuration) => setForm({ ...form, showDuration })} /></div></TabsContent>
      <TabsContent value="vinculos" className="space-y-3 pt-4"><label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={allDaysSelected} onCheckedChange={setAllDays} aria-label="Selecionar todos os dias" /><span>Todos</span></label><div className="overflow-hidden rounded-md border border-border"><div className="grid grid-cols-[1fr_72px] border-b border-border bg-muted/30 px-3 py-2 text-sm font-semibold"><span>Dias da semana</span><span className="text-center">Vínculo</span></div>{SERVICE_DAYS.map((day) => <div key={day.value} className="grid grid-cols-[1fr_72px] items-center border-b border-border px-3 py-2.5 last:border-b-0"><span className="text-sm">{day.label}</span><div className="flex justify-center"><Switch checked={form.workingDays.includes(day.value)} onCheckedChange={(checked) => setDay(day.value, checked)} aria-label={`Vincular ${day.label}`} /></div></div>)}</div></TabsContent>
      <TabsContent value="imagem" className="pt-4"><label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 p-6 text-center"><ImagePlus className="mb-3 size-8 text-primary" /><span className="font-semibold">{form.imagePath ? "Imagem selecionada" : "Adicionar imagem do serviço"}</span><span className="mt-1 text-xs text-muted-foreground">Ela aparece somente nos detalhes do serviço.</span><input className="sr-only" type="file" accept="image/*" onChange={(e) => void upload(e.target.files?.[0])} /></label></TabsContent>
    </Tabs><DialogFooter><Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending || uploading}>{uploading ? "Enviando..." : "Salvar serviço"}</Button></DialogFooter></DialogContent></Dialog>} />
    {!services?.length ? <EmptyList text="Nenhum serviço cadastrado." /> : <ul className="space-y-3">{services.map((s) => <li key={s.id} className="surface flex flex-wrap items-center gap-4 p-4"><div className="flex-1"><p className="font-semibold">{s.name}</p><p className="text-sm text-muted-foreground">{s.duration_minutes} min · {formatPrice(s.price_cents)}{s.is_combo ? " · combo" : ""}</p></div><label className="flex items-center gap-2 text-xs text-muted-foreground">Ativo <Switch checked={s.active} onCheckedChange={(active) => toggle.mutate({ id: s.id, active })} /></label><Button variant="ghost" size="icon" onClick={() => edit(s)} aria-label={`Editar ${s.name}`}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => remove.mutate(s.id)} aria-label={`Remover ${s.name}`}><Trash2 className="size-4 text-destructive" /></Button></li>)}</ul>}
  </div>;
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) { return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) { return <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"><span>{label}</span><Switch checked={checked} onCheckedChange={onChange} /></label>; }