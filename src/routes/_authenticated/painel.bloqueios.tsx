import { createFileRoute } from "@tanstack/react-router";
import { CircleX } from "lucide-react";
import { SoonPage } from "@/components/painel/Soon";

export const Route = createFileRoute("/_authenticated/painel/bloqueios")({
  head: () => ({
    meta: [
      { title: "Horários bloqueados — Agendaê" },
      { name: "description", content: "Bloqueie horários pontuais ou recorrentes na agenda." },
      { property: "og:title", content: "Horários bloqueados — Agendaê" },
      { property: "og:description", content: "Bloqueios pontuais e recorrentes." },
    ],
  }),
  component: () => (
    <SoonPage
      title="Horários bloqueados"
      subtitle="Feche horários que não podem ser agendados."
      icon={CircleX}
      bullets={["Bloqueio pontual por data", "Bloqueio recorrente por dia da semana", "Motivo visível na agenda"]}
    />
  ),
});
