import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { SoonPage } from "@/components/painel/Soon";

export const Route = createFileRoute("/_authenticated/painel/assinatura")({
  head: () => ({
    meta: [
      { title: "Assinatura — Agenda Aí" },
      { name: "description", content: "Plano mensal, faturas e forma de pagamento da sua conta." },
      { property: "og:title", content: "Assinatura — Agenda Aí" },
      { property: "og:description", content: "Plano mensal e faturas da sua conta." },
    ],
  }),
  component: () => (
    <SoonPage
      title="Assinatura"
      subtitle="Seu plano mensal do Agenda Aí."
      icon={CreditCard}
      bullets={["Plano ativo e vencimento", "Histórico de faturas", "Trocar forma de pagamento"]}
    />
  ),
});
