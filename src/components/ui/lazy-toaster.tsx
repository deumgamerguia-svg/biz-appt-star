import { lazy, Suspense, useEffect, useState } from "react";
import { TOAST_EVENT } from "@/lib/toast";

const Toaster = lazy(() =>
  import("@/components/ui/sonner").then((module) => ({ default: module.Toaster })),
);

export function LazyToaster() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const statefulWindow = window as Window & { __agendaToastNeeded?: boolean };
    if (statefulWindow.__agendaToastNeeded) setEnabled(true);

    const enable = () => setEnabled(true);
    window.addEventListener(TOAST_EVENT, enable);
    return () => window.removeEventListener(TOAST_EVENT, enable);
  }, []);

  if (!enabled) return null;

  return (
    <Suspense fallback={null}>
      <Toaster position="top-right" richColors />
    </Suspense>
  );
}
