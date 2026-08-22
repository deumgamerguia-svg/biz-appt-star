import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Users, Scissors, Stethoscope, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agendaê — agenda online para barbearias, salões e consultórios" },
      {
        name: "description",
        content:
          "Organize horários, serviços, profissionais e clientes do seu negócio em um painel simples. Comece grátis em minutos.",
      },
      { property: "og:title", content: "Agendaê — agenda online para o seu negócio" },
      {
        property: "og:description",
        content:
          "Painel de agendamentos para barbearias, salões, consultórios e clínicas. Tudo em um só lugar.",
      },
    ],
  }),
  component: Home,
});

const features = [
  {
    icon: CalendarDays,
    title: "Agenda do dia",
    text: "Veja todos os horários marcados, confirme, conclua ou cancele em um clique.",
  },
  {
    icon: Users,
    title: "Equipe e clientes",
    text: "Cadastre profissionais, mantenha o histórico dos clientes e o contato sempre à mão.",
  },
  {
    icon: ShieldCheck,
    title: "Cada negócio isolado",
    text: "Gerencie várias unidades na mesma conta, com dados totalmente separados.",
  },
];

function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen hero-wash">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-extrabold tracking-tight">
          Agenda<span className="text-primary">ê</span>
        </span>
        <nav className="flex items-center gap-2">
          {!loading && user ? (
            <Button asChild>
              <Link to="/painel">Ir para o painel</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/auth">Entrar</Link>
              </Button>
              <Button asChild>
                <Link to="/auth" search={{ modo: "cadastro" }}>
                  Criar conta
                </Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-2 lg:pt-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Scissors className="size-3.5 text-primary" /> Barbearias
              <Stethoscope className="size-3.5 text-primary" /> Consultórios
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">
              A agenda do seu negócio, organizada de verdade.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              Um painel simples para controlar horários, serviços, profissionais e clientes — feito
              para comércios e empresas que vivem de atendimento marcado.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth" search={{ modo: "cadastro" }}>
                  Começar agora <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Já tenho conta</Link>
              </Button>
            </div>
          </div>

          <div className="surface grid-canvas p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Hoje
            </p>
            <div className="mt-4 space-y-3">
              {[
                { h: "09:00", n: "Marina Alves", s: "Limpeza de pele", c: "bg-primary" },
                { h: "10:30", n: "Rafael Costa", s: "Corte + barba", c: "bg-success" },
                { h: "14:00", n: "Dra. Helena", s: "Avaliação odontológica", c: "bg-warning" },
              ].map((item) => (
                <div
                  key={item.h}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
                >
                  <span className={`h-10 w-1.5 rounded-full ${item.c}`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{item.n}</p>
                    <p className="text-xs text-muted-foreground">{item.s}</p>
                  </div>
                  <span className="font-display text-sm font-bold">{item.h}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="surface p-6">
              <f.icon className="size-6 text-primary" />
              <h2 className="mt-4 text-lg font-bold">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Agendaê — agendamento para comércios e empresas.
      </footer>
    </div>
  );
}
