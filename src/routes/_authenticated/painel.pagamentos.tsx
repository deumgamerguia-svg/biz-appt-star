import { createFileRoute } from "@tanstack/react-router";
import { DollarSign } from "lucide-react";
import { SoonPage } from "@/components/painel/Soon";

export const Route = createFileRoute("/_authenticated/painel/pagamentos")({
  head: () => ({
    meta: [
      { title: "Pagamentos — Agendaê" },
      { name: "description", content: "Formas de pagamento aceitas e pagamentos recebidos." },
      { property: "og:title", content: "Pagamentos — Agendaê" },
      { property: "og:description", content: "Formas de pagamento do negócio." },
    ],
  }),
  component: () => (
    <SoonPage
      title="Pagamentos"
      subtitle="Formas de pagamento aceitas no atendimento."
      icon={DollarSign}
      bullets={["Dinheiro, Pix, débito e crédito", "Taxas por bandeira", "Baixa de pagamento na agenda"]}
    />
  ),
});
