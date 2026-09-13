import { createFileRoute } from "@tanstack/react-router";
import { ShoppingBasket } from "lucide-react";
import { SoonPage } from "@/components/painel/Soon";

export const Route = createFileRoute("/_authenticated/painel/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — Agenda Agora�" },
      { name: "description", content: "Produtos vendidos no balcão e controle de estoque." },
      { property: "og:title", content: "Produtos — Agenda Agora�" },
      { property: "og:description", content: "Produtos e estoque do negócio." },
    ],
  }),
  component: () => (
    <SoonPage
      title="Produtos"
      subtitle="Venda produtos junto com os atendimentos."
      icon={ShoppingBasket}
      bullets={["Cadastro com preço e estoque", "Venda vinculada ao agendamento", "Alertas de estoque baixo"]}
    />
  ),
});
