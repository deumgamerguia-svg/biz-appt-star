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
  Cpu,
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
      <h1 className="mb-6 text-2xl font-bold tracking-[-0.03em] text-[#f6f7f9]">
        Integrações externas
      </h1>

      <div className="space-y-2">
        <button
          type="button"
          onClick={onOpenWhatsapp}
          className="group flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-[#34373c] px-4 py-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition hover:border-emerald-400/25 hover:bg-[#3a3e43]"
        >
          <span className="flex items-center gap-3">
            <MessageCircle className="size-7 text-emerald-400" strokeWidth={1.9} />
            <span className="text-lg font-medium text-white">Whatsapp</span>
          </span>
          <ChevronRight className="size-8 text-emerald-400 transition-transform group-hover:translate-x-1" />
        </button>

        <div className="flex min-h-[64px] items-center justify-between rounded-xl border border-white/[0.06] bg-[#34373c] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
          <span className="flex items-center gap-3">
            <MessageSquareText className="size-7 text-[#fff47a]" strokeWidth={1.9} />
            <span className="text-lg font-medium text-white">SMS</span>
          </span>
          <span className="text-right font-semibold leading-tight text-emerald-400">
            <span className="block text-base">Obter</span>
            <span className="text-xs">R$ 0,10/msg</span>
          </span>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#34373c] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
          <span className="flex items-center gap-3">
            <Cpu className="size-7 text-cyan-400" strokeWidth={1.9} />
            <span className="text-lg font-medium text-white">IA</span>
          </span>
        </div>

        <div className="mt-5 w-fit rounded-lg bg-[#484b50] px-3 py-1.5 text-xs font-semibold text-white">
          Em breve...
        </div>

        <div className="flex min-h-[64px] items-center justify-between rounded-xl border border-white/[0.06] bg-[#34373c] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
          <span className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-[#dedede] text-xl font-bold text-[#71757b]">
              G
            </span>
            <span className="text-lg font-medium text-[#d6d7d9]">Google</span>
          </span>
          <span className="text-right font-semibold leading-tight text-emerald-400">
            <span className="block text-base">Obter</span>
            <span className="text-xs">Gratuito</span>
          </span>
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
          className="flex items-center gap-2 text-lg font-medium text-white transition hover:text-emerald-300"
        >
          <ArrowLeft className="size-5" />
          <MessageCircle className="size-7 text-emerald-400" />
          Whatsapp
        </button>

        <button
          type="button"
          aria-label="Atualizar status"
          onClick={() => {
            void statusQuery.refetch();
            if (connected) void statsQuery.refetch();
          }}
          className="flex size-10 items-center justify-center rounded-full bg-[#d83a48] text-white transition hover:brightness-110"
        >
          <RefreshCw className={`size-5 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 text-base font-semibold text-white">
        <span>Valor contratado:</span>
        <span className="rounded-lg bg-[#4b4e51] px-3 py-1 text-emerald-400">R$ 0,00</span>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="mb-4 bg-[#484b50] text-white hover:bg-[#55595e]"
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
        <div className="mb-4 rounded-xl border border-white/[0.08] bg-[#34373c] p-4">
          {connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-emerald-400">WhatsApp conectado</p>
                <p className="mt-1 text-xs text-[#b6b8bb]">A integração está ativa e os dados abaixo são atualizados automaticamente.</p>
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
              <p className="text-sm text-[#d7d9db]">
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
              <p className="text-sm text-[#c4c7ca]">WhatsApp desconectado.</p>
              <Button size="sm" onClick={() => connect.mutate()} disabled={connect.isPending}>
                <QrCode className="size-4" />
                Conectar
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_176px]">
        <div className="relative overflow-hidden rounded-xl bg-[#22d467] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] sm:col-span-2">
          <MessageCircle className="absolute -right-1 -top-5 size-28 text-emerald-800/30" fill="currentColor" strokeWidth={1.2} />
          <div className="relative">
            <p className="flex items-center gap-2 font-bold text-emerald-900/70">
              <MessageSquareText className="size-5" />
              Mensagens enviadas
            </p>
            <p className="mt-8 text-3xl font-black tracking-[-0.04em] drop-shadow-sm">
              {messagesSent.toLocaleString("pt-BR")} Mensagens
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-[#22d467] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
          <Bookmark className="absolute -right-3 -top-2 size-24 text-emerald-800/30" fill="currentColor" strokeWidth={1.2} />
          <div className="relative">
            <p className="flex items-center gap-2 font-bold text-emerald-900/70">
              <BellRing className="size-5" />
              Lembretes enviados
            </p>
            <p className="mt-8 text-3xl font-black tracking-[-0.04em] drop-shadow-sm">
              {remindersSent.toLocaleString("pt-BR")} Lembretes
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-[#4a4c50] p-4 text-white">
          <p className="flex items-center gap-2 text-xl font-black">
            <span className={`size-5 rounded-full ${connected ? "bg-[#54ec6b]" : "bg-[#777b80]"}`} />
            {connected ? "Ativo" : "Inativo"}
          </p>
          <p className="mt-4 text-base font-bold">Tempo online</p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <span className="text-xl font-black">{formattedOnline}</span>
            <span className="text-xl font-black">/h</span>
          </div>
        </div>
      </div>

      <div className="mt-2 rounded-xl border-[8px] border-white bg-white text-[#8b8d90]">
        <div className="flex items-center justify-between gap-3 px-1 pb-3 pt-1">
          <p className="flex items-center gap-2 text-lg font-bold">
            <CheckCheck className="size-6" />
            Mensagens pendentes
          </p>
          <span className="rounded-full bg-[#ededed] px-2 py-0.5 text-xs font-semibold text-[#777]">
            {pendingCount}
          </span>
        </div>

        <div className="min-h-32 rounded-lg bg-[#a3a4a6] p-3 text-white">
          <div className="grid grid-cols-[1fr_1fr] gap-3 border-b border-white/25 pb-2 text-xs font-bold">
            <span>Nome</span>
            <span>Telefone</span>
          </div>

          {pending.length ? (
            <div className="divide-y divide-white/15">
              {pending.map((appointment) => (
                <div key={appointment.id} className="grid grid-cols-[1fr_1fr] gap-3 py-2 text-xs font-medium">
                  <span className="truncate">{appointment.customer_name}</span>
                  <span className="truncate">{appointment.customer_phone || "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-20 items-center justify-center text-center text-xs font-semibold text-white/70">
              {connected ? "Nenhuma mensagem pendente" : "Conecte o WhatsApp para carregar os dados"}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
