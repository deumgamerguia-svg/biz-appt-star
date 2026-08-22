import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function NoBusiness() {
  return (
    <div className="surface flex flex-col items-center p-10 text-center">
      <Store className="size-8 text-primary" />
      <h2 className="mt-4 text-lg font-bold">Cadastre seu primeiro negócio</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Crie a barbearia, o salão ou o consultório para começar a organizar a agenda.
      </p>
      <Button asChild className="mt-5">
        <Link to="/painel/negocios">Criar negócio</Link>
      </Button>
    </div>
  );
}

export function EmptyList({ text }: { text: string }) {
  return (
    <div className="surface p-10 text-center text-sm text-muted-foreground">{text}</div>
  );
}
