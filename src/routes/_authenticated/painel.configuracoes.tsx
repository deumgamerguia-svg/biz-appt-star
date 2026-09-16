import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/lib/business";
import { PageHeader, NoBusiness } from "@/components/painel/PageHeader";
import { AppearanceSettings } from "@/components/painel/AppearanceSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/painel/configuracoes")({
  validateSearch: (search: Record<string, unknown>) => ({
    secao: search.secao === "aparencia" ? "aparencia" : "preferencias",
  }),
  head: () => ({
    meta: [
      { title: "Configurações — Agenda Agora" },
      { name: "description", content: "Preferências e aparência do painel de agendamento." },
      { property: "og:title", content: "Configurações — Agenda Agora" },
      { property: "og:description", content: "Configure o funcionamento e a aparência do Painel 1." },
    ],
  }),
  component: ConfiguracoesPage,
});

type Preferences = {
  minimum_notice_hours: number;
  listing_time_minutes: number;
  notify_clients: boolean;
  reminder_hours_before: number;
  extra_reminder_minutes: number;
  extra_reminder_template: string;
  timezone: string;
  list_dates_days: number;
  cancellations: boolean;
  reschedule: boolean;
  greeting: string;
};

const DEFAULT_EXTRA_TEMPLATE =
  "{Saudacao} {Cliente}, só estou passando aqui para lembrar que você tem um horário agendado conosco hoje às {Horario} 😅 Espero por você, até breve! 👋";

const DEFAULT_PREFERENCES: Preferences = {
  minimum_notice_hours: 2,
  listing_time_minutes: 30,
  notify_clients: true,
  reminder_hours_before: 10,
  extra_reminder_minutes: 0,
  extra_reminder_template: DEFAULT_EXTRA_TEMPLATE,
  timezone: "America/Sao_Paulo",
  list_dates_days: 15,
  cancellations: true,
  reschedule: true,
  greeting: "Agende seu horário",
};

const preferenceItems = [
  ["available", "Horários Disponíveis"],
  ["listing", "Tempo de Listagem"],
  ["notify", "Avisar Clientes"],
  ["timezone", "Fuso Horário"],
  ["dates", "Listar datas"],
  ["cancel", "Cancelamentos"],
  ["reschedule", "Remarcar"],
  ["greeting", "Saudação"],
] as const;

type PreferenceKey = (typeof preferenceItems)[number][0];

const LISTING_OPTIONS: Array<readonly [number, string]> = [
  [10, "10 Minutos"],
  [15, "15 Minutos"],
  [20, "20 Minutos"],
  [30, "30 Minutos"],
  [40, "40 Minutos"],
  [45, "45 Minutos"],
  [50, "50 Minutos"],
  [60, "1 Hora"],
  [90, "1 Hora e 30 Minutos"],
  [120, "2 Horas"],
  [150, "2 Horas e 30 Minutos"],
  [180, "3 Horas"],
  [210, "3 Horas e 30 Minutos"],
  [240, "4 Horas"],
  [270, "4 Horas e 30 Minutos"],
  [300, "5 Horas"],
  [330, "5 Horas e 30 Minutos"],
  [360, "6 Horas"],
  [390, "6 Horas e 30 Minutos"],
];

const MAIN_REMINDER_OPTIONS: Array<readonly [number, string]> = Array.from(
  { length: 24 },
  (_, index) => {
    const hour = index + 1;
    return [hour, hour === 1 ? "1 Hora" : `${hour} Horas`] as const;
  },
);

const EXTRA_REMINDER_OPTIONS: Array<readonly [number, string]> = [
  [0, "Desabilitado"],
  [10, "10 Minutos"],
  [15, "15 Minutos"],
  [30, "30 Minutos"],
  [40, "40 Minutos"],
  [45, "45 Minutos"],
  [50, "50 Minutos"],
  [60, "1 Hora"],
  [90, "1 Hora e 30 Minutos"],
  [120, "2 Horas"],
  [180, "3 Horas"],
  [240, "4 Horas"],
  [300, "5 Horas"],
  [360, "6 Horas"],
  [420, "7 Horas"],
  [480, "8 Horas"],
  [540, "9 Horas"],
  [600, "10 Horas"],
  [660, "11 Horas"],
  [720, "12 Horas"],
];

function ConfiguracoesPage() {
  const { businessId } = useBusiness();
  const { secao } = Route.useSearch();

  if (!businessId) return <NoBusiness />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle={
          secao === "aparencia"
            ? "Personalize o Painel 1 que o cliente acessa."
            : "Defina as preferências do agendamento e do negócio."
        }
      />
      {secao === "aparencia" ? (
        <AppearanceSettings businessId={businessId} />
      ) : (
        <PreferencesSettings businessId={businessId} />
      )}
    </div>
  );
}

function PreferencesSettings({ businessId }: { businessId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<PreferenceKey>("available");
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [ownerName, setOwnerName] = useState("");

  const { data } = useQuery({
    queryKey: ["booking-preferences", businessId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("businesses") as any)
        .select("booking_preferences, reminder_enabled, reminder_hours_before")
        .eq("id", businessId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        booking_preferences?: Partial<Preferences>;
        reminder_enabled?: boolean;
        reminder_hours_before?: number;
      } | null;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["owner-greeting-name", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!data) return;
    setPrefs({
      ...DEFAULT_PREFERENCES,
      ...(data.booking_preferences ?? {}),
      notify_clients: data.reminder_enabled ?? data.booking_preferences?.notify_clients ?? true,
      reminder_hours_before:
        data.reminder_hours_before ?? data.booking_preferences?.reminder_hours_before ?? 10,
    });
  }, [data]);

  useEffect(() => {
    if (profile?.full_name !== undefined) setOwnerName(profile.full_name ?? "");
  }, [profile?.full_name]);

  const save = useMutation({
    mutationFn: async () => {
      const normalizedPrefs = {
        ...prefs,
        list_dates_days: Math.max(
          7,
          Math.min(365, Math.floor(Number(prefs.list_dates_days) || 15)),
        ),
      };
      const { error } = await (supabase.from("businesses") as any)
        .update({
          booking_preferences: normalizedPrefs,
          reminder_enabled: normalizedPrefs.notify_clients,
          reminder_hours_before: normalizedPrefs.reminder_hours_before,
        })
        .eq("id", businessId);
      if (error) throw error;

      if (selected === "greeting" && user?.id && ownerName.trim()) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: ownerName.trim() })
          .eq("id", user.id);
        if (profileError) throw profileError;
      }
    },
    onSuccess: () => {
      toast.success("Preferência salva");
      void queryClient.invalidateQueries({ queryKey: ["booking-preferences", businessId] });
      void queryClient.invalidateQueries({ queryKey: ["reminder-config", businessId] });
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: ["owner-greeting-name", user.id] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const insertExtraToken = (token: string) => {
    setPrefs((current) => ({
      ...current,
      extra_reminder_template: `${current.extra_reminder_template}${
        current.extra_reminder_template.endsWith(" ") || !current.extra_reminder_template ? "" : " "
      }${token}`,
    }));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[#25282c] bg-[#090a0c]">
      <div className="grid min-h-[570px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-[#25282c] p-4 lg:border-b-0 lg:border-r">
          <p className="px-2 pb-3 text-sm font-semibold text-[#8b929d]">Agenda</p>
          <div className="space-y-1">
            {preferenceItems.slice(0, 5).map(([key, label]) => (
              <PreferenceButton
                key={key}
                active={selected === key}
                onClick={() => setSelected(key)}
              >
                {label}
              </PreferenceButton>
            ))}
          </div>
          <p className="mt-8 px-2 pb-3 text-sm font-semibold text-[#8b929d]">
            Empresa e clientes
          </p>
          <div className="space-y-1">
            {preferenceItems.slice(5).map(([key, label]) => (
              <PreferenceButton
                key={key}
                active={selected === key}
                onClick={() => setSelected(key)}
              >
                {label}
              </PreferenceButton>
            ))}
          </div>
        </aside>

        <section className="p-5 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-2xl">
            {selected === "available" && (
              <SettingBlock
                title="Horários Disponíveis"
                description="Escolha quanto tempo antes os horários poderão ser mostrados."
              >
                <NativeSelect
                  value={prefs.minimum_notice_hours}
                  onChange={(value) =>
                    setPrefs({ ...prefs, minimum_notice_hours: Number(value) })
                  }
                  options={[
                    [0, "Sem antecedência"],
                    [1, "1 Hora"],
                    [2, "2 Horas"],
                    [4, "4 Horas"],
                    [12, "12 Horas"],
                    [24, "24 Horas"],
                  ]}
                />
              </SettingBlock>
            )}

            {selected === "listing" && (
              <SettingBlock
                title="Tempo de Listagem"
                description="Defina o intervalo usado para organizar a exibição dos horários."
              >
                <NativeSelect
                  value={prefs.listing_time_minutes}
                  onChange={(value) =>
                    setPrefs({ ...prefs, listing_time_minutes: Number(value) })
                  }
                  options={LISTING_OPTIONS}
                />
              </SettingBlock>
            )}

            {selected === "notify" && (
              <div>
                <h2 className="text-2xl font-medium tracking-[-0.025em] text-[#f4f5f7]">
                  Avisar Clientes
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#8b929d]">
                  Escolha quanto tempo de antecedência seu cliente recebe o lembrete.
                </p>

                <div className="mt-12 space-y-3">
                  <NativeSelect
                    value={prefs.reminder_hours_before}
                    onChange={(value) =>
                      setPrefs({
                        ...prefs,
                        notify_clients: true,
                        reminder_hours_before: Number(value),
                      })
                    }
                    options={MAIN_REMINDER_OPTIONS}
                  />
                  <div className="flex justify-end">
                    <Button onClick={() => save.mutate()} disabled={save.isPending}>
                      {save.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-[#25282c] bg-[#111316] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:p-5">
                  <h3 className="text-2xl font-medium tracking-[-0.025em] text-[#f4f5f7]">
                    Lembrete extra
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#a0a6af]">
                    Habilite e escolha com quanto tempo de antecedência seu cliente recebe o lembrete.
                  </p>

                  <div className="mt-5">
                    <NativeSelect
                      value={prefs.extra_reminder_minutes}
                      onChange={(value) =>
                        setPrefs({ ...prefs, extra_reminder_minutes: Number(value) })
                      }
                      options={EXTRA_REMINDER_OPTIONS}
                    />
                  </div>

                  <Textarea
                    className="mt-2 min-h-[270px] resize-y rounded-xl border-[#2a2d32] bg-[#17191d] px-4 py-4 text-sm leading-6 text-[#f4f5f7]"
                    value={prefs.extra_reminder_template}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        extra_reminder_template: e.target.value.slice(0, 800),
                      })
                    }
                    maxLength={800}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      ["Saudação", "{Saudacao}"],
                      ["Horário", "{Horario}"],
                      ["Cliente", "{Cliente}"],
                      ["Data", "{Data}"],
                    ].map(([label, token]) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => insertExtraToken(token)}
                        className="rounded-lg border border-[#2a2d32] bg-[#202226] px-4 py-2 text-xs font-medium text-[#b8bec7] transition-colors hover:border-[#1677ff]/40 hover:text-white"
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button onClick={() => save.mutate()} disabled={save.isPending}>
                      {save.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {selected === "timezone" && (
              <SettingBlock
                title="Fuso Horário"
                description="Defina o fuso usado como referência para a agenda."
              >
                <NativeSelect
                  value={prefs.timezone}
                  onChange={(timezone) => setPrefs({ ...prefs, timezone })}
                  options={[
                    ["America/Sao_Paulo", "Brasília / São Paulo"],
                    ["America/Manaus", "Manaus"],
                    ["America/Recife", "Recife"],
                    ["America/Cuiaba", "Cuiabá"],
                  ]}
                />
              </SettingBlock>
            )}

            {selected === "dates" && (
              <SettingBlock
                title="Listar Datas"
                description="Informe a quantidade de datas disponíveis para agendamento. (mínimo 7)"
              >
                <Input
                  type="number"
                  min={7}
                  max={365}
                  step={1}
                  value={prefs.list_dates_days}
                  onChange={(e) =>
                    setPrefs({ ...prefs, list_dates_days: Number(e.target.value) })
                  }
                  onBlur={() =>
                    setPrefs((current) => ({
                      ...current,
                      list_dates_days: Math.max(
                        7,
                        Math.min(365, Math.floor(Number(current.list_dates_days) || 15)),
                      ),
                    }))
                  }
                  className="h-12 rounded-xl border-[#2a2d32] bg-[#17191d] px-4 text-sm text-[#f4f5f7]"
                />
              </SettingBlock>
            )}
            {selected === "cancel" && (
              <ToggleSetting
                title="Cancelamentos"
                description="Permite usar recursos de cancelamento no fluxo do cliente."
                checked={prefs.cancellations}
                onChange={(cancellations) => setPrefs({ ...prefs, cancellations })}
              />
            )}
            {selected === "reschedule" && (
              <ToggleSetting
                title="Remarcar"
                description="Permite recursos de remarcação para os clientes."
                checked={prefs.reschedule}
                onChange={(reschedule) => setPrefs({ ...prefs, reschedule })}
              />
            )}
            {selected === "greeting" && (
              <SettingBlock
                title="Saudação"
                description="Edite a saudação pública do Painel 1 e o nome azul exibido no topo do Painel 2."
              >
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Saudação do Painel 1</label>
                    <Input
                      value={prefs.greeting}
                      onChange={(e) =>
                        setPrefs({ ...prefs, greeting: e.target.value.slice(0, 80) })
                      }
                      maxLength={80}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Nome da saudação do Painel 2
                    </label>
                    <Input
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value.slice(0, 40))}
                      maxLength={40}
                      placeholder="Ex.: Guilherme"
                    />
                  </div>
                </div>
              </SettingBlock>
            )}

            {selected !== "notify" && (
              <div className="mt-7 flex justify-end">
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function PreferenceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
        active
          ? "bg-[#1677ff]/15 font-semibold text-[#e9f2ff]"
          : "text-[#d0d4da] hover:bg-white/[0.035]"
      }`}
    >
      {children}
    </button>
  );
}

function SettingBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-2xl font-medium tracking-[-0.025em] text-[#f4f5f7]">{title}</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#8b929d]">{description}</p>
      <div className="mt-12">{children}</div>
    </div>
  );
}

function ToggleSetting({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <SettingBlock title={title} description={description}>
      <div className="flex items-center justify-between rounded-xl border border-[#2a2d32] bg-[#121417] px-4 py-4">
        <span className="text-sm text-[#d9dde3]">{checked ? "Ativado" : "Desativado"}</span>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </SettingBlock>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
}: {
  value: string | number;
  onChange: (value: string) => void;
  options: Array<readonly [string | number, string]>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-xl border border-[#2a2d32] bg-[#17191d] px-4 text-sm text-[#f4f5f7] outline-none focus:border-[#1677ff]/60"
    >
      {options.map(([optionValue, label]) => (
        <option key={String(optionValue)} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
