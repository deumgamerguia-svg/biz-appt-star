import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { SoonPage } from "@/components/painel/Soon";

export const Route = createFileRoute("/_authenticated/painel/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações — Agenda Agora" },
      { name: "description", content: "Conecte WhatsApp, agenda externa e outras ferramentas." },
      { property: "og:title", content: "Integrações — Agenda Agora" },
      { property: "og:description", content: "WhatsApp e outras ferramentas conectadas." },
    ],
  }),
  component: () => (
    <SoonPage
      title="Integrações"
      subtitle="Conecte o Agenda Agora às ferramentas que você já usa."
      icon={Plus}
      bullets={["WhatsApp para confirmações", "Google Agenda", "Webhooks para sistemas próprios"]}
    />
  ),
});
