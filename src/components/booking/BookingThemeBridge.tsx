import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getPublicBookingPage } from "@/lib/public-booking.functions";
import { DEFAULT_PANEL1_APPEARANCE } from "@/lib/panel1-config";

export function BookingThemeBridge() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const pageFn = useServerFn(getPublicBookingPage);

  useEffect(() => {
    if (!pathname.startsWith("/agendar/")) return;
    const slug = decodeURIComponent(pathname.slice("/agendar/".length).split("/")[0] ?? "");
    if (!slug) return;

    let cancelled = false;
    let greetingElement: HTMLParagraphElement | null = null;
    const root = document.documentElement;
    const body = document.body;
    const style = document.createElement("style");
    style.dataset.bookingTheme = "true";
    document.head.appendChild(style);
    body.dataset.bookingTheme = "true";

    const variableNames = [
      "--foreground",
      "--card",
      "--card-foreground",
      "--border",
      "--input",
      "--muted",
      "--muted-foreground",
      "--popover",
      "--popover-foreground",
    ];
    const previous = new Map(variableNames.map((name) => [name, root.style.getPropertyValue(name)]));

    void (async () => {
      try {
        const page = await pageFn({ data: { slug } });
        if (cancelled || !page.business) return;

        const appearance = page.business.booking_appearance ?? DEFAULT_PANEL1_APPEARANCE;
        const preferences = page.business.booking_preferences;
        const pageText = appearance.page_text;
        const serviceBackground = appearance.service_background;
        const serviceText = appearance.service_text;
        const serviceBorder = appearance.service_border;
        const serviceHoverBackground = appearance.service_hover_background;
        const serviceHoverText = appearance.service_hover_text;
        const serviceHoverBorder = appearance.service_hover_border;
        const modalBackground = appearance.modal_background;
        const modalText = appearance.modal_text;
        const modalHoverBackground = appearance.modal_hover_background;
        const modalHoverText = appearance.modal_hover_text;
        const modalActiveBackground = appearance.modal_active_background;
        const modalActiveText = appearance.modal_active_text;
        const modalBorder = appearance.modal_border;
        const agendaBackground = appearance.agenda_background;
        const agendaText = appearance.agenda_text;
        const agendaBorder = appearance.agenda_border;

        root.style.setProperty("--foreground", pageText);
        root.style.setProperty("--card", serviceBackground);
        root.style.setProperty("--card-foreground", serviceText);
        root.style.setProperty("--border", serviceBorder);
        root.style.setProperty("--input", serviceBorder);
        root.style.setProperty("--muted", agendaBackground);
        root.style.setProperty("--muted-foreground", agendaText);
        root.style.setProperty("--popover", modalBackground);
        root.style.setProperty("--popover-foreground", modalText);

        const greeting = preferences?.greeting?.trim();
        if (greeting) {
          const insertGreeting = () => {
            if (cancelled || document.querySelector("[data-booking-greeting='true']")) return;
            const main = document.querySelector("main");
            const logoArea = main?.firstElementChild;
            if (!main || !logoArea) return;
            greetingElement = document.createElement("p");
            greetingElement.dataset.bookingGreeting = "true";
            greetingElement.textContent = greeting;
            greetingElement.style.textAlign = "center";
            greetingElement.style.margin = "0 auto 1.5rem";
            greetingElement.style.fontSize = "0.95rem";
            greetingElement.style.fontWeight = "600";
            greetingElement.style.color = pageText;
            greetingElement.style.opacity = "0.9";
            logoArea.insertAdjacentElement("afterend", greetingElement);
          };
          insertGreeting();
          window.setTimeout(insertGreeting, 250);
          window.setTimeout(insertGreeting, 700);
        }

        style.textContent = `
          body[data-booking-theme="true"] main button.rounded-lg.border:hover {
            background:${serviceHoverBackground} !important;
            color:${serviceHoverText} !important;
            border-color:${serviceHoverBorder} !important;
          }
          body[data-booking-theme="true"] [role="dialog"] {
            background:${modalBackground} !important;
            color:${modalText} !important;
            border-color:${modalBorder} !important;
          }
          body[data-booking-theme="true"] [role="dialog"] button.border {
            background:${agendaBackground};
            border-color:${agendaBorder};
            color:${agendaText};
          }
          body[data-booking-theme="true"] [role="dialog"] button.border:hover {
            background:${modalHoverBackground} !important;
            color:${modalHoverText} !important;
          }
          body[data-booking-theme="true"] [role="dialog"] button[class*="bg-primary"] {
            background:${modalActiveBackground} !important;
            color:${modalActiveText} !important;
            border-color:${modalActiveText} !important;
          }
        `;
      } catch {
        // A página pública mostra o erro de carregamento. O bridge de tema nunca
        // deve derrubar a navegação por causa de customização.
      }
    })();

    return () => {
      cancelled = true;
      greetingElement?.remove();
      style.remove();
      delete body.dataset.bookingTheme;
      for (const [name, value] of previous) {
        if (value) root.style.setProperty(name, value);
        else root.style.removeProperty(name);
      }
    };
  }, [pageFn, pathname]);

  return null;
}
