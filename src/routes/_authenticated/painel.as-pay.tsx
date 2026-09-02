import { createFileRoute } from "@tanstack/react-router";
import { Gem } from "lucide-react";
import { SoonPage } from "@/components/painel/Soon";

export const Route = createFileRoute("/_authenticated/painel/as-pay")({
  head: () => ({
    meta: [
      { title: "AS Pay — Agendaê" },
      { name: "description", content: "Recebimentos e pagamentos digitais do seu negócio." },
      { property: "og:title", content: "AS Pay — Agendaê" },
      { property: "og:description", content: "Recebimentos digitais do seu negócio." },
    ],
  }),
  component: () => (
    <SoonPage
      title="AS Pay"
      subtitle="Receba pelos atendimentos direto na agenda."
      icon={Gem}
      bullets={["Cobrança de sinal no agendamento", "Pix e cartão", "Extrato de recebimentos"]}
    />
  ),
});
