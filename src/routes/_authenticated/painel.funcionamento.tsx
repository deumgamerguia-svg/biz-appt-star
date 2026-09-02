import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { SoonPage } from "@/components/painel/Soon";

export const Route = createFileRoute("/_authenticated/painel/funcionamento")({
  head: () => ({
    meta: [
      { title: "Funcionamento — Agendaê" },
      { name: "description", content: "Dias e horários de atendimento do seu negócio." },
      { property: "og:title", content: "Funcionamento — Agendaê" },
      { property: "og:description", content: "Dias e horários de atendimento." },
    ],
  }),
  component: () => (
    <SoonPage
      title="Funcionamento"
      subtitle="Dias e horários em que o negócio atende."
      icon={CalendarCheck}
      bullets={["Horário por dia da semana", "Intervalo de almoço", "Duração padrão dos encaixes"]}
    />
  ),
});
