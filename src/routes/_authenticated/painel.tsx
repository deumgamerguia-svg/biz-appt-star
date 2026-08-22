import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Users, Scissors, Store, UserRound, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/lib/business";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Agendaê" },
      { name: "description", content: "Gerencie a agenda, os serviços e os clientes do negócio." },
      { property: "og:title", content: "Painel — Agendaê" },
      { property: "og:description", content: "Gerencie a agenda do seu negócio." },
    ],
  }),
  component: PainelLayout,
});

const nav = [
  { to: "/painel", label: "Agenda", icon: CalendarDays, exact: true },
  { to: "/painel/servicos", label: "Serviços", icon: Scissors },
  { to: "/painel/profissionais", label: "Profissionais", icon: UserRound },
  { to: "/painel/clientes", label: "Clientes", icon: Users },
  { to: "/painel/negocios", label: "Negócios", icon: Store },
] as const;

function PainelLayout() {
  const { user, signOut } = useAuth();
  const { businesses, businessId, setBusinessId } = useBusiness();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/40 lg:flex">
      <aside
        className={`${open ? "block" : "hidden"} border-b border-sidebar-border bg-sidebar p-4 lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r`}
      >
        <Link to="/" className="block px-2 font-display text-xl font-extrabold">
          Agenda<span className="text-primary">ê</span>
        </Link>

        <div className="mt-5">
          <Select value={businessId ?? undefined} onValueChange={setBusinessId}>
            <SelectTrigger className="w-full bg-card">
              <SelectValue placeholder="Nenhum negócio" />
            </SelectTrigger>
            <SelectContent>
              {businesses.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <nav className="mt-5 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: "exact" in item ? item.exact : false }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              activeProps={{
                className:
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold bg-sidebar-accent text-sidebar-accent-foreground",
              }}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 border-t border-sidebar-border pt-4">
          <p className="truncate px-3 text-xs text-muted-foreground">{user?.email}</p>
          <Button
            variant="ghost"
            className="mt-2 w-full justify-start"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/" });
            }}
          >
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
          <span className="font-display font-extrabold">
            Agenda<span className="text-primary">ê</span>
          </span>
          <Button variant="outline" size="icon" onClick={() => setOpen((v) => !v)}>
            <Menu className="size-4" />
          </Button>
        </div>
        <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
