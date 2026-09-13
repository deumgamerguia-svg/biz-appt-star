import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { SoonPage } from "@/components/painel/Soon";

export const Route = createFileRoute("/_authenticated/painel/assinatura")({
  head: () => ({
    meta: [
      { title: "Assinatura â€” Agenda Agora­" },
      { name: "description", content: "Plano mensal, faturas e forma de pagamento da sua conta." },
      { property: "og:title", content: "Assinatura â€” Agenda Agora­" },
      { property: "og:description", content: "Plano mensal e faturas da sua conta." },
    ],
  }),
  component: () => (
    <SoonPage
      title="Assinatura"
      subtitle="Seu plano mensal do Agenda Agora­."
      icon={CreditCard}
      bullets={["Plano ativo e vencimento", "HistÃ³rico de faturas", "Trocar forma de pagamento"]}
    />
  ),
});
