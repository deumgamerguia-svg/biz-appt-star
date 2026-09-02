import type { LucideIcon } from "lucide-react";
import { PageHeader } from "./PageHeader";

export function SoonPage({
  title,
  subtitle,
  icon: Icon,
  bullets = [],
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  bullets?: string[];
}) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="surface flex flex-col items-center p-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-accent">
          <Icon className="size-6 text-primary" />
        </span>
        <h2 className="mt-4 text-lg font-bold">Módulo em construção</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          A estrutura desta tela já está no lugar. Vamos ligar as funções aqui nos próximos ajustes.
        </p>
        {bullets.length > 0 && (
          <ul className="mt-5 grid w-full max-w-md gap-2 text-left text-sm text-muted-foreground">
            {bullets.map((b) => (
              <li key={b} className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
