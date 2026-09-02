import { createFileRoute } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { SoonPage } from "@/components/painel/Soon";

export const Route = createFileRoute("/_authenticated/painel/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Agendaê" },
      { name: "description", content: "Preferências gerais do negócio e da página de agendamento." },
      { property: "og:title", content: "Configurações — Agendaê" },
      { property: "og:description", content: "Preferências gerais do negócio." },
    ],
  }),
  component: () => (
    <SoonPage
      title="Configurações"
      subtitle="Ajustes gerais do negócio e da página pública."
      icon={Settings2}
      bullets={["Logo e cores da página do cliente", "Política de cancelamento", "Regras de encaixe"]}
    />
  ),
});
