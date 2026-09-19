const TOAST_EVENT = "agenda:toast-needed";

function ensureToaster() {
  if (typeof window === "undefined") return;
  const statefulWindow = window as Window & { __agendaToastNeeded?: boolean };
  statefulWindow.__agendaToastNeeded = true;
  window.dispatchEvent(new Event(TOAST_EVENT));
}

async function show(kind: "success" | "error" | "info", message: string) {
  ensureToaster();
  const { toast: sonnerToast } = await import("sonner");
  sonnerToast[kind](message);
}

export const toast = {
  success(message: string) {
    void show("success", message);
  },
  error(message: string) {
    void show("error", message);
  },
  info(message: string) {
    void show("info", message);
  },
};

export { TOAST_EVENT };
