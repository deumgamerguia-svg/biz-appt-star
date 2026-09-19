import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BellRing,
  CheckCheck,
  ChevronRight,
  Loader2,
  MessageCircle,
  MessageSquareText,
  QrCode,
  RefreshCw,
  Settings2,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NoBusiness } from "@/components/painel/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import {
  connectWhatsapp,
  disconnectWhatsapp,
  getWhatsappStatus,
  refreshWhatsappQr,
} from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/painel/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações — Agenda Agora" },
      { name: "description", content: "Conecte WhatsApp, agenda externa e outras ferramentas." },
      { property: "og:title", content: "Integrações — Agenda Agora" },
      { property: "og:description", content: "WhatsApp e outras ferramentas conectadas." },
    ],
  }),
  component: IntegracoesPage,
});

function IntegracoesPage() {
  const { businessId } = useBusiness();
  const [openWhatsapp, setOpenWhatsapp] = useState(false);

  if (!businessId) return <NoBusiness />;

  return (
    <div className="mx-auto w-full max-w-3xl">
      {openWhatsapp ? (
        <WhatsappIntegration businessId={businessId} onBack={() => setOpenWhatsapp(false)} />
      ) : (
        <IntegrationsList onOpenWhatsapp={() => setOpenWhatsapp(true)} />
      )}
    </div>
  );
}

function IntegrationsList({ onOpenWhatsapp }: { onOpenWhatsapp: () => void }) {
  return (
    <section className="mx-auto max-w-2xl">
      <div className="integration-gold-panel p-4 sm:p-5">
        <div className="relative z-10">
          <div className="mb-5 flex items-start gap-3">
            <div className="integration-gold-icon">
              <Settings2 className="size-[1.05rem]" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-[-0.025em] text-[#f4f4f5]">
                Integrações externas
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-[#74747d]">
                Conecte os canais externos usados pelo seu negócio.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenWhatsapp}
            className="integration-gold-row group w-full"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="integration-gold-icon integration-whatsapp-icon">
                <MessageCircle className="size-[1.05rem]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 text-left">
                <span className="block text-[0.95rem] font-semibold text-[#ececef]">WhatsApp</span>
                <span className="mt-0.5 block text-xs text-[#6d6d76]">Conexão, mensagens e lembretes</span>
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-[#25D366] transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </section>
  );
}

function WhatsappIntegration({
  businessId,
  onBack,
}: {
  businessId: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [connectedSince, setConnectedSince] = useState<number | null>(null);
  const [onlineSeconds, setOnlineSeconds] = useState(0);

  const connectFn = useServerFn(connectWhatsapp);
  const refreshFn = useServerFn(refreshWhatsappQr);
  const statusFn = useServerFn(getWhatsappStatus);
  const disconnectFn = useServerFn(disconnectWhatsapp);

  const statusQuery = useQuery({
    queryKey: ["integrations-whatsapp-status", businessId],
    queryFn: () => statusFn({ data: { businessId } }),
    refetchInterval: 5000,
  });

  const status = statusQuery.data?.status ?? "desconectado";
  const connected = status === "conectado";

  useEffect(() => {
    if (connected) {
      setConnectedSince((current) => current ?? Date.now());
      return;
    }
    setConnectedSince(null);
    setOnlineSeconds(0);
  }, [connected]);

  useEffect(() => {
    if (!connected || connectedSince === null) return;
    const update = () => setOnlineSeconds(Math.max(0, Math.floor((Date.now() - connectedSince) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [connected, connectedSince]);

  const statsQuery = useQuery({
    queryKey: ["integrations-whatsapp-stats", businessId],
    enabled: connected,
    refetchInterval: connected ? 15000 : false,
    queryFn: async () => {
      const now = new Date().toISOString();

      const [
        sentResult,
        remindersResult,
        appointmentsResult,
      ] = await Promise.all([
        supabase
          .from("reminder_logs")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("status", "enviado"),
        supabase
          .from("reminder_logs")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("status", "enviado")
          .in("channel", ["whatsapp", "whatsapp_extra"]),
        supabase
          .from("appointments")
          .select("id, customer_name, customer_phone, starts_at, status")
          .eq("business_id", businessId)
          .in("status", ["agendado", "confirmado"])
          .gte("starts_at", now)
          .order("starts_at", { ascending: true })
          .limit(100),
      ]);

      if (sentResult.error) throw sentResult.error;
      if (remindersResult.error) throw remindersResult.error;
      if (appointmentsResult.error) throw appointmentsResult.error;

      const appointments = appointmentsResult.data ?? [];
      const appointmentIds = appointments.map((appointment) => appointment.id);
      let sentAppointmentIds = new Set<string>();

      if (appointmentIds.length) {
        const sentAppointments = await supabase
          .from("reminder_logs")
          .select("appointment_id")
          .eq("business_id", businessId)
          .eq("status", "enviado")
          .in("appointment_id", appointmentIds);

        if (sentAppointments.error) throw sentAppointments.error;
        sentAppointmentIds = new Set(
          (sentAppointments.data ?? []).map((row) => row.appointment_id),
        );
      }

      return {
        messagesSent: sentResult.count ?? 0,
        remindersSent: remindersResult.count ?? 0,
        pending: appointments
          .filter((appointment) => !sentAppointmentIds.has(appointment.id))
          .slice(0, 8),
      };
    },
  });

  const connect = useMutation({
    mutationFn: () => connectFn({ data: { businessId } }),
    onSuccess: (data) => {
      setQrCode(data.qrCode);
      setShowConfig(true);
      void queryClient.invalidateQueries({ queryKey: ["integrations-whatsapp-status", businessId] });
      if (data.alreadyConnected) toast.success("WhatsApp já está conectado.");
      else if (!data.qrCode) toast.info("Instância criada. Gere o QR Code.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refreshQr = useMutation({
    mutationFn: () => refreshFn({ data: { businessId } }),
    onSuccess: (data) => {
      setQrCode(data.qrCode);
      if (!data.qrCode) toast.info("QR Code indisponível no momento.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectFn({ data: { businessId } }),
    onSuccess: () => {
      setQrCode(null);
      setShowConfig(false);
      void queryClient.invalidateQueries({ queryKey: ["integrations-whatsapp-status", businessId] });
      void queryClient.removeQueries({ queryKey: ["integrations-whatsapp-stats", businessId] });
      toast.success("WhatsApp desconectado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const messagesSent = connected ? statsQuery.data?.messagesSent ?? 0 : 0;
  const remindersSent = connected ? statsQuery.data?.remindersSent ?? 0 : 0;
  const pending = connected ? statsQuery.data?.pending ?? [] : [];
  const pendingCount = pending.length;

  const formattedOnline = useMemo(() => {
    if (!connected) return "00:00:00";
    const hours = Math.floor(onlineSeconds / 3600);
    const minutes = Math.floor((onlineSeconds % 3600) / 60);
    const seconds = onlineSeconds % 60;
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }, [connected, onlineSeconds]);

  return (
    <section className="mx-auto max-w-2xl space-y-3">
      <div className="integration-gold-panel p-4 sm:p-5">
        <div className="relative z-10">
          <div className="mb-5 flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex min-w-0 items-center gap-3 text-left"
            >
              <ArrowLeft className="size-4 shrink-0 text-[#8b8b93]" />
              <span className="integration-gold-icon integration-whatsapp-icon">
                <MessageCircle className="size-[1.05rem]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold tracking-[-0.025em] text-[#f1f1f3]">
                    WhatsApp
                  </span>
                  <span className="rounded-full border border-[#313137] bg-[#17171a] px-2.5 py-1 text-[0.63rem] font-semibold text-[#8a8a92]">
                    Integração externa
                  </span>
                </span>
                <span className="mt-1 block text-xs text-[#6f7078]">
                  Mensagens, lembretes e conexão do seu número
                </span>
              </span>
            </button>

            <button
              type="button"
              aria-label="Atualizar status"
              onClick={() => {
                void statusQuery.refetch();
                if (connected) void statsQuery.refetch();
              }}
              className="integration-gold-icon !size-10 shrink-0 transition hover:border-[#1677ff]/60 hover:text-[#78adff]"
            >
              <RefreshCw className={`size-4 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold ${
                connected
                  ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-300"
                  : "border-[#1677ff]/30 bg-[#1677ff]/[0.08] text-[#77aaff]"
              }`}
            >
              {connected ? "Conectado" : status === "conectando" ? "Conectando" : "Desconectado"}
            </span>
            <span className="rounded-full border border-[#2f2f34] bg-[#151518] px-2.5 py-1 text-[0.68rem] font-medium text-[#777780]">
              Valor contratado R$ 0,00
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="integration-dark-button"
              onClick={() => {
                setShowConfig((value) => !value);
                if (!connected && !qrCode && !showConfig) connect.mutate();
              }}
              disabled={connect.isPending}
            >
              {connect.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Settings2 className="size-4" />
              )}
              Configurar
            </Button>

            {!connected && (
              <Button
                type="button"
                className="integration-whatsapp-button"
                onClick={() => connect.mutate()}
                disabled={connect.isPending}
              >
                <QrCode className="size-4" />
                Conectar
              </Button>
            )}
          </div>

          {showConfig && (
            <div className="mt-4 rounded-xl border border-[#2b2b30] bg-[#0d0d10] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
              {connected ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#e7e7e9]">WhatsApp conectado</p>
                    <p className="mt-1 text-xs text-[#6e6f77]">
                      A integração está ativa e os dados abaixo são atualizados automaticamente.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => disconnect.mutate()}
                    disabled={disconnect.isPending}
                  >
                    {disconnect.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Unplug className="size-4" />
                    )}
                    Desconectar
                  </Button>
                </div>
              ) : qrCode ? (
                <div className="space-y-3">
                  <p className="text-sm text-[#aaaab1]">
                    Abra o WhatsApp, acesse aparelhos conectados e leia o QR Code.
                  </p>
                  <div className="mx-auto flex w-fit justify-center rounded-xl bg-white p-3">
                    <img
                      src={qrCode}
                      alt="QR Code para conectar o WhatsApp"
                      className="w-56 max-w-full"
                    />
                  </div>
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refreshQr.mutate()}
                      className="integration-dark-button"
                    >
                      {refreshQr.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <QrCode className="size-4" />
                      )}
                      Gerar novo QR Code
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#777780]">WhatsApp desconectado.</p>
              )}
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="integration-gold-stat p-4">
              <div className="integration-gold-icon !size-9">
                <MessageSquareText className="size-4" />
              </div>
              <p className="mt-4 text-[0.63rem] font-semibold uppercase tracking-[0.16em] text-[#6d6e76]">
                Mensagens enviadas
              </p>
              <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#f0f0f2]">
                {messagesSent.toLocaleString("pt-BR")}
              </p>
            </div>

            <div className="integration-gold-stat p-4">
              <div className="integration-gold-icon !size-9">
                <BellRing className="size-4" />
              </div>
              <p className="mt-4 text-[0.63rem] font-semibold uppercase tracking-[0.16em] text-[#6d6e76]">
                Lembretes enviados
              </p>
              <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#f0f0f2]">
                {remindersSent.toLocaleString("pt-BR")}
              </p>
            </div>

            <div className="integration-gold-stat p-4">
              <div className="integration-gold-icon !size-9">
                <CheckCheck className="size-4" />
              </div>
              <p className="mt-4 text-[0.63rem] font-semibold uppercase tracking-[0.16em] text-[#6d6e76]">
                Status
              </p>
              <p className="mt-2 flex items-center gap-2 text-base font-semibold text-[#f0f0f2]">
                <span
                  className={`size-2.5 rounded-full ${
                    connected
                      ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]"
                      : "bg-[#55575e]"
                  }`}
                />
                {connected ? "Ativo" : "Inativo"}
              </p>
            </div>

            <div className="integration-gold-stat p-4">
              <div className="integration-gold-icon !size-9">
                <RefreshCw className="size-4" />
              </div>
              <p className="mt-4 text-[0.63rem] font-semibold uppercase tracking-[0.16em] text-[#6d6e76]">
                Tempo online
              </p>
              <p className="mt-2 text-base font-semibold tracking-[-0.02em] text-[#f0f0f2]">
                {formattedOnline}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="integration-gold-panel overflow-hidden p-0">
        <div className="relative z-10 flex items-center justify-between gap-3 border-b border-[#27272c] px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="integration-gold-icon !size-9">
              <MessageSquareText className="size-4" />
            </div>
            <div>
              <p className="text-[0.95rem] font-semibold text-[#ececef]">Mensagens pendentes</p>
              <p className="mt-0.5 text-xs text-[#666770]">
                Acompanhe os envios que ainda aguardam processamento.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-[#1677ff]/30 bg-[#1677ff]/[0.08] px-2 py-0.5 text-xs font-semibold text-[#76aaff]">
            {pendingCount}
          </span>
        </div>

        <div className="relative z-10 min-h-40 bg-[#0b0b0e] p-4">
          <div className="grid grid-cols-[1fr_1fr] gap-3 border-b border-[#25252a] pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#71727a]">
            <span>Nome</span>
            <span>Telefone</span>
          </div>

          {pending.length ? (
            <div className="divide-y divide-[#222227]">
              {pending.map((appointment) => (
                <div
                  key={appointment.id}
                  className="grid grid-cols-[1fr_1fr] gap-3 py-3 text-xs font-medium text-[#c8c9cf]"
                >
                  <span className="truncate">{appointment.customer_name}</span>
                  <span className="truncate">{appointment.customer_phone || "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-28 flex-col items-center justify-center text-center">
              <div className="integration-gold-icon !size-12">
                <MessageSquareText className="size-5" />
              </div>
              <p className="mt-4 text-sm font-semibold text-[#d9d9dc]">
                {connected ? "Nenhuma mensagem pendente" : "Nenhum dado disponível"}
              </p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#5f6068]">
                {connected
                  ? "Os próximos envios aparecerão aqui."
                  : "Conecte o WhatsApp para carregar mensagens e lembretes."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
