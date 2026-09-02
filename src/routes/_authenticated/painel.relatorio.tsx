import { createFileRoute } from "@tanstack/react-router";
import { PieChart } from "lucide-react";
import { SoonPage } from "@/components/painel/Soon";

export const Route = createFileRoute("/_authenticated/painel/relatorio")({
  head: () => ({
    meta: [
      { title: "Relatório — Agendaê" },
      { name: "description", content: "Desempenho de atendimentos, faturamento e ocupação." },
      { property: "og:title", content: "Relatório — Agendaê" },
      { property: "og:description", content: "Desempenho e faturamento do negócio." },
    ],
  }),
  component: () => (
    <SoonPage
      title="Relatório"
      subtitle="Acompanhe faturamento, ocupação e retorno de clientes."
      icon={PieChart}
      bullets={["Faturamento por período", "Serviços mais vendidos", "Ocupação por profissional"]}
    />
  ),
});
