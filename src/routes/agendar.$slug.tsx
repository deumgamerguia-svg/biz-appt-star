import { createFileRoute } from "@tanstack/react-router";
import { PublicBookingPage } from "@/components/booking/PublicBookingPage";

export const Route = createFileRoute("/agendar/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Agendar horário — ${params.slug}` },
      {
        name: "description",
        content: "Escolha o serviço, o profissional, a data e confirme seu horário online.",
      },
      { property: "og:title", content: "Agende seu horário" },
      {
        property: "og:description",
        content: "Escolha o serviço, o profissional, a data e confirme seu horário online.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicBookingRoute,
});

function PublicBookingRoute() {
  const { slug } = Route.useParams();
  return <PublicBookingPage slug={slug} />;
}
