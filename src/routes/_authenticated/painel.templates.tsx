import { createFileRoute } from "@tanstack/react-router";
import { MessageSquareText } from "lucide-react";
import { SoonPage } from "@/components/painel/Soon";

export const Route = createFileRoute("/_authenticated/painel/templates")({
  head: () => ({
    meta: [
      { title: "Templates — Agenda Agora" },
      { name: "description", content: "Mensagens automáticas de confirmação e lembrete." },
      { property: "og:title", content: "Templates — Agenda Agora" },
      { property: "og:description", content: "Mensagens automáticas para clientes." },
    ],
  }),
  component: () => (
    <SoonPage
      title="Templates"
      subtitle="Mensagens automáticas enviadas aos clientes."
      icon={MessageSquareText}
      bullets={["Confirmação de agendamento", "Lembrete 24h antes", "Pesquisa pós-atendimento"]}
    />
  ),
});
