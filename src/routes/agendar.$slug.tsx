import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookingThemeBridge } from "@/components/booking/BookingThemeBridge";

const PublicBookingPage = lazy(() =>
  import("@/components/booking/PublicBookingPage").then((module) => ({
    default: module.PublicBookingPage,
  })),
);

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
  return (
    <>
      <BookingThemeBridge />
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <PublicBookingPage slug={slug} />
      </Suspense>
    </>
  );
}
