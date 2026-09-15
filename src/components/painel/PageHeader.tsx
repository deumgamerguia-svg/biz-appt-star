import type { ReactNode } from "react";

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
    <header className="mb-7 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <h1>{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[0.9rem] leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function NoBusiness() {
  return null;
}

export function EmptyList({ text }: { text: string }) {
  return <div className="surface p-10 text-center text-sm text-muted-foreground">{text}</div>;
}
