import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  BriefcaseBusiness,
  KeyRound,
  Link2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { deleteProfessional, saveProfessional } from "@/lib/professionals.functions";
import { NoBusiness } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/painel/profissionais")({
  head: () => ({
    meta: [
      { title: "Profissionais — Agenda Agora" },
      { name: "description", content: "Gerencie equipe, vínculos e permissões." },
      { property: "og:title", content: "Profissionais — Agenda Agora" },
      { property: "og:description", content: "Gerencie equipe, vínculos e permissões." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfissionaisPage,
});

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const PERMISSIONS = [
  ["view_agenda", "Ver agenda"],
  ["create_appointment", "Criar agendamentos"],
  ["cancel_appointment", "Cancelar agendamentos"],
  ["complete_appointment", "Concluir agendamentos"],
  ["view_customer_phone", "Ver telefone dos clientes"],
  ["block_schedule", "Criar horários bloqueados"],
  ["view_financial", "Ver valores e financeiro"],
  ["view_reports", "Ver relatórios"],
] as const;

type Form = {
  id?: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  password: string;
  workingDays: number[];
  serviceIds: string[];
  permissions: Record<string, boolean>;
};

const empty: Form = {
  name: "",
  role: "",
  phone: "",
  email: "",
  password: "",
  workingDays: [1, 2, 3, 4, 5, 6],
  serviceIds: [],
  permissions: { view_agenda: true, create_appointment: true },
};

function ProfissionaisPage() {
  const { businessId } = useBusiness();
  const qc = useQueryClient();
  const saveFn = useServerFn(saveProfessional);
  const deleteFn = useServerFn(deleteProfessional);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

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

  const { data: services } = useQuery({
    queryKey: ["services", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id,name,active")
        .eq("business_id", businessId!)
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
      qc.invalidateQueries({ queryKey: ["professionals", businessId] }),
      qc.invalidateQueries({ queryKey: ["service-links", businessId] }),
    ]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          ...form,
          businessId: businessId!,
          avatarPath: null,
        },
      }),
    onSuccess: () => {
      toast.success(form.id ? "Profissional atualizado!" : "Profissional e acesso criados!");
      setOpen(false);
      setForm(empty);
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("professionals").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void refresh(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id, businessId: businessId! } }),
    onSuccess: () => {
      toast.success("Profissional e acesso removidos.");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const edit = (p: NonNullable<typeof people>[number]) => {
    const permissions =
      typeof p.permissions === "object" && p.permissions && !Array.isArray(p.permissions)
        ? (p.permissions as Record<string, boolean>)
        : {};

    setForm({
      id: p.id,
      name: p.name,
      role: p.role ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      password: "",
      workingDays: p.working_days,
      permissions,
      serviceIds: (links ?? [])
        .filter((link) => link.professional_id === p.id)
        .map((link) => link.service_id),
    });
    setOpen(true);
  };

  const openCreate = () => {
    setForm(empty);
    setOpen(true);
  };

  if (!businessId) return <NoBusiness />;

  const total = people?.length ?? 0;
  const active = people?.filter((person) => person.active).length ?? 0;
  const withAccess = people?.filter((person) => !!person.user_id).length ?? 0;
  const linkCount = links?.length ?? 0;

  return (
    <div className="professionals-premium mx-auto w-full max-w-5xl space-y-3">
      <section className="professional-main-card">
        <div className="relative z-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="professional-icon-box">
                <UsersRound className="size-[1.05rem]" strokeWidth={1.8} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[1.35rem] font-semibold tracking-[-0.035em] text-[#f3f4f6]">
                    Profissionais
                  </h1>
                  <span className="professional-badge">Equipe e permissões</span>
                </div>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#6d7079]">
                  Cadastre sua equipe, controle os serviços vinculados e defina exatamente o que cada profissional pode acessar.
                </p>
              </div>
            </div>

            <Button className="professional-primary-button" onClick={openCreate}>
              <Plus className="size-4" />
              Novo profissional
            </Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={UsersRound} label="Profissionais" value={String(total)} />
            <MetricCard icon={BadgeCheck} label="Ativos" value={String(active)} />
            <MetricCard icon={KeyRound} label="Acessos ativos" value={String(withAccess)} />
            <MetricCard icon={Link2} label="Vínculos de serviço" value={String(linkCount)} />
          </div>
        </div>
      </section>

      <section className="professional-list-panel">
        <div className="professional-segmented-header">
          <button type="button" className="is-active">Profissionais</button>
          <button type="button" disabled>Equipe</button>
        </div>

        <div className="relative z-10 border-b border-[#25272d] px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="professional-icon-box !size-9">
                <BriefcaseBusiness className="size-4" />
              </div>
              <div>
                <h2 className="text-[0.98rem] font-semibold text-[#eef0f4]">
                  Profissionais cadastrados
                </h2>
                <p className="mt-0.5 text-xs text-[#62656e]">
                  Gerencie equipe, acesso individual, vínculos e permissões.
                </p>
              </div>
            </div>
            <Button className="professional-primary-button" onClick={openCreate}>
              <Plus className="size-4" />
              Cadastrar profissional
            </Button>
          </div>
        </div>

        {!people?.length ? (
          <div className="professional-empty-state">
            <div className="professional-icon-box !size-14">
              <UserRound className="size-6" />
            </div>
            <h3>Nenhum profissional cadastrado</h3>
            <p>
              Adicione o primeiro profissional para liberar vínculos de serviços, permissões e acesso individual.
            </p>
            <Button className="professional-primary-button mt-5" onClick={openCreate}>
              <Plus className="size-4" />
              Criar primeiro profissional
            </Button>
          </div>
        ) : (
          <div className="relative z-10 divide-y divide-[#22252b]">
            {people.map((p) => (
              <div key={p.id} className="professional-person-row">
                <div className="professional-avatar">
                  {p.name.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[#eef0f3]">{p.name}</p>
                    {p.user_id && <span className="professional-badge">Acesso ativo</span>}
                  </div>
                  <p className="mt-1 text-xs text-[#686b74]">
                    {p.role || "Profissional"} · {(links ?? []).filter((link) => link.professional_id === p.id).length} vínculo(s)
                  </p>
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-[#70737b]">
                  Ativo
                  <Switch
                    checked={p.active}
                    onCheckedChange={(active) => toggle.mutate({ id: p.id, active })}
                  />
                </label>

                <Button
                  variant="ghost"
                  size="icon"
                  className="professional-icon-action"
                  onClick={() => edit(p)}
                  aria-label={`Editar ${p.name}`}
                >
                  <Pencil className="size-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="professional-icon-action hover:!text-red-400"
                  onClick={() => remove.mutate(p.id)}
                  aria-label={`Remover ${p.name}`}
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
        <DialogContent className="professional-dialog max-h-[92vh] max-w-2xl overflow-y-auto p-0">
          <DialogHeader className="professional-dialog-header">
            <div>
              <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[#f1f2f4]">
                {form.id ? "Editar profissional" : "Adicionar profissional"}
              </DialogTitle>
              <p className="mt-1 text-xs text-[#686b74]">
                Configure dados, serviços vinculados e permissões de acesso.
              </p>
            </div>
          </DialogHeader>

          <Tabs defaultValue="dados" className="px-4 pb-4 sm:px-5 sm:pb-5">
            <TabsList className="professional-tabs grid w-full grid-cols-3">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
              <TabsTrigger value="permissoes">Permissões</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-5 pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nome completo"
                  value={form.name}
                  onChange={(name) => setForm({ ...form, name })}
                />
                <Field
                  label="Cargo / especialidade"
                  value={form.role}
                  onChange={(role) => setForm({ ...form, role })}
                />
                <Field
                  label="Telefone de acesso"
                  value={form.phone}
                  onChange={(phone) => setForm({ ...form, phone })}
                />
                <Field
                  label="E-mail (opcional)"
                  value={form.email}
                  type="email"
                  onChange={(email) => setForm({ ...form, email })}
                />
                <Field
                  label={form.id ? "Nova senha de 4 dígitos (opcional)" : "Senha de 4 dígitos"}
                  value={form.password}
                  type="password"
                  maxLength={4}
                  onChange={(password) =>
                    setForm({
                      ...form,
                      password: password.replace(/\D/g, "").slice(0, 4),
                    })
                  }
                />
              </div>

              <div>
                <Label className="professional-section-label">Dias de trabalho</Label>
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {DAYS.map((day, index) => {
                    const selected = form.workingDays.includes(index);
                    return (
                      <label
                        key={day}
                        className={`professional-day-option ${selected ? "is-selected" : ""}`}
                      >
                        <Checkbox
                          className="sr-only"
                          checked={selected}
                          onCheckedChange={(value) =>
                            setForm({
                              ...form,
                              workingDays: value
                                ? [...form.workingDays, index]
                                : form.workingDays.filter((dayIndex) => dayIndex !== index),
                            })
                          }
                        />
                        {day}
                      </label>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="vinculos" className="space-y-3 pt-5">
              <div className="professional-info-box">
                <Link2 className="size-4 text-[#5d9cff]" />
                Selecione os serviços realizados por este profissional.
              </div>

              {services?.length ? (
                services.map((service) => (
                  <label key={service.id} className="professional-choice-row">
                    <span className="flex items-center gap-3">
                      <Checkbox
                        checked={form.serviceIds.includes(service.id)}
                        onCheckedChange={(value) =>
                          setForm({
                            ...form,
                            serviceIds: value
                              ? [...form.serviceIds, service.id]
                              : form.serviceIds.filter((id) => id !== service.id),
                          })
                        }
                      />
                      <span className="text-sm font-medium text-[#d8dbe1]">{service.name}</span>
                    </span>
                    <span className="text-[0.68rem] font-medium uppercase tracking-[0.1em] text-[#5f626b]">
                      {service.active ? "Ativo" : "Inativo"}
                    </span>
                  </label>
                ))
              ) : (
                <p className="professional-empty-inline">Nenhum serviço cadastrado.</p>
              )}
            </TabsContent>

            <TabsContent value="permissoes" className="space-y-3 pt-5">
              <div className="professional-info-box">
                <ShieldCheck className="size-4 text-[#5d9cff]" />
                Estas permissões controlam o que aparece e o que pode ser alterado no acesso do profissional.
              </div>

              {PERMISSIONS.map(([key, label]) => (
                <label key={key} className="professional-choice-row">
                  <span className="text-sm font-medium text-[#d8dbe1]">{label}</span>
                  <Switch
                    checked={!!form.permissions[key]}
                    onCheckedChange={(value) =>
                      setForm({
                        ...form,
                        permissions: { ...form.permissions, [key]: value },
                      })
                    }
                  />
                </label>
              ))}
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
              disabled={
                !form.name.trim() ||
                (!form.id && form.password.length !== 4) ||
                (!form.email && form.phone.replace(/\D/g, "").length < 8) ||
                save.isPending
              }
            >
              {form.id ? "Salvar alterações" : "Criar profissional"}
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
  icon: typeof UsersRound;
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
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
}) {
  return (
    <div className="space-y-2">
      <Label className="professional-section-label">{label}</Label>
      <Input
        className="professional-input"
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
