import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BellRing,
  Bookmark,
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
              <span className="integration-gold-icon">
                <MessageCircle className="size-[1.05rem]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 text-left">
                <span className="block text-[0.95rem] font-semibold text-[#ececef]">WhatsApp</span>
                <span className="mt-0.5 block text-xs text-[#6d6d76]">Conexão, mensagens e lembretes</span>
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-[#d5ad2b] transition-transform group-hover:translate-x-1" />
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
    <section className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-lg font-semibold tracking-[-0.02em] text-[#f0f0f2] transition hover:text-[#e4bd3b]"
        >
          <ArrowLeft className="size-5" />
          <span className="integration-gold-icon"><MessageCircle className="size-[1.05rem]" strokeWidth={1.8} /></span>
          Whatsapp
        </button>

        <button
          type="button"
          aria-label="Atualizar status"
          onClick={() => {
            void statusQuery.refetch();
            if (connected) void statsQuery.refetch();
          }}
          className="integration-gold-icon !size-10 transition hover:border-[#d8b229]/55 hover:text-[#f4cf4e]"
        >
          <RefreshCw className={`size-5 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm font-semibold text-[#ededee]">
        <span>Valor contratado:</span>
        <span className="rounded-lg border border-[#6a5210]/70 bg-[#211b09] px-3 py-1 text-[#efc52f]">R$ 0,00</span>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="mb-4 border border-[#34343a] bg-[#151518] text-[#ececef] shadow-none hover:border-[#6b5415] hover:bg-[#1b190f] hover:text-[#f4ce42]"
        onClick={() => {
          setShowConfig((value) => !value);
          if (!connected && !qrCode && !showConfig) connect.mutate();
        }}
        disabled={connect.isPending}
      >
        {connect.isPending ? <Loader2 className="size-4 animate-spin" /> : <Settings2 className="size-4" />}
        Configurar
      </Button>

      {showConfig && (
        <div className="mb-4 rounded-xl border border-[#2d2d32] bg-[#0e0e11] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
          {connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-emerald-400">WhatsApp conectado</p>
                <p className="mt-1 text-xs text-[#70717a]">A integração está ativa e os dados abaixo são atualizados automaticamente.</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
              >
                {disconnect.isPending ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
                Desconectar
              </Button>
            </div>
          ) : qrCode ? (
            <div className="space-y-3">
              <p className="text-sm text-[#b9bac1]">
                Abra o WhatsApp, acesse aparelhos conectados e leia o QR Code.
              </p>
              <div className="mx-auto flex w-fit justify-center rounded-xl bg-white p-3">
                <img src={qrCode} alt="QR Code para conectar o WhatsApp" className="w-56 max-w-full" />
              </div>
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={() => refreshQr.mutate()}>
                  {refreshQr.isPending ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
                  Gerar novo QR Code
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[#8c8d95]">WhatsApp desconectado.</p>
              <Button size="sm" onClick={() => connect.mutate()} disabled={connect.isPending}>
                <QrCode className="size-4" />
                Conectar
              </Button>
            </div>
          )}
        </div>
      )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="integration-gold-stat relative overflow-hidden p-4 sm:col-span-2">
          <MessageCircle className="absolute -right-2 -top-6 size-28 text-[#d8aa1f]/[0.07]" fill="currentColor" strokeWidth={1.2} />
          <div className="relative">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#777780]">
              <MessageSquareText className="size-5" />
              Mensagens enviadas
            </p>
            <p className="mt-7 text-2xl font-semibold tracking-[-0.035em] text-[#f2f2f4]">
              {messagesSent.toLocaleString("pt-BR")} Mensagens
            </p>
          </div>
        </div>

        <div className="integration-gold-stat relative overflow-hidden p-4">
          <Bookmark className="absolute -right-3 -top-2 size-24 text-[#d8aa1f]/[0.07]" fill="currentColor" strokeWidth={1.2} />
          <div className="relative">
            <p className="flex items-center gap-2 font-bold text-[#777780]">
              <BellRing className="size-5" />
              Lembretes enviados
            </p>
            <p className="mt-8 text-3xl font-black tracking-[-0.04em] drop-shadow-sm">
              {remindersSent.toLocaleString("pt-BR")} Lembretes
            </p>
          </div>
        </div>

        <div className="integration-gold-stat p-4">
          <p className="flex items-center gap-2 text-[1.05rem] font-semibold text-[#ececef]">
            <span className={`size-3 rounded-full ${connected ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]" : "bg-[#5e6067]"}`} />
            {connected ? "Ativo" : "Inativo"}
          </p>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-[#71727a]">Tempo online</p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <span className="text-xl font-semibold tracking-[-0.03em] text-[#f0f0f2]">{formattedOnline}</span>
            <span className="text-sm font-semibold text-[#6c6d74]">/h</span>
          </div>
        </div>
      </div>

      <div className="integration-gold-panel mt-3 overflow-hidden p-0">
        <div className="relative z-10 flex items-center justify-between gap-3 border-b border-[#27272c] px-4 py-3.5">
          <p className="flex items-center gap-2 text-[0.95rem] font-semibold text-[#ececef]">
            <CheckCheck className="size-6" />
            Mensagens pendentes
          </p>
          <span className="rounded-full border border-[#62501a] bg-[#211b09] px-2 py-0.5 text-xs font-semibold text-[#dcb62f]">
            {pendingCount}
          </span>
        </div>

        <div className="relative z-10 min-h-32 bg-[#0b0b0e] p-4">
          <div className="grid grid-cols-[1fr_1fr] gap-3 border-b border-[#25252a] pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#71727a]">
            <span>Nome</span>
            <span>Telefone</span>
          </div>

          {pending.length ? (
            <div className="divide-y divide-[#222227]">
              {pending.map((appointment) => (
                <div key={appointment.id} className="grid grid-cols-[1fr_1fr] gap-3 py-3 text-xs font-medium text-[#c8c9cf]">
                  <span className="truncate">{appointment.customer_name}</span>
                  <span className="truncate">{appointment.customer_phone || "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-24 items-center justify-center text-center text-xs font-medium text-[#62636b]">
              {connected ? "Nenhuma mensagem pendente" : "Conecte o WhatsApp para carregar os dados"}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
